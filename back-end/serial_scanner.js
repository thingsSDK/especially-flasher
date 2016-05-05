"use strict";

const serialport = require("serialport");
const EventEmitter = require("events");

class SerialScanner extends EventEmitter {
    /**
     * Scans for ports and emits a "ports" event with an array of
     */
    scan() {
        this.ports = []; //Initialize array        
        serialport.list(
            (err, ports) => {
                this._listWithCallback(err, ports, () => {
                    this.ports = ports.map(this._portMap);
                    this.emit("ports", this.ports);
                });
            }
        );
    }

    /**
     * Checks for changes after initial scan.
     * Emits deviceAdded for each device added and
     * deviceRemoved for each device removed;
     */
    checkForChanges() {
        serialport.list(
            (err, ports) => {
                this._listWithCallback(err, ports, () => {
                    const newPorts = ports.map(this._portMap);
                    this.checkDeviceRemoved(newPorts);
                    this.checkDeviceAdded(newPorts);
                    this.ports = newPorts;
                });
            }
        );
    }

    /**
     * Compares the previous scan's port list with the current port list.
     * Emits deviceAdded for each new device added.
     * @param newPorts an array of string representation of ports
     */
    checkDeviceAdded(newPorts){
        this._comparePortsWithEmittion(newPorts, this.ports, "deviceAdded");
    }

    /**
     * Compares the previous scan's port list with the current port list.
     * Emits deviceRemoved for each device removed.
     * @param newPorts an array of string representation of ports
     */
    checkDeviceRemoved(newPorts) {
        this._comparePortsWithEmittion(this.ports, newPorts, "deviceRemoved");
    }

    /**
     * Helper function to compare arrays and emit events.
     * @param arrayA
     * @param arrayB
     * @param event
     * @private
     */
    _comparePortsWithEmittion(arrayA, arrayB, event) {
        arrayA.forEach((port) => {
            if(arrayB.indexOf(port) === -1) {
                this.emit(event, port);
            }
        });
    }

    /**
     * Emits the error of err.
     * @param err
     * @private
     */
    _emitError(err) {
        this.emit("error", err);
    }

    _listWithCallback(err, ports, callback) {
        if(err) {
            this._emitError(err);
        }
        else if(ports.length === 0) {
            this._emitError(new Error("No serial ports detected."));
        }
        else {
            callback();
        }
    }

    _portMap(port) {
        return port.comName;
    }


}

module.exports = SerialScanner;