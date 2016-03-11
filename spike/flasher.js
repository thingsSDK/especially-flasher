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

const SYNC_FRAME = new Buffer("\x07\x07\x12\x20" + "\x55".repeat(32));

function slipReadParser(emitter, buffer) {
        // This is the pyramid of doom right?
        var decoder = new slip.Decoder({
            onMessage: function(msg) {
                emitter.emit('data', msg);
            }
        });
        debug("Got buffer", buffer.length);
        decoder.decode(buffer);
}

var debug = function() {};

// Is there a better way to do this?
function delay(time) {
    return new Promise(function(resolve, reject) {
        debug("Sleepy time", time);
        setTimeout(resolve, time);
    });
}

function EspBoard(port) {
    this.port = port;
}

EspBoard.prototype.resetIntoBootLoader = function() {
    // RTS - Request To Send
    // DTR - Data Terminal Ready
    var self = this;
    return new Promise(function(resolve, reject) {
        self.port.set({
            rts: true,
            dtr: true
        }, function(error, result) {
            if (error) {
                reject(error);
            }
            resolve(result);
        });    
    }).then(function() {
       return delay(5); 
    }).then(function() {
        self.port.set({rts: false}, function(error, result) {
            debug("Second go", error, result);
        }); 
    }).then(function() {
       return delay(250); 
    }).then(function() {
        self.port.set({dtr: false}, function(error, result) {
            debug("Third go", error, result);
        });      
    });
}

function EspComm(config) {
    this.port = new SerialPort(config.portName, {
        baudRate: config.baudRate,
        parser: slipReadParser
    }, false);
    var BoardFactory = config.BoardFactory ? config.BoardFactory : EspBoard;
    this.board = new BoardFactory(this.port);
    if (config.debug) {
        debug = config.debug;
    }
    this.isOpen = false;
    this.config = config;
}

EspComm.prototype.open = function() {
    var self = this;
    return new Promise(function(resolve, reject) {
        self.port.open(function(error) {
            debug("Opening port...", self.port);
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    }).then(function() {
        return self.sync();
    });
};

EspComm.prototype.close = function() {
    this.port.close();
    this.isOpen = false;
};

EspComm.prototype.calculateChecksum = function(data) {
    var result = 0xEF;
    for (var i = 0; i < data.length; i++) {
        result ^= data[i];
    }
    return result;
};


EspComm.prototype.sync = function() {
    var self = this;
    self.board.resetIntoBootLoader()
        .then(function() {
            return new Promise(function(resolve, reject) {
                self.port.flush(function(error) {
                    if (error) {
                        reject(error);
                    }
                    resolve();
                });
            }).then(function() {
                return self.sendCommand(commands.SYNC_FRAME, SYNC_FRAME)
                    .then(function(result) {
                        // There is some magic here
                        debug("Should we retry 7 times??");
                    });
            });
                     
        });
};

// TODO:csd - How to make the commands pretty?
// https://github.com/themadinventor/esptool/blob/master/esptool.py#L108
// https://github.com/igrr/esptool-ck/blob/master/espcomm/espcomm.c#L103
EspComm.prototype.sendCommand = function(command, data) {
    // ???:csd - Is this how you do OO anymore?
    var port = this.port;
    return new Promise(function(resolve, reject) {
        var sendHeader = bufferpack.pack(formats.bootloader_packet_header, [0x00, command, data.length, this.calculateChecksum(data)]);
        port.write(slip.encode(sendHeader));
        port.write(slip.encode(data));
        port.once('data', function(buffer) {    
            var receiveHeader = bufferpack.unpack(formats.bootloader_packet_header, buffer.readInt8(0));
            // FIXME:csd - Sanity check here regarding direction???
            resolve({
                header: receiveHeader,
                // Result follows the header
                data: buffer.slice(8)
            });
        });
    });
};


module.exports = EspComm

