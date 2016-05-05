# Flasher.js
[![Build Status](https://api.travis-ci.org/thingsSDK/flasher.js.svg)](https://travis-ci.org/thingsSDK/flasher.js)

_Flasher.js_ is a tool to get JavaScript running natively on
the Internet of Things device, ESP8266. This application runs on
Windows, Mac OS X and Linux.

This tool flashes (installs) the Espruino JavaScript run time on ESP8266
EP-12 devices like the Adafruit Huzzah and Adadfruit Feather Huzzah.

-------

## Run the GUI

### OS X

```bash
npm install
npm start
```

### Windows 10

You'll need installed:

* Visual Studio Community Edition (or better) installed with Windows 8/8.1 SDK.
* Python 2.7

```
npm install
del node_modules\serialport\build\Release\serialport.node
del node_modules\nslog\build\Release\nslog.node
npm run rebuild
npm start
```

-------

## ROM Communication

The ESP8266 is notoriously finicky about being flashed, we've done our best to abstract that for you.

Here is an example of flashing the ESP8266 with the latest Espruino build.

```javascript
const log = require("./logger");

const esp = new RomComm({
    portName: "/dev/cu.SLAB_USBtoUART",
    baudRate: 115200
});

esp.open().then((result) => {
    log.info("ESP is open", result);
    esp.flashAddressFromFile(0x0000, "/path/to/binaries/boot_v1.4(b1).bin")
        .then(() => esp.flashAddressFromFile(0x1000, "/path/to/binaries/espruino_esp8266_user1.bin"))
        .then(() => esp.flashAddressFromFile(0x3FC000, "/path/to/binaries/esp_init_data_default.bin"))
        .then(() => esp.flashAddressFromFile(0x3FE000, "/path/to/binaries/blank.bin"))
        .then(() => esp.close())
        .then((result) => log.info("Flashed to latest Espruino build!", result));
}).catch((error) => {
    log.error("Oh noes!", error);
});
```

See also `RomComm.flashAddress` for passing just a buffer representation of the file.

We are using [Bunyan](https://github.com/trentm/node-bunyan) for logging, make sure to pipe it through the parser.

-------

## Contributing

If you want to contribute to the Flasher.js clone this repo and
 run the following commands.

```bash
npm install
npm start
```