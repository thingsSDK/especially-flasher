"use strict";

const fs = require("fs");
const SerialPort = require("serialport").SerialPort;
const log = require("./logger");
const slip = require("./streams/slip");
const delay = require("./utilities").delay;
const repeatPromise = require("./utilities").repeatPromise;
const promiseChain = require("./utilities").promiseChain;


// ../esptool.py --port /dev/cu.SLAB_USBtoUART --baud 115200 \
//   write_flash --flash_freq 80m --flash_mode qio --flash_size 32m \
//   0x0000 "boot_v1.4(b1).bin" 0x1000 espruino_esp8266_user1.bin \
//   0x3FC000 esp_init_data_default.bin 0x3FE000 blank.bin

const commands = {
    CMD0: 0x00,
    CMD1: 0x01,
    FLASH_DOWNLOAD_BEGIN: 0x02,
    FLASH_DOWNLOAD_DATA: 0x03,
    FLASH_DOWNLOAD_DONE: 0x04,
    RAM_DOWNLOAD_BEGIN: 0x05,
    RAM_DOWNLOAD_END: 0x06,
    RAM_DOWNLOAD_DATA: 0x07,
    SYNC_FRAME: 0x08,
    WRITE_REGISTER: 0x09,
    READ_REGISTER: 0x0A,
    SET_FLASH_PARAMS: 0x0B,
    NO_COMMAND: 0xFF
};

function commandToKey(command) {
    // value to key
    return Object.keys(commands).find((key) => commands[key] === command);
}

const SYNC_FRAME = new Buffer([0x07, 0x07, 0x12, 0x20,
                        0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
                        0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
                        0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
                        0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55]);

const FLASH_BLOCK_SIZE = 0x400;
const SUCCESS = new Buffer([0x00, 0x00]);

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

class Esp12 {
    // --flash_freq 80m --flash_mode qio --flash_size 32m
    constructor(port) {
        this.port = port;
        this.flashFrequency = "80m";
        this.flashMode = "qio";
        this.flashSize = "32m";
    }

