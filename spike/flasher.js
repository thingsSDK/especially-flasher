var SerialPort = require("serialport").SerialPort;
var bufferpack = require("bufferpack");
var slip = require("slip");

// /path/to/esptool/esptool.py --port /dev/ttyUSB0 --baud 115200 \
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


function slipReadParser(emitter, buffer) {
        // This is the pyramid of doom right?
        var decoder = new slip.Decoder({
            onMessage: function(msg) {
                emitter.emit('data', msg);
            } 
        });
        decoder.decode(buffer);
}

function EspComm(config) {
    this.port = new SerialPort(config.portName, {
        baud: config.baud,
        parser: slipReadParser
    });
    this.config = config;
}

// TODO:csd - How to make the commands pretty?
// https://github.com/themadinventor/esptool/blob/master/esptool.py#L108
// https://github.com/igrr/esptool-ck/blob/master/espcomm/espcomm.c#L103
EspComm.prototype.sendCommand = function(command, data) {
    // ???:csd - Is this how you do OO anymore?
    var port = this.port;
    return new Promise(function(resolve, reject) {
        var sendHeader = bufferpack.pack(formats.bootloader_packet_header, {
            direction: 0x00,
            command: command,
            size: data.size(), 
        });
        port.write(slip.encode(sendHeader));
        port.write(slip.encode(data));
        port.once('data', function(buffer) {    
            var receiveHeader = bufferpack.unpack(formats.bootloader_packet_header, buffer.readInt8(0));
            // FIXME:csd - Sanity check here regarding things
            resolve({
                header: receiveHeader,
                // Result follows the header
                data: buffer.slice(8)
            });
        });
    });
}