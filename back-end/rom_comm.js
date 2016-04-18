"use strict";

const EventEmitter = require("events");
const fs = require("fs");
const SerialPort = require("serialport").SerialPort;
const log = require("./logger");
const slip = require("./streams/slip");
const boards = require("./boards");
const delay = require("./utilities").delay;
const retryPromiseUntil = require("./utilities").retryPromiseUntil;
const promiseChain = require("./utilities").promiseChain;


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

const validateCommandSuccess = [
    commands.SYNC_FRAME,
    commands.FLASH_DOWNLOAD_BEGIN,
    commands.FLASH_DOWNLOAD_DATA,
    commands.FLASH_DOWNLOAD_DONE
];

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
const REQUIRED_SUCCESSFUL_SYNC_COUNT = 10;

/**
 * An abstraction of talking to the ever so finicky ESP8266 ROM.
 * Many thanks to the C library (https://github.com/igrr/esptool-ck)
 * and the Python version of the same regard (https://github.com/themadinventor/esptool/)
 * that helped suss out the weird cases.
 */
class RomComm extends EventEmitter {
    constructor(config) {
        super();
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
        var boardName = config.boardName ? config.boardName : "Esp12";
        var BoardFactory = boards[boardName];
        if (BoardFactory === undefined) {
            throw new Error("Unkown board " + boardName);
        }
        this.board = new BoardFactory(this._port);
        this.progressHandler = config.progressHandler;
        this.config = config;
    }

    bindPort() {
        this._port.on('error', error => log.error("PORT ERROR", error));
        this.in = new slip.SlipDecoder();
        this.out = new slip.SlipEncoder();
        this._port.pipe(this.in);
        this.out.pipe(this._port);
        this.in.on("data", (data) => this.handleResponse(data));
    }

    /**
     * Response from the device are eventually sensical.  Hold tight.
     */
    handleResponse(data) {
        // Data coming in here has been SLIP escaped
        if (data.length < 8) {
            log.error("Missing header");
            // Not throwing error, let it fall through
            return;
        }
        let headerBytes = data.slice(0, 8);
        let header = this.headerPacketFrom(headerBytes);
        if (header.direction != 0x01) {
            log.error("Invaid direction", header.direction);
            // Again, intentionally not throwing error, it will communicate correctly eventually
            return;
        }
        let commandName = commandToKey(header.command);
        let body = data.slice(8, 8 + header.size);
        // Most commands just return `SUCCESS` or 0x00 0x00
        if (header.command in validateCommandSuccess) {
            if (!body.equals(SUCCESS)) {
                log.error("%s returned %s", commandName, body);
                throw new Error("Invalid status from " + commandName + " was " + body);
            }
        }
        log.info("Emitting", commandName, body);
        this.emit("RECEIVED-" + commandName, body);
    }

    /**
     * Opens the port and flips into bootloader
     */
    open() {
        return new Promise((resolve, reject) => {
            this._port.open((error) => {
                log.info("Opening port...", this._port);
                if (error) {
                    reject(error);
                } else {
                    this.portIsOpen = true;
                    resolve();
                }
            });
        }).then(() => this.connect());
    }

    /**
     * Leaves bootloader mode and closes the port
     */
    close() {
        return this.flashAddress(0, 0)
            .then((result) => this.flashFinish(false))
            .then((result) => this._port.close((err) => {
                log.info("Closing port...");
                this.portIsOpen = false;
            }));
    }

    calculateChecksum(data) {
        // Magic Checksum starts with 0xEF
        var result = 0xEF;
        for (var i = 0; i < data.length; i++) {
            result ^= data[i];
        }
        return result;
    }


    /**
     * The process of syncing gets the software and hardware aligned.
     * Due to the whacky responses, you can't really wait for a proper response
     */
    sync(ignoreResponse) {
        log.info("Syncing");
        return this.sendCommand(commands.SYNC_FRAME, SYNC_FRAME, ignoreResponse)
            .then((response) => {
                if (!ignoreResponse) {
                    log.info("Sync response completed!", response);
                    this.board.isInBootLoader = true;
                }
            });
    }

