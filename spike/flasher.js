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

// https://en.wikipedia.org/wiki/Serial_Line_Internet_Protocol

const SLIP = {
    frameEnd: "\xc0",
    frameEscape: "\xdb",
    transposedFrameEnd: "\xdc",
    transposedFrameEscape: "\xdd"
}

const SYNC_FRAME = new Buffer("\x07\x07\x12\x20" + "\x55".repeat(32));

var debug = function() {};

function delay(time) {
    return new Promise((resolve) => {
        debug("Sleepy time", time);
        setTimeout(resolve, time);
    });
}

class EspBoard {
    constructor(port) {
        this.port = port;
    }

    resetIntoBootLoader() {
        // RTS - Request To Send
        // DTR - Data Terminal Ready
        debug("Resetting board");
        return new Promise((resolve, reject) => {
            this.port.set({
                rts: true,
                dtr: false
            }, (error, result) => {
                debug("RTS on, DTR off", error, result);
                if (error) {
                    reject(error);
                }
                resolve(result);
            });
        }).then(() => {
            return delay(5);
        }).then(() => {
            this.port.set({
                dtr: true,
                rts: false
            }, (error, result) => {
                debug("RTS off, DTR on", error, result);
            });
        }).then(() => {
            return delay(50);
        }).then(() => {
            this.port.set({dtr: false}, (error, result) => {
                debug("DTR off", error, result);
            });
        });
    }
}


class EspComm extends EventEmitter {
    constructor(config) {
        super();
        if (config.debug) {
            debug = config.debug;
        }
        this.port = this.initializePort(config);
        var BoardFactory = config.BoardFactory ? config.BoardFactory : EspBoard;
        this.board = new BoardFactory(this.port);
        this.isOpen = false;
        this.config = config;
    }
    
    initializePort(config) {
        var port = new SerialPort(config.portName, {
            baudRate: config.baudRate
        }, false);
        port.on('error', (error) => debug("PORT ERROR", error));
        port.on('data', (buffer) => {
            debug("Data received", buffer.length, buffer);
            let slipStart = buffer.indexOf(SLIP.frameEnd);
            while (slipStart >= 0) {
                debug("Suspected SLIP response", slipStart);
                let slipEnd = buffer.indexOf(SLIP.frameEnd, slipStart + 1);
                if (slipEnd > slipStart) {
                    let slipped = buffer.slice(slipStart, slipEnd);
                    this.emit("responseReceived", slipped);
                    slipStart = buffer.indexOf(SLIP.frameEnd, slipEnd + 1);
                } else {
                    slipStart = -1;
                }   
            }
        });
        this.on("responseReceived", (slipped) => {
            debug("SLIP found", slipped.length, slipped); 
        });
        return port;
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


    sync() {
        debug("Syncing");
        // FIXME:csd - How to send break?
        // https://github.com/igrr/esptool-ck/blob/master/serialport/serialport.c#L234
        return this.sendCommand(commands.SYNC_FRAME, SYNC_FRAME);
    }
    
    connect() {
        return this.board.resetIntoBootLoader()
            .then(() => {
                return delay(100)
            }).then(() => {
                return new Promise((resolve, reject) => {
                    this.port.flush((error) => {
                        if (error) {
                            reject(error);
                        }
                        debug("Port flushed");
                        resolve();
                    });
                });
            }).then(() => {
                this.sync();
            });
    }
    
    /**
     * Writes a SLIP packet to the port
     */
    write(packet) {
        // Probably larger than this due to escaping
        var slipped = new Buffer(packet.length + 2);
        slipped.write(SLIP.frameEnd);
        for (var i = 0; i < packet.length; i++) {
            if (packet[i] === SLIP.frameEnd) {
                slipped.write(SLIP.frameEscape);
                slipped.write(SLIP.transposedFrameEnd);
            } else if (packet[i] === SLIP.frameEscape) {
                slipped.write(SLIP.frameEscape);
                slipped.write(SLIP.transposedFrameEscape);
            } else {
                slipped.write(packet[i]);
            }
        }
        slipped.write(SLIP.frameEnd);
        this.port.write(slipped, (err, result) => {
            debug("Wrote", slipped.length, slipped, result);
        });
    }

    // TODO:csd - How to make the commands pretty?
    // https://github.com/themadinventor/esptool/blob/master/esptool.py#L108
    // https://github.com/igrr/esptool-ck/blob/master/espcomm/espcomm.c#L103
    sendCommand(command, data) {
        return new Promise((resolve, reject) => {
            var length = 0;
            var checksum = 0;
            if (command != commands.NO_COMMAND) {
                if (data) {
                    length = data.length;
                    checksum = this.calculateChecksum(data);
                }
                var sendHeader = bufferpack.pack(formats.bootloader_packet_header, [0x00, command, length, checksum]);
                this.write(sendHeader + data);
            }
            
            delay(5).then(() => {
                this.port.drain((err, res) => {
                    debug("Draining", err, res);
                    resolve();  
                });
            });
        });
    }
}



module.exports = EspComm;

