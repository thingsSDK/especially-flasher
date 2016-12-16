'use strict';
const scanForPorts = require('./scanForPorts');
const flash = require('./flash');
const {ipcMain} = require('electron');


function onPortScanComplete(err, ports, event) {
    if (err) {
        event.sender.send('portError', { message: err.message });
    }
    else if (ports.length === 0) {
        event.sender.send('noPortError', { message: 'No serial ports detected.' });
    }
    else {
        event.sender.send('portsFound', ports);
    }
}

function setupScanForPorts() {
    ipcMain.on('scanForPorts', event => {
        scanForPorts(
            (err, ports) => {
                onPortScanComplete(err, ports.map(port => port.comName), event);
            }
        );
    });
}

function setupFlash() {
    ipcMain.on('flash', (event, port, manifestURL) => {
        flash(port, manifestURL, err => {
            event.sender.send('flashError', {message: err.message});
        },
        (percent, message) => {
            event.sender.send('flashProgress', {percent, message});
        },
        () => {
            event.sender.send('flashComplete');
        });
    });
}

function initializeIpcHandlers() {
    setupScanForPorts();
    setupFlash();
}

module.exports = initializeIpcHandlers;