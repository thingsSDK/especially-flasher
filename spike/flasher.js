var SerialPort = require("serialport").SerialPort;
var binary = require("binary");
var slip = require("slip");

// /path/to/esptool/esptool.py --port /dev/ttyUSB0 --baud 115200 \
//   write_flash --flash_freq 80m --flash_mode qio --flash_size 32m \
//   0x0000 "boot_v1.4(b1).bin" 0x1000 espruino_esp8266_user1.bin \
//   0x3FC000 esp_init_data_default.bin 0x3FE000 blank.bin


function slipReadParser(emitter, buffer) {
        // This is the pyramid of doom right?
        var decoder = new slip.Decoder({
            onMessage: function(msg) {
                emitter.emit('data', msg);
            } 
        });
        decoder.decode(buffer);
}

function EspROM(config) {
    this.port = new SerialPort(config.portName, {
        baud: config.baud,
        parser: slipReadParser
    });
    this.config = config;
}

// TODO:csd - How to make the commands pretty?
// https://github.com/themadinventor/esptool/blob/master/esptool.py#L108
EspROM.prototype.request = function(req) {
    var port = this.port;
    return new Promise(function(resolve, reject) {
        port.write(slip.encode(req));
        port.once('data', resolve);
    });
}