    flashInfoAsBytes() {
        let buffer = new ArrayBuffer(2);
        let dv = new DataView(buffer);
        dv.setUint8(0, FLASH_MODES[this.flashMode]);
        dv.setUint8(1, FLASH_SIZES[this.flashSize] + FLASH_FREQUENCIES[this.flashFrequency]);
        return new Buffer(buffer);
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


class RomComm {
    constructor(config) {
        this._port = new SerialPort(config.portName, {
            baudRate: config.baudRate,
            parity: 'none',
            stopBits: 1,
            xon: false,
            xoff: false,
            rtscts: false,
            dsrdtr: false
        }, false);
        this.bindPort();
        var BoardFactory = config.BoardFactory ? config.BoardFactory : Esp12;
        this.board = new BoardFactory(this._port);
        this.config = config;
        this.isInBootLoader = false;
    }

    bindPort() {
        this._port.on('error', error => log.error("PORT ERROR", error));
        this.in = new slip.SlipDecoder();
        this.out = new slip.SlipEncoder();
        this._port.pipe(this.in);
        this.out.pipe(this._port);
        this.in.on("data", (data) => {
            if (data.length < 8) {
                log.error("Missing header");
                return;
            }
            let headerBytes = data.slice(0, 8);
            let header = this.headerPacketFrom(headerBytes);
            if (header.direction != 0x01) {
                log.error("Invaid direction", header.direction);
                return;
            }
            let commandName = commandToKey(header.command);
            let body = data.slice(8, 8 + header.size);

            log.info("Emitting", commandName, body);
            this.in.emit(commandName, body);
        });
    }

    open() {
        return new Promise((resolve, reject) => {
            this._port.open((error) => {
                log.info("Opening port...", this._port);
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        }).then(() => this.connect());
    }

    close() {
        // TODO: Remove from boot loader
        this._port.close();
    }

    calculateChecksum(data) {
        // Magic Checksum starts with 0xEF
        var result = 0xEF;
        for (var i = 0; i < data.length; i++) {
            result ^= data[i];
        }
        return result;
    }


    sync(ignoreResponse) {
        log.info("Syncing");
        return this.sendCommand(commands.SYNC_FRAME, SYNC_FRAME, ignoreResponse)
            .then((response) => {
                if (!ignoreResponse) {
                    log.info("Sync response completed!", response);
                    this.isInBootLoader = true;
                }
            });
    }

    connect() {
        return repeatPromise(5, () => {
            if (this.isInBootLoader) {
                log.info("In Bootloader not re-connecting");
                return true;
            } else {
                return this._connectAttempt();
            }
        }).then(() => this.sync())
        .then(() => this.isInBootLoader);
    }

    _connectAttempt() {
        return this.board.resetIntoBootLoader()
                .then(() => delay(100))
                // And a 5x loop here
                .then(() => repeatPromise(5, () => {
                    if (this.isInBootLoader) {
                        log.info("In Bootloader not syncing");
                        return true;
                    } else {
                        return this._flushAndSync();
                    }
                }));
    }

    _flushAndSync() {
        return new Promise((resolve, reject) => {
                    this._port.flush((error) => {
                        if (error) {
                            reject(error);
                        }
                        log.info("Port flushed");

                        resolve();
                    });
            }).then(() => this.sync(true));
    }

    headerPacketFor(command, data) {
        // https://github.com/igrr/esptool-ck/blob/master/espcomm/espcomm.h#L49
        let buf = new ArrayBuffer(8);
        let dv = new DataView(buf);
        let checksum = 0;
        if (command === commands.FLASH_DOWNLOAD_DATA) {
            // There are additional headers here....
            checksum = this.calculateChecksum(data.slice(16));
        } else if (command === commands.FLASH_DOWNLOAD_DONE) {
            // Nothing to see here
        } else {
            checksum = this.calculateChecksum(data);
        }
        dv.setUint8(0, 0x00);
        dv.setUint8(1, command);
        dv.setUint16(2, data.byteLength, true);
        dv.setUint32(4, checksum, true);
        return new Buffer(buf);
    }

    headerPacketFrom(buffer) {
        let header = {};
        header.direction = buffer.readUInt8(0);
        header.command = buffer.readUInt8(1);
        header.size = buffer.readUInt16LE(2);
        header.checksum = buffer.readUInt32LE(4);
        return header;
    }

    determineNumBlocks(blockSize, length) {
        return Math.floor((length + blockSize - 1) / blockSize);
    }

    prepareFlashAddress(address, size) {
        log.info("Preparing flash address", address, size);
        let numBlocks = this.determineNumBlocks(FLASH_BLOCK_SIZE, size);
        let sectorsPerBlock = 16;
        let sectorSize = 4096;
        let numSectors = Math.floor((size + sectorSize - 1) / sectorSize);
        let startSector = Math.floor(address / sectorSize);
        // Leave some room for header space
        let headSectors = sectorsPerBlock - (startSector % sectorsPerBlock);
        if (numSectors < headSectors) {
            headSectors = numSectors;
        }
        let eraseSize = (numSectors - headSectors) * sectorSize;
        // TODO:csd - Research this...
        /* SPIEraseArea function in the esp8266 ROM has a bug which causes extra area to be erased.
            If the address range to be erased crosses the block boundary,
            then extra head_sector_count sectors are erased.
            If the address range doesn't cross the block boundary,
            then extra total_sector_count sectors are erased.
        */
        if (numSectors < (2 * headSectors)) {
            eraseSize = ((numSectors + 1) / 2) * sectorSize;
        }
        var buffer = new ArrayBuffer(16);
        var dv = new DataView(buffer);
        dv.setUint32(0, eraseSize, true);
        dv.setUint32(4, numBlocks, true);
        dv.setUint32(8, FLASH_BLOCK_SIZE, true);
        dv.setUint32(12, address, true);
        return this.sendCommand(commands.FLASH_DOWNLOAD_BEGIN, new Buffer(buffer))
            .then((result) => {
                log.info("Flash download received back", result);
                if (result.equals(SUCCESS)) {
                    return true;
                } else {
                    log.error("Invalid response", result);
                    throw Error("Received unknown response: " + result);
                }
            });
    }

    flashAddressFromFile(address, fileName) {
        return new Promise((resolve, reject) => {
            fs.readFile(fileName, (err, data) => {
               if (err) {
                   reject(err);
               }
               return this.flashAddress(address, data)
                    .then((result) => resolve(result));
            });
        });
    }

    flashAddress(address, data) {
        return new Promise((resolve, reject) => {
            this.prepareFlashAddress(address, data.length)
                .then(() => {
                    let numBlocks = this.determineNumBlocks(FLASH_BLOCK_SIZE, data.length);
                    let requests = [];
                    for (let seq = 0; seq < numBlocks; seq++) {
                        let startIndex = seq * FLASH_BLOCK_SIZE;
                        let endIndex = Math.min((seq + 1) * FLASH_BLOCK_SIZE, data.length);
                        let block = data.slice(startIndex, endIndex);
                        // On the first block of the first sequence, override the flash info...
                        if (address === 0 && seq === 0 && block[0] === 0xe9) {
                            // ... which lives in the 3rd and 4th bytes
                            let flashInfoBuffer = this.board.flashInfoAsBytes();
                            block[2] = flashInfoBuffer[0];
                            block[3] = flashInfoBuffer[1];
                        }
                        // On the last block
                        if (endIndex === data.length) {
                            // Pad the remaining bits
                            let padAmount = FLASH_BLOCK_SIZE - block.length;
                            block = Buffer.concat([block, new Buffer(padAmount).fill(0xFF)]);
                        }
                        var buffer = new ArrayBuffer(16);
                        var dv = new DataView(buffer);
                        dv.setUint32(0, block.length, true);
                        dv.setUint32(4, seq, true);
                        dv.setUint32(8, 0, true);  // Uhhh
                        dv.setUint32(12, 0, true);  // Uhhh
                        requests.push(Buffer.concat([new Buffer(buffer), block]));
                    }
                    let promiseFunctions = requests.map((req) => () => this.sendCommand(commands.FLASH_DOWNLOAD_DATA, req)
                        .then((result) => {
                            if (result.equals(SUCCESS)) {
                                console.info("Successful flash download");
                                return true;
                            } else {
                                console.error("Flash download fail", result);
                                throw new Error("Flash download fail", result);
                            }
                        }));
                    return promiseChain(promiseFunctions);
                }).then((result) => resolve(result));
        });
    }

    flashFinish(reboot) {
        let buffer = new ArrayBuffer(4);
        let dv = new DataView(buffer);
        // ???:csd - That flip is correct...probably a better word
        dv.setUint32(0, reboot ? 0 : 1, true);
        return this.sendCommand(commands.FLASH_DOWNLOAD_DONE, new Buffer(buffer))
            .then((result) => {
                log.info("Received result", result);
                this.isInBootLoader = false;
            });
    }


    // https://github.com/themadinventor/esptool/blob/master/esptool.py#L108
    // https://github.com/igrr/esptool-ck/blob/master/espcomm/espcomm.c#L103
    sendCommand(command, data, ignoreResponse) {
        return new Promise((resolve, reject) => {
            if (command != commands.NO_COMMAND) {
                let sendHeader = this.headerPacketFor(command, data);
                let message = Buffer.concat([sendHeader, data], sendHeader.length + data.length);
                this.out.write(message, 'buffer', (err, res) => {
                    delay(5).then(() => {
                        this._port.drain((drainErr, results) => {
                            log.info("Draining", drainErr, results);
                            if (ignoreResponse) {
                                resolve("Response was ignored");
                            }
                        });
                    });
               });
            }
            if (!ignoreResponse) {
                let commandName = commandToKey(command);
                if (this.in.listeners(commandName).length === 0) {
                    log.info("Listening once", commandName);
                    this.in.once(commandName, (response) => {
                        resolve(response);
                    });
                } else {
                    log.info("Someone is already awaiting", commandName);
                }
            }
        });
    }
}



module.exports = RomComm;