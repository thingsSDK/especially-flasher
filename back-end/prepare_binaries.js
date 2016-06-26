"use strict";

const request = require("request");
const decompress = require("decompress");
const fs = require("fs");
const EventEmitter = require("events").EventEmitter;

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

function prepareBinaries(manifest) {
    const eventEmitter = new EventEmitter();
    const flashContents = manifest.flash;
    let body;
    let contentLength;
    request(manifest.download)
        .on("response", response => {
            contentLength = Number(response.headers["content-length"]);
        })
        .on("data", data => {
            if(body) {
                body = Buffer.concat([body, data]);
            } else {
                body = data;
            }
            const progress = {
                details: {
                    downloadedBytes: body.length,
                    downloadSize: contentLength
                },
                display: "Downloading"
            };
            eventEmitter.emit("progress", progress);
        })
        .on("complete", () => {
            decompress(body, {
                 filter: file => isBinaryFileRequired(flashContents, file.path)
            })
            .then(files => {
                files.forEach(
                    file => addBufferToBinary(flashContents, file.path, file.data)
                );
                eventEmitter.emit("complete", flashContents);
            })
            .catch(err => eventEmitter.emit("error", err));
      })
      .on("error", err => eventEmitter.emit("error", err));
    
    return eventEmitter;
}

module.exports = prepareBinaries;