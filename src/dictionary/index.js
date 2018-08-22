import path from 'path';

import { getResourcesPath, getUserDataPath } from '../util/appPaths';
import { loadYomichanZip, indexYomichanEntries } from './yomichan';
export { importEpwing } from './epwing';

const fs = window.require('fs-extra'); // use window to avoid webpack

const loadedDictionaries = new Map(); // name -> index

export const loadAndIndexYomichanZip = async (zipfn, builtin, reportProgress) => {
  const {name, termEntries} = await loadYomichanZip(zipfn, reportProgress);

  if (reportProgress) {
    reportProgress('Indexing ' + name + '...');
  }
  loadedDictionaries.set(name, {
    index: indexYomichanEntries(termEntries),
    builtin,
  });
};

const scanDirForYomichanZips = async (dir, builtin, reportProgress) => {
  const dirents = await fs.readdir(dir);
  for (const dirent of dirents) {
    if (path.extname(dirent) === '.zip') {
      // Assume any zips are Yomichan dicts
      await loadAndIndexYomichanZip(path.join(dir, dirent), builtin, reportProgress);
    }
  }
};

export const openDictionaries = async (reportProgress) => {
  loadedDictionaries.clear();

  // Scan for built-in dictionaries
  await scanDirForYomichanZips(path.join(getResourcesPath(), 'dictionaries'), true, reportProgress);

  // Scan for imported dictionaries
  const importedPath = path.join(getUserDataPath(), 'dictionaries');
  if (await fs.exists(importedPath)) {
    await scanDirForYomichanZips(path.join(getUserDataPath(), 'dictionaries'), false, reportProgress);
  }
};

export const getLoadedDictionaries = () => {
  return loadedDictionaries;
};

export const search = (word) => {
  const result = [];
  for (const [n, {index}] of loadedDictionaries.entries()) {
    const sequences = index.wordOrReadingToSequences.get(word);
    if (sequences) {
      for (const seq of sequences) {
        const entry = index.sequenceToEntry.get(seq);
        result.push({
          dictionaryName: n,
          text: Array.from(entry.glosses).join('\n')
        });
      }
    }
  }

  return result;
};
