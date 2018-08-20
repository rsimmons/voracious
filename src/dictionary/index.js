import path from 'path';

import { getResourcesPath, getUserDataPath } from '../util/appPaths';
import { loadYomichanZip } from './yomichan';

const fs = window.require('fs-extra'); // use window to avoid webpack

const dictIndexes = new Map(); // name -> index

const indexYomichanEntries = (entries) => {
  const mainToEntries = new Map();
  const readingToEntries = new Map();

  for (const entry of entries) {
    const main = entry[0];
    if (!mainToEntries.has(main)) {
      mainToEntries.set(main, []);
    }
    mainToEntries.get(main).push(entry);

    const reading = entry[1];
    if (reading) {
      if (!readingToEntries.has(reading)) {
        readingToEntries.set(reading, []);
      }
      readingToEntries.get(reading).push(entry);
    }
  }
  return {
    mainToEntries,
  }
};

const loadAndIndexYomichanZip = async (zipfn) => {
  const entries = await loadYomichanZip(zipfn);

  const name = path.basename(zipfn, path.extname(zipfn));

  dictIndexes.set(name, indexYomichanEntries(entries));
};

const scanDirForYomichanZips = async (dir) => {
  const dirents = await fs.readdir(dir);
  for (const dirent of dirents) {
    if (path.extname(dirent) === '.zip') {
      // Assume any zips are Yomichan dicts
      await loadAndIndexYomichanZip(path.join(dir, dirent));
    }
  }
};

export const openDictionaries = async () => {
  // Scan for built-in dictionaries
  await scanDirForYomichanZips(path.join(getResourcesPath(), 'dictionaries'));

  // Scan for imported dictionaries
  await scanDirForYomichanZips(path.join(getUserDataPath(), 'dictionaries'));
};

export const search = (word) => {
  const result = [];
  for (const [n, index] of dictIndexes.entries()) {
    const entries = index.mainToEntries.get(word);
    if (entries) {
      for (const entry of entries) {
        result.push(entry[5].join('; '));
      }
    }
  }

  return result;
};
