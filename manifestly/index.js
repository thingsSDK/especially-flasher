"use strict";

const fs = require("fs");
const fetch = require("node-fetch");
const ManifestPreparer = require("./manifest").ManifestPreparer;

fs.readFile("./manifest.json", function(err, data){
    if(err) throw err;
    let manifest = Object.assign({}, JSON.parse(data), {fetch});

    let preparer = new ManifestPreparer(manifest);

    preparer.prepare();
});

