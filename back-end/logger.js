"use strict";

const bunyan = require("bunyan");

//https://github.com/electron/electron/issues/2033#issuecomment-199263926
process.stderr.write = console.error.bind(console); 
process.stdout.write = console.log.bind(console); 

module.exports = bunyan.createLogger({
    name: "flasher.js"
});