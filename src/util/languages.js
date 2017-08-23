import franc from 'franc';

/*
  Only languages that we provide special treatment for are listed here.
  - ietf is IETF language tag, aka BCP 47
  - iso639_3 is ISO 639-3 (three-letter)
*/
export const SUPPORTED_LANGUAGES = [
  {
    ietf: 'und',
    iso639_3: 'und',
    desc: 'other',
  },
  {
    ietf: 'ja',
    iso639_3: 'jpn',
    desc: 'Japanese',
  },
/*
  {
    ietf: 'en',
    iso639_3: 'eng',
    desc: 'English',
  },
*/
];

const iso639_3ToEntry = {};
for (const entry of SUPPORTED_LANGUAGES) {
  iso639_3ToEntry[entry.iso639_3] = entry;
}

// Returns IETF tag, if it is one of our supported languages
export function detectWithinSupported(text) {
  // franc returns ISO 639-3 codes, including 'und' for undetermined
  const code = franc(text);

  const entry = iso639_3ToEntry[code];
  if (entry) {
    return entry.ietf;
  }
  return 'und';
}
