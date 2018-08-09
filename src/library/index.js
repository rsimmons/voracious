import path from 'path';

import { parseSRT } from '../util/subtitles';
import { createAutoAnnotatedText } from '../util/analysis';
import { detectWithinSupported } from '../util/languages';
import { createTimeRangeChunk, createTimeRangeChunkSet } from '../util/chunk';

const fs = window.require('fs-extra'); // use window to avoid webpack

export const listCollectionVideos = async (collectionId) => {
  const result = [];

  const files = await fs.readdir(collectionId);
  files.sort();

  for (const fn of files) {
    result.push({
      id: fn,
      name: fn,
      url: 'local://' + fn, // this prefix works with our custom file protocol for Electron
    });
  }

  return result;
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
