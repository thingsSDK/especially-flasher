
"use strict";
//Taken from Electron API Demos
//https://github.com/electron/electron-api-demos/blob/master/script/installer.js

const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller;
const path = require('path');
const rimraf = require('rimraf');

const win64 = 'win32-x64';
const win32 = 'win32-ia32';
const winArg = process.argv[2];
const winExt = winArg === 'win32' ? win32: win64;

deleteOutputFolder()
  .then(getInstallerConfig)
  .then(createWindowsInstaller)
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });

function getInstallerConfig() {
  const rootPath = path.join(__dirname, '..');
  const outPath = path.join(rootPath, 'out');

  return Promise.resolve({
    appDirectory: path.join(outPath, 'flasher.js-' + winExt),
    iconUrl: 'https://raw.githubusercontent.com/thingssdk/flasher.js/resources/icon.ico', 
    loadingGif: path.join(rootPath, 'resources', 'loading.gif'),
    noMsi: true,
    outputDirectory: path.join(outPath, 'installers'),
    setupExe: 'flasher.js-setup-' + winExt + '.exe',
    setupIcon: path.join(rootPath, 'resources', 'icon.ico'),
    skipUpdateIcon: true
  });
}

function deleteOutputFolder() {
  return new Promise((resolve, reject) => {
    rimraf(path.join(__dirname, '..', 'out', 'installers'), error => {
      if (error) reject(error);
      else resolve();
    });
  });
}