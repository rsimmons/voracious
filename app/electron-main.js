const {app, protocol, ipcMain, dialog, BrowserWindow} = require('electron');

const path = require('path');
const url = require('url');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// We register our own local: protocol, which behaves like file:, to allow
//  the renderer window to play videos directly from the filesystem.
//  The given path must be absolute, and not escaped after the prefix.
function registerLocalProtocol() {
  protocol.registerFileProtocol('local', (request, callback) => {
    const path = request.url.substr(8); // strip off local:// prefix
    const decodedPath = decodeURI(path); // this makes utf-8 filenames work, I'm not sure it's correct
    callback(decodedPath);
  }, (error) => {
    if (error) console.error('Failed to register protocol');
  })
}

function addIpcHandlers() {
  ipcMain.on('choose-video-file', () => {
    dialog.showOpenDialog({
      title: 'Choose a video file',
      buttonLabel: 'Choose',
      filters: [{name: 'Videos', extensions: ['mp4', 'webm']}],
      properties: ['openFile'],
    }, files => {
      if (files && files.length) {
        const fn = files[0];
        mainWindow.send('chose-video-file', fn)
      }
    });
  });

  ipcMain.on('choose-collection-directory', () => {
    dialog.showOpenDialog({
      title: 'Select collection folder',
      buttonLabel: 'Choose',
      properties: ['openDirectory'],
    }, files => {
      if (files && files.length) {
        const fn = files[0];
        mainWindow.send('chose-collection-directory', fn)
      }
    });
  });
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1200, height: 600});

  // and load the index.html of the app.
  const startUrl = process.env.ELECTRON_START_URL || url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  });
  mainWindow.loadURL(startUrl);

  // Open the DevTools in dev
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  registerLocalProtocol();
  addIpcHandlers();
  createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function() {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
