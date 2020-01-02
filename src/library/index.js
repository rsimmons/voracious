import path from 'path';

import jschardet from 'jschardet';
import iconv from 'iconv-lite';

import { parseSRT, parseVTT, parseASS } from '../util/subtitleParsing';
import { ensureKuromojiLoaded, createAutoAnnotatedText } from '../util/analysis';
import { detectIso6393 } from '../util/languages';
import { createTimeRangeChunk, createTimeRangeChunkSet } from '../util/chunk';
import { extractAudio, extractFrameImage } from '../util/ffmpeg';
import createStorageBackend from '../storage';

const LOCAL_PREFIX = 'local:';

const SUPPORTED_VIDEO_EXTENSIONS = [
  '.mp4',
  '.mkv',
];

const SEASON_EPISODE_PATTERN = /s([0-9]+)e([0-9]+)/i;
const EPISODE_PATTERN = /ep([0-9]+)/i;
const SUBTITLE_LANG_EXTENSION_PATTERN = /(.*)\.([a-zA-Z]{2,3})\.(srt|vtt|ass)/i;
const SUBTITLE_NOLANG_EXTENSION_PATTERN = /(.*)\.(srt|vtt|ass)/i;

const fs = window.require('fs-extra'); // use window to avoid webpack

const listVideosRel = async (baseDir, relDir) => {
  const result = [];
  const videoFiles = [];
  const subtitleFilesMap = new Map(); // base -> [fn]

  const dirents = await fs.readdir(path.join(baseDir, relDir));

  for (const fn of dirents) {
    const absfn = path.join(baseDir, relDir, fn);
    const stat = await fs.stat(absfn);

    if (!stat.isDirectory()) {
      const ext = path.extname(fn);
      if (SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
        videoFiles.push(fn);
      } else {
        const subMatchLang = SUBTITLE_LANG_EXTENSION_PATTERN.exec(fn);
        let hit = false;
        let base, langCode;

        if (subMatchLang) {
          hit = true;
          base = subMatchLang[1];
          langCode = subMatchLang[2];
        } else {
          const subMatchNolang = SUBTITLE_NOLANG_EXTENSION_PATTERN.exec(fn);

          if (subMatchNolang) {
            hit = true;
            base = subMatchNolang[1];
          }
        }

        if (hit) {
          if (!subtitleFilesMap.has(base)) {
            subtitleFilesMap.set(base, []);
          }
          subtitleFilesMap.get(base).push({
            fn,
            langCode,
          });
        }
      }
    }
  }

  for (const vfn of videoFiles) {
    const subtitleTrackIds = [];

    const basevfn = path.basename(vfn, path.extname(vfn));

    if (subtitleFilesMap.has(basevfn)) {
      for (const subinfo of subtitleFilesMap.get(basevfn)) {
        subtitleTrackIds.push(path.join(relDir, subinfo.fn));
      }
    }

    result.push({
      id: path.join(relDir, vfn),
      name: path.basename(vfn, path.extname(vfn)),
      url: 'local://' + path.join(baseDir, relDir, vfn), // this prefix works with our custom file protocol for Electron
      subtitleTrackIds,
    });
  }

  return result;
};

const listDirs = async (dir) => {
  const dirents = await fs.readdir(dir);
  const result = [];

  for (const fn of dirents) {
    const absfn = path.join(dir, fn);
    const stat = await fs.stat(absfn);

    if (stat.isDirectory()) {
      result.push(fn);
    }
  }

  return result;
};

