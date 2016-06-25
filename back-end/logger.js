"use strict";

const bunyan = require("bunyan");

process.stderr.write = console.error.bind(console); process.stdout.write = console.log.bind(console); 

module.exports = bunyan.createLogger({
    name: "flasher.js"
});