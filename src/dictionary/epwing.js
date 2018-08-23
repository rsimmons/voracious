import { getBinariesPath, getUserDataPath } from '../util/appPaths';

const path = window.require('path');
const fs = window.require('fs-extra');
const { execFile } = window.require('child_process');
const { process } = window.require('electron').remote;

export const importEpwing = async (epwingDir) => {
  const yomichanImportDir = path.join(getBinariesPath(), 'yomichan-import');
  let yomichanImport = path.join(yomichanImportDir, 'yomichan-import');
  if (process.platform === 'win32') {
    yomichanImport += '.exe';
  }

  // Make destination filename based on src, that doesn't conflict
  // TODO: ensure that epwingDir is a directory?
  const srcBase = path.parse(epwingDir).name;
  const destDir = path.join(getUserDataPath(), 'dictionaries');
  await fs.ensureDir(destDir);

  let idx = 0;
  let destFn;
  while (true) {
    destFn = path.join(destDir, srcBase);
    if (idx) {
      destFn += idx.toString();
    }
    destFn += '.zip';

    if (!(await fs.exists(destFn))) {
      break;
    }
    idx++;
  }

  console.log('importEpwing', yomichanImport, epwingDir, destFn);
  return new Promise((resolve, reject) => {
    execFile(yomichanImport, [epwingDir, destFn], {cwd: yomichanImportDir, windowsHide: true}, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      }
      resolve(destFn);
    });
  });
};
