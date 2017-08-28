import path from 'path';

// NOTE: We use window.require instead of require or import so that
//  Webpack doesn't transform it. These requires happen at runtime
//  via Electron loading mechanisms.
const {app} = window.require('electron').remote;
const db = window.require('sqlite');

class ElectronSqliteBackend {
  constructor(dbFilename) {
    db.open(dbFilename).then(() => {
      console.log('opened db');
    });
  }
}

export default function createBackend() {
  const userDataPath = app.getPath('userData');
  const dbFilename = path.join(userDataPath, 'voracious.db');

  return new ElectronSqliteBackend(dbFilename);
}
