"use strict";
const http = require("http");
const unzip = require("unzip");
const fs = require("fs");

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
    const flashContents = manifest.flash;
    const downloadRequest = http.get(manifest.download, (response) => {
        response.pipe(unzip.Parse()).on('entry', (entry) => {
            const fileName = entry.path;
            if (isBinaryFileRequired(flashContents, fileName)) {
                let body;
                entry.on("data", function(data){
                    if(body) {
                        body = Buffer.concat([body, data]);
                    } else {
                        body = data;
                    }
                }).on("end", () => {
                    addBufferToBinary(flashContents, fileName, body);
                }).on("error", callback);

            } else {
                entry.autodrain();
            }
        }).on("close", () => {
            console.log("close");
            callback(null, flashContents);
        });
        response.on("error", callback);
    });
}

module.exports = prepareBinaries;