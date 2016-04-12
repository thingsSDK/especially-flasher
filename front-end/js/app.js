"use strict";

const URLS = {
    manifestList: "http://flasher.thingssdk.com/v1/manifest-list.json"
};

//Relative to index.html not app.js
const SerialScanner = require("../back-end/serial_scanner");
const PortSelect = require("./js/port_select");
const prepareBinaries = require("../back-end/prepare_binaries");
const log = require("../back-end/logger");
const RomComm = require("../back-end/rom_comm");

function $(id) { return document.getElementById(id); }

const flashButton = $("flash-button");
const appStatus = $("status");
const portsSelect = new PortSelect($("ports"));
const manifestsSelect = $("manifests");
const serialScanner = new SerialScanner();
const pollTime = 1000; // One second

var last_notification = "";

flashButton.addEventListener("click", event => {
    fetch(manifestsSelect.value)
        .then(processJSON)
        .then(flashWithManifest);
});

serialScanner.on("ports", (ports) => {
    portsSelect.addAll(ports);
    readyToFlash();
});

serialScanner.on("deviceAdded", (port) => {
    portsSelect.add(port);
    new Notification(`Added: ${port}!`);
});

serialScanner.on("deviceRemoved", (port ) => {
    portsSelect.remove(port);
    new Notification(`Removed: ${port}!`);
});

serialScanner.on("error", onError);

/**
 * Updates UI to say it's ready
 */
function readyToFlash() {
    appStatus.textContent = "Ready";
    enableInputs();
}

/**
 * Enabled the serial port SELECT and flash BUTTON elements.
 */
function enableInputs(){
    portsSelect.disabled = false;
    flashButton.disabled = false;
}

/**
 * Generic catch all error. Shows notification at the moment.
 * @param error
 */
function onError(error){
    if(last_notification !== error.message) {
        last_notification = error.message;
        new Notification(last_notification);
    }
    appStatus.textContent = error.message;
}

function processJSON(response) {
    return response.json();
}

function generateManifestList(manifestsJSON) {
    console.log(manifestsJSON); 
    manifestsJSON.options.forEach((option) => {
        option.versions.forEach((version) => {
            const optionElement = document.createElement("option");
            optionElement.textContent = `${option.name} - ${version.version}`;
            optionElement.value = version.manifest;
            manifestsSelect.appendChild(optionElement);
            manifestsSelect.disabled = false;
        });
    });
}

function getManifests() {
    fetch(URLS.manifestList)
        .then(processJSON)
        .then(generateManifestList).catch((error) => {
            console.log(error); 
            setTimeout(getManifests, pollTime);
        });
}

/**
 * Sets up UI
 */
function init() {
    getManifests();
    serialScanner.scan();
    setInterval(serialScanner.checkForChanges.bind(serialScanner), pollTime);
}

init();

function flashWithManifest(manifest) {
    console.log(portsSelect.value);
    prepareBinaries(manifest, (err, flashSpec) => {
        if(err) throw err;

        const esp = new RomComm({
            portName: portsSelect.value,
            baudRate: 115200
        });

        esp.open().then((result) => {
            log.info("ESP is open", result);
            let promise = Promise.resolve();

            flashSpec.forEach((spec) => {
               promise = promise.then(()=> {
                   return esp.flashAddress(Number.parseInt(spec.address), spec.buffer)
               });
            });

            return promise.then(() => esp.close())
                .then((result) => {
                    var notification = new Notification("Flash Finished!");        
                    log.info("Flashed to latest Espruino build!", result);
                });
        }).catch((error) => {
            log.error("Oh noes!", error);
        });
    });
}