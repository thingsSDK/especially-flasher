const prepareBinaries = require('./prepareBinaries');
const request = require('request');
const nodeFetch = require('node-fetch');
const RomComm = require('rom-comm');

function handleBinaryPreparer(binaryPreparer, port, onError, onProgress, onComplete) {
    const flashSpeedMultiplier = process.platform === 'win32' ? 2 : 4;
    binaryPreparer
        .on("error", onError)
        .on("progress", progress => {
            //For the download/extract progress.
            onProgress(progress.details.downloadedBytes / progress.details.downloadSize, progress.display);
        })
        .on("complete", flashSpec => {
            const device = RomComm.serial(port, { baudRate: 115200 * flashSpeedMultiplier }, {
                onProgress: progress => onProgress(progress.flashedBytes / progress.totalBytes, 'Flashing')
            });
            device.open(err => {
                if (err) {
                    onError(err);
                } else {
                    device.flash(flashSpec, err => {
                        // TODO: This err doesn't come through
                        if (err) {
                            onError(err);
                        } else {
                            device.close();
                            onComplete();
                        }
                    });
                }
            });
        });
}

function flash(port, manifestURL, onError, onProgress, onComplete) {
    console.log('FLASH:', manifestURL)
    nodeFetch(manifestURL)
        .then(response => response.json())
        .then(prepareBinaries)
        .then(binaryPreparer => handleBinaryPreparer(binaryPreparer, port, onError, onProgress, onComplete));
}


module.exports = flash;
