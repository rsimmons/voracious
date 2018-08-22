import path from 'path';

const { app, process } = window.require('electron').remote;

export const getUserDataPath = () => {
  return app.getPath('userData');
};

export const getResourcesPath = () => {
  return path.join(app.getAppPath(), 'resources');
};

export const getBinariesPath = () => {
  let appPath = app.getAppPath();
  if (appPath.endsWith('.asar')) {
    appPath += '.unpacked';
  }
  return path.join(appPath, 'resources/bin', process.platform);
};
