# Flasher.js
[![Build Status](https://api.travis-ci.org/thingsSDK/flasher.js.svg)](https://travis-ci.org/thingsSDK/flasher.js)

![](data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjIuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCAxODAgMTgwIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCAxODAgMTgwOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+CjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+Cgkuc3Qwe2ZpbGw6bm9uZTtzdHJva2U6dXJsKCNTVkdJRF8xXyk7c3Ryb2tlLXdpZHRoOjIuNzY1MztzdHJva2UtbWl0ZXJsaW1pdDoxMDt9Cgkuc3Qxe2ZpbGw6bm9uZTtzdHJva2U6I0ZGQUI5MTtzdHJva2Utd2lkdGg6Mi43NjUzO3N0cm9rZS1taXRlcmxpbWl0OjEwO30KCS5zdDJ7ZmlsbDpub25lO3N0cm9rZTojRkZENjAwO3N0cm9rZS13aWR0aDoyLjc2NTM7c3Ryb2tlLW1pdGVybGltaXQ6MTA7fQo8L3N0eWxlPgo8Zz4KCTx0aXRsZT5GbGFzaGVyanM8L3RpdGxlPgoJCgkJPGxpbmVhckdyYWRpZW50IGlkPSJTVkdJRF8xXyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSI0OS4zNTgiIHkxPSIxNDUuMjIzIiB4Mj0iMTI3Ljg4NDIiIHkyPSIxNDUuMjIzIiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEgMCAwIDEgMCAtNTUuMjIzKSI+CgkJPHN0b3AgIG9mZnNldD0iMCIgc3R5bGU9InN0b3AtY29sb3I6I0ZGQUI5MSIvPgoJCTxzdG9wICBvZmZzZXQ9IjEiIHN0eWxlPSJzdG9wLWNvbG9yOiNGRkQ2MDAiLz4KCTwvbGluZWFyR3JhZGllbnQ+Cgk8cG9seWxpbmUgY2xhc3M9InN0MCIgcG9pbnRzPSI1Mi4xLDI3LjUgNjIuNiwyNy41IDUxLDkyLjUgNTYuNSw5Mi41IDcyLjMsNCA3Ny44LDQgNjIuMSw5Mi41IDY3LjYsOTIuNSA3OC40LDM3LjcgODMuOSwzNy43IAoJCTczLjEsOTIuNSA3OC43LDkyLjUgODUuOSw1NS40IDkxLjQsNTUuNCA2OS4zLDE3NiA3NC44LDE3NiA5MS40LDg3LjUgOTYuOSw4Ny41IDg0LjUsMTUzLjkgOTAsMTUzLjkgMTAyLjQsODcuNSAxMDgsODcuNSAKCQk5OS43LDEzNi4yIDEwNS4yLDEzNi4yIDExMy41LDg3LjUgMTE5LDg3LjUgMTE2LjgsOTkuNCAxMjcuOSw5OS40IAkiLz4KCTxjaXJjbGUgY2xhc3M9InN0MSIgY3g9IjQ4LjgiIGN5PSIyNy41IiByPSIzLjMiLz4KCTxjaXJjbGUgY2xhc3M9InN0MiIgY3g9IjEzMS4yIiBjeT0iOTkuNyIgcj0iMy4zIi8+CjwvZz4KPC9zdmc+Cg==)

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
del node_modules\serialport\build\Release\serialport.node
del node_modules\nslog\build\Release\nslog.node
npm run rebuild
npm start
```

### Linux

```
npm install
rm node_modules/serialport/build/Release/serialport.node
rm node_modules/nslog/build/Release/nslog.node
npm run rebuild
sudo npm start
```
-------

## Contributing

We would love your contributions! Check out the [contribution guidelines](CONTRIBUTING.md).

-------

## License 

Flasher.js is released under the [MIT License](https://opensource.org/licenses/MIT)