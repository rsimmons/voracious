import { startsWith, removePrefix } from '../util/string';

class WebLocalStorageBackend {
  constructor(prefix) {
    this.prefix = prefix;
  }

  getItem(key) {
    return Promise.resolve(localStorage.getItem(this.prefix+key));
  }

  getItems(keys) {
    const result = [];
    for (const k of keys) {
      result.push([k, localStorage.getItem(this.prefix+k)]);
    }
    return Promise.resolve(result);
  }

  setItem(key, value) {
    // TODO: should catch and wrap exceptions thrown here probably
    localStorage.setItem(this.prefix+key, value);
    return Promise.resolve(undefined);
  }

  setItems(keyValues) {
    // TODO: should catch and wrap exceptions thrown here probably
    for (const kv of keyValues) {
      localStorage.setItem(this.prefix+kv[0], kv[1]);
    }
    return Promise.resolve(undefined);
  }

  removeItem(key) {
    localStorage.removeItem(this.prefix+key);
    return Promise.resolve(undefined);
  }

  listAllKeys() {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (startsWith(k, this.prefix)) {
        result.push(removePrefix(k, this.prefix));
      }
    }
    return Promise.resolve(result);
  }
}

export default function createBackend() {
  return Promise.resolve(new WebLocalStorageBackend('voracious:'));
}
