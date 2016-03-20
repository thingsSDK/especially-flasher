"use strict";

class ManifestPreparer {
    constructor(options) {
        this.recipes = options.recipes;
        this.download = options.download;
    }

    prepare() {
        console.dir(this.recipes);
    }

    unzip(source, files) {

    }

    untar(source, files) {

    }

    flash() {

    }

    updateAddresses(){

    }
}


module.exports = {ManifestPreparer};