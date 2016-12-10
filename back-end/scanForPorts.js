"use strict";

const serialport = require('serialport');
const {ipcMain} = require('electron');


function onPortScanComplete(err, ports, event) {
        if (err) {
            event.sender.send('portError', err);
        }
        else if (ports.length === 0) {
            event.sender.send('noPortError', new Error("No serial ports detected."));
        }
        else {
            event.sender.send('portsFound', ports);
        }

}
function scanForPorts() {
    ipcMain.on('scanForPorts', event => {
        serialport.list(
            (err, ports) => {
                onPortScanComplete(err, ports.map(port => port.comName), event);
            }
        );
    });
}
module.exports = scanForPorts;