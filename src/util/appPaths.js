import path from 'path';

const { app, process } = window.require('electron').remote;

export const getUserDataPath = () => {
  return app.getPath('userData');
};

export const getResourcesPath = () => {
  return path.join(app.getAppPath(), 'resources');
};

export const getPlatformResourcesPath = () => {
  return path.join(app.getAppPath(), 'platform_resources', process.platform);
};
