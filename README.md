# Flasher.js
[![Build Status](https://api.travis-ci.org/thingsSDK/flasher.js.svg)](https://travis-ci.org/thingsSDK/flasher.js) 
[![Dependency Status](https://david-dm.org/thingsSDK/flasher.js.svg)](https://david-dm.org/thingsSDK/flasher.js)
[![devDependency Status](https://david-dm.org/thingsSDK/flasher.js/dev-status.svg)](https://david-dm.org/thingsSDK/flasher.js#info=devDependencies)


<img src="http://thingssdk.com/flasher.js.svg" width="180px" height="180px">


_Flasher.js_ is a tool to get JavaScript running natively on
the Internet of Things device, ESP8266. This application runs on
Windows, Mac OS X and Linux.

This tool flashes (installs) the Espruino JavaScript run time on ESP8266
EP-12 devices like the Adafruit Huzzah and Adadfruit Feather Huzzah.

-----

## Application Compatibility 

|OS|Status|
|---|:-----:|
|Windows 10| Tested |
|Windows 8.1| Tested |
|Ubuntu 14.04 LTS|Tested|
|Mac OS X 10.11|Tested|


## Device Compatibility

|Board|Status|Notes|
|---|:-----:|-------|
|[Adafruit Feather HUZZAH](https://www.adafruit.com/products/2821)|Tested|May require [driver](https://www.silabs.com/products/mcu/Pages/USBtoUARTBridgeVCPDrivers.aspx) installation. Automatically resets to bootloader mode on firmware upload.|
|[Adafruit HUZZAH](https://learn.adafruit.com/adafruit-huzzah-esp8266-breakout)|Tested|Requires [FTDI](https://www.adafruit.com/products/70) cable. To put device in to bootloader mode, hold `GPIO0` button while inserting USB in to your computer.|
|[NodeMCU V3](http://www.banggood.com/V3-NodeMcu-Lua-WIFI-Development-Board-p-992733.html)|Tested|Requires installation of ch340g driver.  Information can be found [here](http://www.wemos.cc/tutorial/get_started_in_nodemcu.html).  For Mac there can be issues installing the driver.  Work around can be found [here](https://tzapu.com/making-ch340-ch341-serial-adapters-work-under-el-capitan-os-x/).|

-------

## Run the GUI in Development

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
npm run pre-rebuild && npm run rebuild
npm start
```

### Linux

```
npm install
npm run pre-rebuild && npm run rebuild
sudo npm start
```
-------

## Contributing

We would love your contributions! Check out the [contribution guidelines](CONTRIBUTING.md).

-------

## License 

Flasher.js is released under the [MIT License](https://opensource.org/licenses/MIT)