import path from 'path';

import { getResourcesPath, getUserDataPath } from '../util/appPaths';
import { loadYomichanZip } from './yomichan';
export { importEpwing } from './epwing';

const fs = window.require('fs-extra'); // use window to avoid webpack

const dictIndexes = new Map(); // name -> index

const indexYomichanEntries = (subentries) => {
  const sequenceToEntry = new Map(); // sequence (id) -> macro-entry object
  const wordOrReadingToSequences = new Map(); // string -> Set(sequence ids)

  for (const subentry of subentries) {
    const word = subentry[0];
    const reading = subentry[1];
    const glosses = subentry[5].join('; ');
    const sequence = subentry[6];

    let record;
    if (sequenceToEntry.has(sequence)) {
      record = sequenceToEntry.get(sequence);
    } else {
      record = {
        words: new Set(),
        readings: new Set(),
        glosses: new Set(),
      };
      sequenceToEntry.set(sequence, record);
    }

    record.words.add(word);
    if (reading) {
      record.readings.add(reading);
    }
    record.glosses.add(glosses);

    if (!wordOrReadingToSequences.has(word)) {
      wordOrReadingToSequences.set(word, new Set());
    }
    wordOrReadingToSequences.get(word).add(sequence);

    if (reading) {
      if (!wordOrReadingToSequences.has(reading)) {
        wordOrReadingToSequences.set(reading, new Set());
      }
      wordOrReadingToSequences.get(reading).add(sequence);
    }
  }

  return {
    sequenceToEntry,
    wordOrReadingToSequences,
  }
};

export const loadAndIndexYomichanZip = async (zipfn) => {
  const {name, termEntries} = await loadYomichanZip(zipfn);

  dictIndexes.set(name, indexYomichanEntries(termEntries));
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
  dictIndexes.clear();

  // Scan for built-in dictionaries
  await scanDirForYomichanZips(path.join(getResourcesPath(), 'dictionaries'));

  // Scan for imported dictionaries
  const importedPath = path.join(getUserDataPath(), 'dictionaries');
  if (await fs.exists(importedPath)) {
    await scanDirForYomichanZips(path.join(getUserDataPath(), 'dictionaries'));
  }
};

export const search = (word) => {
  const result = [];
  for (const [n, index] of dictIndexes.entries()) {
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
