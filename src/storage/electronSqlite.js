import path from 'path';

// NOTE: We use window.require instead of require or import so that
//  Webpack doesn't transform it. These requires happen at runtime
//  via Electron loading mechanisms.
const {app} = window.require('electron').remote;
const db = window.require('sqlite');

class ElectronSqliteBackend {
  constructor(dbFilename) {
    this.dbFilename = dbFilename;
  }

  async initialize() {
    await db.open(this.dbFilename);
    await db.run('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
  }

  async getItem(key) {
    const row = await db.get('SELECT * FROM kv WHERE k = ?', key);
    return row && row.v;
  }

  async setItem(key, value) {
    // This is supposedly the right way to upsert in sqlite
    // NOTE: If we had other writers, this would need to be in a transaction
    await db.run('UPDATE kv SET v = ? WHERE k = ?', value, key);
    await db.run('INSERT INTO kv (k, v) SELECT ?, ? WHERE changes() = 0', key, value);
  }

  async removeItem(key) {
    await db.run('DELETE FROM kv WHERE k = ?', key);
  }
}

export default async function createBackend() {
  const userDataPath = app.getPath('userData');
  const dbFilename = path.join(userDataPath, 'voracious.db');

  const backend = new ElectronSqliteBackend(dbFilename);
  await backend.initialize();
  return backend;
}
