"use strict";
const request = require("request");
const unzip = require("unzip");
const fs = require("fs");
const EventEmitter = require("events");

function isBinaryFileRequired(flashSpecification, fileName) {
    return flashSpecification.map(binary => binary.path).indexOf(fileName) !== -1;
}

function addBufferToBinary(flashSpecification, fileName, buffer) {
    flashSpecification.forEach((element, index) => {
        if (flashSpecification[index].path === fileName) {
            flashSpecification[index].buffer = buffer;
        }
    });
}

function prepareBinaries(manifest, callback) {
    const eventEmitter = new EventEmitter();
    const flashContents = manifest.flash;
    const downloadRequest = request(manifest.download)
        .pipe(unzip.Parse())
        .on('entry', (entry) => {
            const fileName = entry.path;
            if (isBinaryFileRequired(flashContents, fileName)) {
                eventEmitter.emit("entry", {
                    display: `Extracting ${fileName}`,
                    stage: "start"
                });

                let body;
                entry.on("data", function(data){
                    if(body) {
                        body = Buffer.concat([body, data]);
                    } else {
                        body = data;
                    }
                }).on("end", () => {
                    eventEmitter.emit("entry", {
                        display: `Extracted ${fileName}`,
                        stage: "end"
                    });
                    addBufferToBinary(flashContents, fileName, body);
                }).on("error", callback);
            } else {
                entry.autodrain();
            }
        }).on("close", () => {
            callback(null, flashContents);
        });
    return eventEmitter;
}

module.exports = prepareBinaries;