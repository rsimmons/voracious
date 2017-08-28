import WebLocalStorageBackend from './webLocalStorage.js';

export default function createStorageBackend(prefix) {
  return new WebLocalStorageBackend(prefix);
}
