import WebStorageBackend from './web.js';

export default function createStorageBackend(prefix) {
  return new WebStorageBackend(prefix);
}
