"use strict";

const fs = require("fs");
const path = require('path');

const rootPath = path.join(__dirname, '..');
const outPath = path.join(rootPath, 'out');
const packedPath = path.join(outPath, 'installers');
const exec = require('child_process').execSync;

fs.readdir(packedPath, (err, files) => {
    const dllsAndExes = files.filter(file => {
        return file.endsWith(".dll") || file.endsWith(".exe");
    });
    
    dllsAndExes.forEach(run);
});


function run(file) {
    exec(`signtool.exe sign /a /d "Flasher.js" /du https://github.com/ThingsSDK/flasher.js /s MY /n "Andrew Chalkley" /fd sha1 /t http://timestamp.verisign.com/scripts/timstamp.dll /v "${path.join(packedPath, file)}"`);
    exec(`signtool.exe sign /a /d "Flasher.js" /du https://github.com/ThingsSDK/flasher.js /s MY /n "Andrew Chalkley" /fd sha256 /tr http://sha256timestamp.ws.symantec.com/sha256/timestamp /td sha256 /as /v "${path.join(packedPath, file)}"`);
}