    connect() {
        // Eventually responses calm down, but on initial contact, responses are not standardized.
        // This tries until break through is made.
        this._listenForSuccessfulSync();
        return retryPromiseUntil(() => this._connectAttempt(), () => this.board.isInBootLoader);
    }

    _connectAttempt() {
        return this.board.resetIntoBootLoader()
                .then(() => delay(100))
                .then(() => retryPromiseUntil(() => this._flushAndSync(), () => this.board.isInBootLoader, 10));
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

    _listenForSuccessfulSync() {
        let commandName = commandToKey(commands.SYNC_FRAME);
        let successfulSyncs = 0;

        this.on("RECEIVED-" + commandName, (response) => {
            successfulSyncs++;
            if (successfulSyncs >= REQUIRED_SUCCESSFUL_SYNC_COUNT) {
                log.info("Got enough successful syncs");
                this.board.isInBootLoader = true;
                this.removeAllListeners("RECEIVED-" + commandName);
            }
        });
    }

    /**
     * Send appropriate C struct header along with command as required
     * SEE:  https://github.com/igrr/esptool-ck/blob/master/espcomm/espcomm.h#L49
     */
    headerPacketFor(command, data) {
        let buf = new ArrayBuffer(8);
        let dv = new DataView(buf);
        let checksum = 0;
        if (command === commands.FLASH_DOWNLOAD_DATA) {
            // There are additional headers here....
            checksum = this.calculateChecksum(data.slice(16));
        } else if (command === commands.FLASH_DOWNLOAD_DONE) {
            // Nothing to see here
        } else {
            // Most commands want the checksum of the entire data packet
            checksum = this.calculateChecksum(data);
        }
        dv.setUint8(0, 0x00); // Direction, 0x00 is request
        dv.setUint8(1, command); // Command, see commands constant
        dv.setUint16(2, data.byteLength, true); // Size of request
        dv.setUint32(4, checksum, true);
        return new Buffer(buf);
    }

    /**
     * Unpack the response header
     */
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

    /**
     * Erases the area before flashing it
     */
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
        return this.sendCommand(commands.FLASH_DOWNLOAD_BEGIN, new Buffer(buffer));
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
                    let promiseFunctions = requests.map((req) => () => this.sendCommand(commands.FLASH_DOWNLOAD_DATA, req));
                    return promiseChain(promiseFunctions);
                }).then((result) => resolve(result));
        });
    }

    /**
     * Must be called after flashing has occurred to switch modes
     */
    flashFinish(reboot) {
        let buffer = new ArrayBuffer(4);
        let dv = new DataView(buffer);
        // FIXME:csd - That inverted logic is correct...probably a better variable name than reboot
        dv.setUint32(0, reboot ? 0 : 1, true);
        return this.sendCommand(commands.FLASH_DOWNLOAD_DONE, new Buffer(buffer))
            .then((result) => {
                log.info("Received result", result);
                this.board.isInBootLoader = false;
            });
    }

    /**
     * Sends defined commands to ESP8266 and patiently awaits response through asynchronous nature of
     * node-serialport.
     */
    sendCommand(command, data, ignoreResponse) {
        // https://github.com/themadinventor/esptool/blob/master/esptool.py#L108
        // https://github.com/igrr/esptool-ck/blob/master/espcomm/espcomm.c#L103
        return new Promise((resolve, reject) => {
            if (command != commands.NO_COMMAND) {
                let sendHeader = this.headerPacketFor(command, data);
                let message = Buffer.concat([sendHeader, data], sendHeader.length + data.length);
                this.out.write(message, 'buffer', (err, res) => {
                    delay(10).then(() => {
                        if (ignoreResponse) {
                            resolve("Response was ignored");
                        }
                        if (this.portIsOpen) {
                            this._port.drain((drainErr, results) => {
                                log.info("Draining after write", drainErr, results);
                            });
                        }
                    });
               });
            }
            if (!ignoreResponse) {
                let commandName = commandToKey(command);
                let key = "RECEIVED-" + commandName;
                if (this.listeners(key).length === 0) {
                    log.info("Listening once", commandName);
                    this.once(key, (response) => {
                        resolve(response);
                    });
                } else {
                    log.warn("Someone is already awaiting for %s", commandName);
                }
            }
        });
    }
}

module.exports = RomComm;