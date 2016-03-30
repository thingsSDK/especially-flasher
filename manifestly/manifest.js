"use strict";
const http = require("http");
const unzip = require("unzip");
var targz = require('tar.gz');
const url = require("url");
const fs = require("fs");

class ManifestPreparer {
    constructor(options) {
        this.steps = options.steps;
        this.download = options.download;
        this._validateSteps();
    }

    prepare() {
        var unzipStep = this.steps[0]["unzip"];
        var untarStep = this.steps[1]["untar"];

        let fileName = `tmp/${this.download.split("/").pop()}`;

        const downloadRequest = http.get(this.download, (response) => {
            var body = "";
            response.pipe(unzip.Parse()).on('entry', (entry) => {
                const fileName = entry.path;
                if (unzipStep.files.indexOf(fileName) !== -1) {
                    entry.pipe(targz().createParseStream()).on('entry', (tarEntry) => {
                        const fileName = tarEntry.path.split("/").pop();
                        if (untarStep.files.indexOf(fileName) !== -1 ) {
                            tarEntry.pipe(fs.createWriteStream(`tmp/${fileName}`));
                        }
                    });
                } else {
                    entry.autodrain();
                }
            });

            response.on("error", (e) => console.error(e));
        });
    }


    unzip(source, files) {

    }


    untar(source, files) {

    }

    flash() {

    }

    /**
     * Checks if the step functionality from the manifest.json file exists
     * in the {ManifestPreparer}
     * @private
     */
    _validateSteps() {
        this.steps
            .map(this._getStepName)
            .forEach(step => {
                if (!(typeof this[step] === "function")) {
                    throw `${step} is not a valid step`;
                }
            });
    }

    _getStepName(step) {
        return Object.keys(step)[0];
    }
}


module.exports = {ManifestPreparer};