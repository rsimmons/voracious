import path from 'path';

import { parseSRT } from '../util/subtitles';
import { createAutoAnnotatedText } from '../util/analysis';
import { detectWithinSupported } from '../util/languages';
import { createTimeRangeChunk, createTimeRangeChunkSet } from '../util/chunk';

const SUPPORTED_VIDEO_EXTENSIONS = [
  '.mp4',
];

const fs = window.require('fs-extra'); // use window to avoid webpack

const recursiveScanDirectory = async (dir) => {
  const result = [];

  const dirents = await fs.readdir(dir);

  for (const fn of dirents) {
    const absfn = path.join(dir, fn);
    const stat = await fs.stat(absfn);

    if (stat.isDirectory()) {
      result.push(... await recursiveScanDirectory(absfn));
    } else {
      const ext = path.extname(fn);
      if (SUPPORTED_VIDEO_EXTENSIONS.includes(ext)) {
        result.push({
          id: fn,
          name: fn,
          url: 'local://' + absfn, // this prefix works with our custom file protocol for Electron
        });
      }
    }
  }

  return result;
};

export const listCollectionVideos = async (collectionId) => {
  return recursiveScanDirectory(collectionId);
};

const loadSubtitleTrackFromSRT = async (filename) => {
  // Load and parse SRT file
  const data = await fs.readFile(filename);

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

  const subtitleTrack = createTimeRangeChunkSet(chunks);
};
