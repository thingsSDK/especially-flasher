'use strict';
if (require('electron-squirrel-startup')) return;

// this should be placed at top of main.js to handle setup events quickly
if (handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  return;
}

const electron = require('electron');
const app = electron.app;  // Module to control application life.
const BrowserWindow = electron.BrowserWindow;  // Module to create native browser window.
const checkDialout = require("./back-end/checkDialout");
const ipcHandlers = require('./back-end/ipcHandlers');
const isProd = process.execPath.search('electron-prebuilt') === -1;
const webServer = require("./back-end/web-server");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function launchApp() {
  //Clears any crusty downloads/API calls
  mainWindow.webContents.session.clearCache(() => {
    ipcHandlers();
    // load the index.html of the app.
    if (!isProd) {
      mainWindow.loadURL('http://localhost:3000/');
    } else {
      mainWindow.loadURL('file://' + __dirname + '/front-end/index.html');
    }
  });
}

function launchLinuxHelper() {
  // load the linux-help.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/front-end/linux-help.html');
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 520,
    height: 300,
    'min-width': 520,
    'min-height': 300,
    'accept-first-mouse': true
  });

  if (process.platform === "linux") {
    checkDialout(launchApp, err => {
      if (err.message === checkDialout.ERROR_MESSAGES.USER_NOT_IN_DIALOUT) {
        launchLinuxHelper();
      } else {
        //TODO: When another error occurs propogate the error somehow.
        launchApp();
      }
    });
  } else {
    launchApp();
  }
  // Open the DevTools.
  if (!isProd) mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
});


function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');
  const path = require('path');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function (command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, { detached: true });
    } catch (error) { }

    return spawnedProcess;
  };

  const spawnUpdate = function (args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated

      app.quit();
      return true;
  }
}
