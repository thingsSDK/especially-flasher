"use strict";

const SerialPort = require("serialport").SerialPort;
const bufferpack = require("bufferpack");
const EventEmitter = require("events");

// ../esptool.py --port /dev/cu.SLAB_USBtoUART --baud 115200 \
//   write_flash --flash_freq 80m --flash_mode qio --flash_size 32m \
//   0x0000 "boot_v1.4(b1).bin" 0x1000 espruino_esp8266_user1.bin \
//   0x3FC000 esp_init_data_default.bin 0x3FE000 blank.bin

// Marriage of ESPTOOL-CK and ESPTOOL.py
const formats = {
    bootloader_packet_header: "<B(direction)B(command)H(size)I(checksum)"
};

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

// FIXME: SlipUtils
// https://en.wikipedia.org/wiki/Serial_Line_Internet_Protocol
const SLIP = {
    frameEnd: 0xC0,
    frameEscape: 0xDB,
    transposedFrameEnd: 0xDC,
    transposedFrameEscape: 0xDD
}

const SYNC_FRAME = new Buffer("\x07\x07\x12\x20" + "\x55".repeat(32));

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
        return this.portSet({rts: true})
            .then(() => this.portSet({dtr: false}))
            .then(() => delay(5))
            .then(() => this.portSet({rts: false}))
            .then(() => this.portSet({dtr: true}))
            .then(() => delay(50))
            //.then(() => this.portSet({dtr: false})); 
    }
}


class EspComm {
    constructor(config) {
        this.emitter = new EventEmitter();
        if (config.debug) {
            debug = config.debug;
        }
        this.port = new SerialPort(config.portName, {
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
        this.board = new BoardFactory(this.port);
        this.isOpen = false;
        this.config = config;
    }
    
    bindPort() {
        this.port.on('error', (error) => debug("PORT ERROR", error));
        this.port.on('data', (buffer) => {
            debug("Data received", buffer.length, buffer);
            // FIXME:csd - SlipUtils.findSlipMessages
            let slipStart = buffer.indexOf(SLIP.frameEnd);
            while (slipStart >= 0) {
                debug("Suspected SLIP response", slipStart);
                let slipEnd = buffer.indexOf(SLIP.frameEnd, slipStart + 1);
                if (slipEnd > slipStart) {
                    debug("Suspicion confirmed", slipStart, slipEnd);
                    let slipped = buffer.slice(slipStart, slipEnd);
                    this.emitter.emit("responseReceived", slipped);
                    slipStart = buffer.indexOf(SLIP.frameEnd, slipEnd + 1);
                } else {
                    slipStart = -1;
                }   
            }
        });
        this.emitter.on("responseReceived", (slipped) => {
            // Will report a little longer due to escaping
            // FIXME:csd - SlipUtils.decode
            let response = new Buffer(slipped.length);
            let responseLength = 0;
            for (let index = 0; index < slipped.length; index++) {
                let val = slipped[index];
                if (val === SLIP.frameEscape) {
                    // Move one past the escape char
                    index++;
                    if (slipped[index] === SLIP.transposedFrameEnd) {
                        val = SLIP.frameEnd;    
                    } else if (slipped[index] === SLIP.transposedFrameEscape) {
                        val = SLIP.frameEscape;
                    }
                }
                response[responseLength++] = val;
            }
            let headerBytes = response.slice(0, 8);
            let header = bufferpack.unpack(formats.bootloader_packet_header, headerBytes);
            debug("Header is", header);
            debugger;
            // TODO:csd Verify checksum and direction
            let commandName = commandToKey(header.command);
            let body = response.slice(8, header.size + 8);
            
            debug("Emitting", commandName, body);
            this.emitter.emit(commandName, body);    
        });
    }

    open() {
        return new Promise((resolve, reject) => {
            this.port.open((error) => {
                debug("Opening port...", this.port);
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        }).then(() => {
            return this.connect();
        });
    }

    close() {
        this.port.close();
        this.isOpen = false;
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
        // FIXME:csd - How to send break?
        // https://github.com/igrr/esptool-ck/blob/master/serialport/serialport.c#L234
        return this.sendCommand(commands.SYNC_FRAME, SYNC_FRAME, ignoreResponse).then((response) => {
                debug("Sync response completed!", response);    
            }).then(() => repeatPromise(7, () => { 
                return this.sendCommand(commands.NO_COMMAND, null, true)
            }));
    }
    
    connect() {
        return repeatPromise(5, () => this._connectAttempt())
            .then(() => this.sync());
    }
    
    _connectAttempt() {
        return this.board.resetIntoBootLoader()
                .then(() => delay(100))
                // And a 5x loop here
                .then(() => {
                    return repeatPromise(5, () => this._flushAndSync())
                });
    }
    
    _flushAndSync() {
        return new Promise((resolve, reject) => {
                    this.port.flush((error) => {
                        if (error) {
                            reject(error);
                        }
                        debug("Port flushed");
                        
                        resolve();
                    });
            }).then(() => this.sync(true));
    }
    
    /**
     * FIXME:csd SlipUtils.encode
     * Writes a SLIP packet to the port
     */
    write(packet) {
        // Probably larger than this due to escaping
        let slipped = new Buffer(packet.length + 2 + 100);
        let slippedIndex = 0;
        slipped[slippedIndex++] = SLIP.frameEnd;
        for (var i = 0; i < packet.length; i++) {
            if (packet[i] === SLIP.frameEnd) {
                slipped[slippedIndex++] = SLIP.frameEscape;
                slipped[slippedIndex++] = SLIP.transposedFrameEnd;
            } else if (packet[i] === SLIP.frameEscape) {
                slipped[slippedIndex++] = SLIP.frameEscape;
                slipped[slippedIndex++] = SLIP.transposedFrameEscape;
            } else {
                slipped[slippedIndex++] = packet[i];
            }
        }
        slipped[slippedIndex++] = SLIP.frameEnd;
        slipped = slipped.slice(0, slippedIndex);
        this.port.write(slipped, (err, result) => {
            debug("Wrote", slipped.length, slipped, result);
        });
    }

    // TODO:csd - How to make the commands pretty?
    // https://github.com/themadinventor/esptool/blob/master/esptool.py#L108
    // https://github.com/igrr/esptool-ck/blob/master/espcomm/espcomm.c#L103
    sendCommand(command, data, ignoreResponse) {
        return new Promise((resolve, reject) => {
            var length = 0;
            var checksum = 0;
            if (command != commands.NO_COMMAND) {
                if (data) {
                    length = data.length;
                    checksum = this.calculateChecksum(data);
                }
                let sendHeader = bufferpack.pack(formats.bootloader_packet_header, [0x00, command, length, checksum]);
                this.write(Buffer.concat([sendHeader, data], sendHeader.length + data.length));
            }
            
            delay(5).then(() => {
                this.port.drain((err, res) => {
                    debug("Draining", err, res);
                    if (ignoreResponse) {
                        resolve("Response was ignored");
                    }
                });
            });
            if (!ignoreResponse) {
                let commandName = commandToKey(command);
                if (this.emitter.listeners(commandName).length === 0) {
                    debug("Listening once", commandName);
                    this.emitter.once(commandName, (response) => {
                        resolve(response);
                    });    
                } else {
                    debug("Someone is already awaiting", commandName);
                }    
            }
        });
    }
}



module.exports = EspComm;

