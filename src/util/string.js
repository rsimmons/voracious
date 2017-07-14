import assert from 'assert';

export const startsWith = (s, prefix) => (s.substr(0, prefix.length) === prefix);

export const removePrefix = (s, prefix) => {
  assert(startsWith(s, prefix));
  return s.substr(prefix.length);
}

export const cpSlice = (s, cpBegin, cpEnd) => [...s].slice(cpBegin, cpEnd).join('');
