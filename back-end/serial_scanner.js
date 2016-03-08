"use strict";

const serialport = require("serialport");
const EventEmitter = require("events");

module.exports = class SerialScanner extends EventEmitter {
    /**
     * Scans for ports and emits a "ports" event with an array of
     */
    scan() {
        serialport.list(
            (err, ports) => {
                this._listWithCallback(err,ports, () => {
                    this.ports = ports.map(this._portMap);
                    this.emit("ports", this.ports);
                });
            }
        )
    }

    checkForChanges(){
        serialport.list(
            (err, ports) => {
                this._listWithCallback(err,ports, () => {
                    let newPorts = ports.map(this._portMap);
                    this.checkDeviceRemoved(newPorts);
                    this.checkDeviceAdded(newPorts);
                    this.ports = newPorts;
                });
            }
        )
    }

    checkDeviceAdded(newPorts){
        newPorts.forEach((newPort) => {
            if(this.ports.indexOf(newPort) === - 1) {
                this.emit("deviceAdded", newPort);
            }
        });
    }

    checkDeviceRemoved(newPorts) {
        this.ports.forEach((oldPort) => {
            if(newPorts.indexOf(oldPort) === - 1) {
                this.emit("deviceRemoved", oldPort);
            }
        });
    }

    _emitError(err) {
        this.emit("error", err);
    }

    _listWithCallback(err, ports, callback) {
        if(err) {
            this._emitError(err);
        }
        else if(ports.length === 0) {
            this._emitError( new Error("No serial ports detected."));
        }
        else {
            callback();
        }
    }

    _portMap(port) {
        return port.comName;
    }


};