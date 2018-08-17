import franc from 'franc';

export function detectIso6393(text) {
  // franc returns ISO 639-3 codes, including 'und' for undetermined
  return franc(text);
}
