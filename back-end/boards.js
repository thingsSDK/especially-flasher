"use strict";

const log = require("./logger");
const delay = require("./utilities").delay;

const FLASH_MODES = {
    qio: 0,
    qout: 1,
    dio: 2,
    dout: 3
};

const FLASH_FREQUENCIES = {
    "40m": 0,
    "26m": 1,
    "20m": 2,
    "80m": 0xf
};

const FLASH_SIZES = {
    "4m": 0x00,
    "2m": 0x10,
    "8m": 0x20,
    "16m": 0x30,
    "32m": 0x40,
    "16m-c1": 0x50,
    "32m-c1": 0x60,
    "32m-c2": 0x70
};

class EspBoard {
    constructor(port) {
        this.port = port;
    }

    portSet(options) {
        return new Promise((resolve, reject) => {
            log.info("Setting port", options);
            this.port.set(options, (err, result) => {
                if (err) {
                    reject(err);
                }
                resolve(result);
            });
        });
    }


    flashInfoAsBytes() {
        let buffer = new ArrayBuffer(2);
        let dv = new DataView(buffer);
        dv.setUint8(0, FLASH_MODES[this.flashMode]);
        dv.setUint8(1, FLASH_SIZES[this.flashSize] + FLASH_FREQUENCIES[this.flashFrequency]);
        return new Buffer(buffer);
    }

    resetIntoBootLoader() {
        throw new Error("Must define bootloader reset instructions");
    }

}

class Esp12 extends EspBoard {
    constructor(port) {
        super(port);
        this.flashFrequency = "80m";
        this.flashMode = "qio";
        this.flashSize = "32m";
    }

    resetIntoBootLoader() {
        // RTS - Request To Send
        // DTR - Data Terminal Ready
        log.info("Resetting board");
        return this.portSet({rts: true, dtr:false})
            .then(() => delay(5))
            .then(() => this.portSet({rts: false, dtr: true}))
            .then(() => delay(50))
            .then(() => this.portSet({rts: false, dtr: false}));
    }
}

module.exports = {
    Esp12: Esp12
};
