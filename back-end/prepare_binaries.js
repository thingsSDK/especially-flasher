"use strict";

const request = require("request");
const decompress = require("decompress");
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
    let body;
    const downloadRequest = request(manifest.download).on("data", data => {
        if(body) {
            body = Buffer.concat([body, data]);
        } else {
            body = data;
        }
    }).on("complete", ()=>{
        try {
         decompress(body, {
                 filter: file => isBinaryFileRequired(flashContents, file.path)
            }).then(files => {
                files.forEach(file => addBufferToBinary(flashContents, file.path, file.data)
);
                callback(null, flashContents);
            }).catch(callback);
        } catch(e){
            alert(e.message);
        }
    }).on("error", error => eventEmitter.emit("entry", {display: error.message }));
    return eventEmitter;
}

module.exports = prepareBinaries;