export const getCollectionIndex = async (collectionLocator) => {
  const storage = await createStorageBackend();
  const playbackPos = async (vid_id) => {
      const positionStr = await storage.getItemMaybe('playback_position/' + encodeURIComponent(collectionLocator) + '/' + encodeURIComponent(vid_id));
      if (!positionStr) {
        return 0;
      } else {
        return JSON.parse(positionStr);
      }
  };

  if (collectionLocator.startsWith(LOCAL_PREFIX)) {
    const baseDirectory = collectionLocator.slice(LOCAL_PREFIX.length);

    const result = {
      videos: [],
      titles: [],
    };

    if (!(await fs.exists(baseDirectory))) {
      // Short circuit if base directory is missing
      return result;
    }

    // Look for videos directly in baseDirectory
    const baseVideos = await listVideosRel(baseDirectory, '');
    for (const vid of baseVideos) {
      result.videos.push(vid);
      result.titles.push({
        name: vid.name,
        series: false,
        videoId: vid.id,
        parts: null,
        playbackPosition: await playbackPos(vid.id),
      });
    }

    // Look in directories
    for (const dir of await listDirs(baseDirectory)) {
      const vids = await listVideosRel(baseDirectory, dir);

      // There may be season dirs, look for those
      for (const subDir of await listDirs(path.join(baseDirectory, dir))) {
        if (subDir.startsWith('Season')) {
          vids.push(...await listVideosRel(baseDirectory, path.join(dir, subDir)));
        }
      }

      if (vids.length === 0) {
        continue;
      }

      for (const vid of vids) {
        result.videos.push(vid);
      }

      if (vids.length === 1) { // TODO: also, if single vid, make sure it doesn't have season/episode name, otherwise it IS a series
        result.titles.push({
          name: dir,
          series: false,
          videoId: vids[0].id,
          parts: null,
          playbackPosition: await playbackPos(vids[0].id),
        });
      } else {
        const seasonEpisodes = [];
        const episodes = [];
        const others = [];

        for (const vid of vids) {
          const seMatch = SEASON_EPISODE_PATTERN.exec(vid.name);
          if (seMatch) {
            const sNum = +(seMatch[1]);
            const eNum = +(seMatch[2]);
            seasonEpisodes.push({
              seasonNumber: sNum,
              episodeNumber: eNum,
              videoId: vid.id,
              playbackPosition: await playbackPos(vid.id),
            });
          } else {
            const eMatch = EPISODE_PATTERN.exec(vid.name);
            if (eMatch) {
              const eNum = +(eMatch[1]);
              episodes.push({
                episodeNumber: eNum,
                videoId: vid.id,
                playbackPosition: await playbackPos(vid.id),
              });
            } else {
              others.push({
                name: vid.name,
                videoId: vid.id,
                playbackPosition: await playbackPos(vid.id),
              });
            }
          }
        }

        result.titles.push({
          name: dir,
          series: true,
          videoId: null,
          parts: {
            seasonEpisodes,
            episodes,
            others,
            count: vids.length,
          },
        });
      }
    }

    result.titles.sort((a, b) => (a.name.localeCompare(b.name)));

    return result;
  } else {
    throw new Error('internal error');
  }
};

const loadSubtitleTrackFromFile = async (filename) => {
  console.time('loadSubtitleTrackFromFile ' + filename);

  const rawData = await fs.readFile(filename);
  const encodingGuess = jschardet.detect(rawData.toString('binary'));
  console.log('loadSubtitleTrackFromFile guessed encoding', encodingGuess);
  const data = iconv.decode(rawData, encodingGuess.encoding);

  let subs;
  if (filename.endsWith('.srt')) {
    subs = parseSRT(data);
  } else if (filename.endsWith('.vtt')) {
    subs = parseVTT(data);
  } else if (filename.endsWith('.ass')) {
    subs = parseASS(data);
  } else {
    throw new Error('internal error');
  }

  // Autodetect language
  const combinedText = subs.map(s => s.lines).join();
  const language = detectIso6393(combinedText);

  // Create time-indexed subtitle track
  await ensureKuromojiLoaded(); // wait until kuromoji has loaded
  const chunks = [];
  for (const sub of subs) {
    const annoText = await createAutoAnnotatedText(sub.lines, language);
    chunks.push(createTimeRangeChunk(sub.begin, sub.end, annoText));
  }

  const chunkSet = createTimeRangeChunkSet(chunks);

  console.timeEnd('loadSubtitleTrackFromFile ' + filename);

  return {
    language,
    chunkSet,
  };
};

export const loadCollectionSubtitleTrack = async (collectionLocator, subTrackId) => {
  if (collectionLocator.startsWith(LOCAL_PREFIX)) {
    const baseDirectory = collectionLocator.slice(LOCAL_PREFIX.length);
    const subfn = path.join(baseDirectory, subTrackId);
    return await loadSubtitleTrackFromFile(subfn);
  } else {
    throw new Error('internal error');
  }
};

export const extractAudioFromVideo = async (collectionLocator, vidId, startTime, endTime) => {
  if (collectionLocator.startsWith(LOCAL_PREFIX)) {
    const baseDirectory = collectionLocator.slice(LOCAL_PREFIX.length);
    const vidfn = path.join(baseDirectory, vidId);
    const audioData = await extractAudio(vidfn, startTime, endTime);
    return audioData;
  } else {
    throw new Error('not a local collection');
  }
};

export const extractFrameImageFromVideo = async (collectionLocator, vidId, time) => {
  if (collectionLocator.startsWith(LOCAL_PREFIX)) {
    const baseDirectory = collectionLocator.slice(LOCAL_PREFIX.length);
    const vidfn = path.join(baseDirectory, vidId);
    const imageData = await extractFrameImage(vidfn, time);
    return imageData;
  } else {
    throw new Error('not a local collection');
  }
};
