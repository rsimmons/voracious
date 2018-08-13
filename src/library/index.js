import path from 'path';

import { parseSRT } from '../util/subtitleParsing';
import { createAutoAnnotatedText } from '../util/analysis';
import { detectWithinSupported } from '../util/languages';
import { createTimeRangeChunk, createTimeRangeChunkSet } from '../util/chunk';

const SUPPORTED_VIDEO_EXTENSIONS = [
  '.mp4',
];

const SUPPORTED_SUBTITLE_EXTENSIONS = [
  '.srt',
];

const fs = window.require('fs-extra'); // use window to avoid webpack

const recursiveScanDirectory = async (baseDir, relDir) => {
  const result = [];
  const videoFiles = [];
  const subtitleFilesMap = new Map(); // base -> fn

  const dirents = await fs.readdir(path.join(baseDir, relDir));

  for (const fn of dirents) {
    const absfn = path.join(baseDir, relDir, fn);
    const stat = await fs.stat(absfn);

    if (stat.isDirectory()) {
      result.push(...await recursiveScanDirectory(baseDir, path.join(relDir, fn)));
    } else {
      const ext = path.extname(fn);
      if (SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
        videoFiles.push(fn);
      } else if (SUPPORTED_SUBTITLE_EXTENSIONS.includes(ext)) {
        const base = path.basename(fn, ext);
        subtitleFilesMap.set(base, fn);
      }
    }
  }

  for (const vfn of videoFiles) {
    const subtitleTrackIds = [];

    const basevfn = path.basename(vfn, path.extname(vfn));

    if (subtitleFilesMap.has(basevfn)) {
      subtitleTrackIds.push(path.join(relDir, subtitleFilesMap.get(basevfn)));
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

export const listCollectionVideos = async (collectionLocator) => {
  const LOCAL_PREFIX = 'local:';

  if (collectionLocator.startsWith(LOCAL_PREFIX)) {
    const baseDirectory = collectionLocator.slice(LOCAL_PREFIX.length);
    return recursiveScanDirectory(baseDirectory, '');
  } else {
    throw new Error('internal error');
  }
};

const loadSubtitleTrackFromSRT = async (filename) => {
  // Load and parse SRT file
  const data = await fs.readFile(filename, 'utf8');

  const subs = parseSRT(data);

  // Autodetect language
  const combinedText = subs.map(s => s.lines).join();
  const language = detectWithinSupported(combinedText);

  // Create time-indexed subtitle track
  const chunks = [];
  for (const sub of subs) {
    const annoText = createAutoAnnotatedText(sub.lines, language);
    chunks.push(createTimeRangeChunk(sub.begin, sub.end, annoText));
  }

  const chunkSet = createTimeRangeChunkSet(chunks);

  return {
    language,
    chunkSet,
  };
};

export const loadCollectionSubtitleTrack = async (collectionLocator, subTrackId) => {
  const subfn = path.join(collectionLocator, subTrackId);
  return await loadSubtitleTrackFromSRT(subfn);
};
