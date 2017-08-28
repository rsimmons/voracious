import path from 'path';

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
  console.log('user data', userDataPath);
  const dbFilename = path.join(userDataPath, 'voracious.db');
  console.log('db filename', dbFilename);

  return new ElectronSqliteBackend(dbFilename);
}
