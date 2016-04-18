'use strict';

const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.
const autoUpdater = require('auto-updater');
const packageInfo = require('./package.json');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
var mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

autoUpdater.on("checking-for-update", () => {
    new Notification("Checking for updates");
});


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 450,
    height: 160,
    'min-width': 450,
    'min-height': 160,
    'max-width': 500,
    'max-height': 550,
    'accept-first-mouse': true,
    'title-bar-style': 'hidden'
  });

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/front-end/index.html');

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  let updateFeed = `http://localhost:3000/updates/${packageInfo.name}/latest`;
  autoUpdater.setFeedURL(updateFeed + '?v=' + packageInfo.version);
  autoUpdater.checkForUpdates();

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});