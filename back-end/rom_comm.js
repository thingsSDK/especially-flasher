"use strict";

const SerialPort = require("serialport").SerialPort;
const slip = require("./streams/slip");

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

var debug = function() {};

function delay(time) {
    return new Promise((resolve) => {
        debug("Delaying for", time);
        setTimeout(resolve, time);
    });
}

function repeatPromise(times, callback) {
    let chain = Promise.resolve();
    for (let i = 0; i < times; i++) {
        chain = chain.then(() => callback());
    }
    return chain;
}


class EspBoard {
    constructor(port) {
        this.port = port;
    }

    portSet(options) {
        return new Promise((resolve, reject) => {
            debug("Setting port", options);
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
        debug("Resetting board");
        return this.portSet({rts: true, dtr:false})
            .then(() => delay(5))
            .then(() => this.portSet({rts: false, dtr: true}))
            .then(() => delay(50))
            .then(() => this.portSet({rts: false, dtr: false}));
    }
}


class RomComm {
    constructor(config) {
        if (config.debug) {
            debug = config.debug;
        }
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
        var BoardFactory = config.BoardFactory ? config.BoardFactory : EspBoard;
        this.board = new BoardFactory(this._port);
        this.config = config;
        this.isInBootLoader = false;
    }

    bindPort() {
        this._port.on('error', (error) => debug("PORT ERROR", error));
        this.in = new slip.SlipDecoder({debug: debug});
        this.out = new slip.SlipEncoder({debug: debug});
        this._port.pipe(this.in);
        this.out.pipe(this._port);
        this.in.on("data", (data) => {
            if (data.length < 8) {
                debug("Missing header");
                return;
            }
            let headerBytes = data.slice(0, 8);
            let header = this.headerPacketFrom(headerBytes);
            if (header.direction != 0x01) {
                debug("Invaid direction", header.direction);
                return;
            }
            let commandName = commandToKey(header.command);
            let body = data.slice(8, header.size);

            debug("Emitting", commandName, body);
            this.in.emit(commandName, body);
        });
    }

    open() {
        return new Promise((resolve, reject) => {
            this._port.open((error) => {
                debug("Opening port...", this._port);
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
        debug("Syncing");
        return this.sendCommand(commands.SYNC_FRAME, SYNC_FRAME, ignoreResponse)
            .then((response) => {
                if (!ignoreResponse) {
                    debug("Sync response completed!", response);
                    this.isInBootLoader = true;
                }
            });
    }

    connect() {
        return repeatPromise(5, () => this._connectAttempt())
            .then(() => this.sync())
            .then(() => this.isInBootLoader);
    }

    _connectAttempt() {
        return this.board.resetIntoBootLoader()
                .then(() => delay(100))
                // And a 5x loop here
                .then(() => repeatPromise(5, () => this._flushAndSync()));
    }

    _flushAndSync() {
        return new Promise((resolve, reject) => {
                    this._port.flush((error) => {
                        if (error) {
                            reject(error);
                        }
                        debug("Port flushed");

                        resolve();
                    });
            }).then(() => this.sync(true));
    }

    headerPacketFor(command, data) {
        // https://github.com/igrr/esptool-ck/blob/master/espcomm/espcomm.h#L49
        let buf = new ArrayBuffer(8);
        let dv = new DataView(buf);
        dv.setUint8(0, 0x00);
        dv.setUint8(1, command);
        dv.setUint16(2, data.byteLength, true);
        dv.setUint32(4, this.calculateChecksum(data), true);
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
                            debug("Draining", drainErr, results);
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
                    debug("Listening once", commandName);
                    this.in.once(commandName, (response) => {
                        resolve(response);
                    });
                } else {
                    debug("Someone is already awaiting", commandName);
                }
            }
        });
    }
}



module.exports = RomComm;

