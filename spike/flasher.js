"use strict";

var SerialPort = require("serialport").SerialPort;
var bufferpack = require("bufferpack");
var slip = require("slip");

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

const SLIP_SUBSTITUTIONS = {
    '\xdb': '\xdb\xdd',
    '\xc0': '\xdb\xdc' 
};

const SYNC_FRAME = new Buffer("\x07\x07\x12\x20" + "\x55".repeat(32));

function slipReadParser(emitter, buffer) {
    // This is the pyramid of doom right?
    var decoder = new slip.Decoder({
        onMessage: (msg) => {
            debug("Got message!", msg);
            emitter.emit('data', msg);
        }
    });
    debug("Got buffer", buffer.length, buffer);
    decoder.decode(buffer);
}

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
                debug("Second go", error, result);
            });
        }).then(() => {
            return delay(50);
        }).then(() => {
            this.port.set({dtr: false}, (error, result) => {
                debug("Third go", error, result);
            });
        });
    }
}


class EspComm {
    constructor(config) {
        this.port = new SerialPort(config.portName, {
            baudRate: config.baudRate,
            parser: slipReadParser
        }, false);
        this.port.on('error', (error) => debug("PORT ERROR", error));
        var BoardFactory = config.BoardFactory ? config.BoardFactory : EspBoard;
        this.board = new BoardFactory(this.port);
        if (config.debug) {
            debug = config.debug;
        }
        this.isOpen = false;
        this.config = config;
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
            return this.sync();
        });
    }

    close() {
        this.port.close();
        this.isOpen = false;
    }

    calculateChecksum(data) {
        var result = 0xEF;
        for (var i = 0; i < data.length; i++) {
            result ^= data[i];
        }
        return result;
    }


    _syncAttempt() {
        debug("Syncing");
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
                // FIXME:csd - How to send break?
                // https://github.com/igrr/esptool-ck/blob/master/serialport/serialport.c#L234
                return this.sendCommand(commands.SYNC_FRAME, SYNC_FRAME)
                    .then((result) => {
                        debug("Well...I'll be", result);
                    }); 
                
           });
    }
    
    sync() {
        // Third time's a charm?
        return this._syncAttempt()
            .then(() => {
                return this._syncAttempt();   
            }).then(() => {
                return this._syncAttempt();
            });
    }
    
    write(packet) {
        // Writes a buffer using SLIP encoding
        var slipped = new Buffer(packet.length);
        slipped.write("\xc0");
        for (var i = 0; i < packet.length; i++) {
            if (packet[i] in SLIP_SUBSTITUTIONS) {
                slipped.write(SLIP_SUBSTITUTIONS[packet[i]]);
            } else {
                slipped.write(packet[i]);
            }
        }
        slipped.write("\xc0");
        this.port.write(slipped, (err, result) => {
            debug("Wrote", slipped, result);
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
                });
            }).then(() => {
                this.port.on('data', (buffer) => {
                    debug("Port got data", buffer);
                    var receiveHeader = bufferpack.unpack(formats.bootloader_packet_header, buffer.readInt8(0));
                    debug("ARRRRGGGGHHH");
                    // FIXME:csd - Sanity check here regarding direction???
                    resolve({
                        header: receiveHeader,
                        // Result follows the header
                        data: buffer.slice(8)
                    });
                });    
            });
        });
    }
}



module.exports = EspComm;

