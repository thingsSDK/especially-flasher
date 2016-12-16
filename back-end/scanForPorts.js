"use strict";

const serialport = require('serialport');

function scanForPorts(callback) {
    serialport.list(callback);
}

module.exports = scanForPorts;