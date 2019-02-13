import franc from 'franc';

import languageTable from './languageTable';

const iso6393ToEntry = new Map(languageTable.map(entry => [entry.iso6393, entry]));

export function detectIso6393(text) {
  // franc returns ISO 639-3 codes, including 'und' for undetermined
  return franc(text);
}

export function iso6393To6391(iso6393) {
  const entry = iso6393ToEntry.get(iso6393);
  if (!entry) {
    return undefined;
  }
  return entry.iso6391;
}
