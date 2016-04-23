"use strict";

/**
 * Constants for application
 *
 * manifestList is the url that contains all possible manifests
 * pollTime is used to check for changes in the serial ports
 *
 * @type {{manifestList: string, pollTime: number}}
 */
const CONSTANTS = {
    manifestList: "http://flasher.thingssdk.com/v1/manifest-list.json",
    pollTime: 1000
};

var last_notification = "";

/************************
 * Backend dependencies.
 * Note: Paths are relative to index.html not app.js
 ************************/

const SerialScanner = require("../back-end/serial_scanner");
const PortSelect = require("./js/port_select");
const prepareBinaries = require("../back-end/prepare_binaries");
const log = require("../back-end/logger");
const RomComm = require("../back-end/rom_comm");

const serialScanner = new SerialScanner();

/************************
 * UI Elements
 ************************/

const flashButton = $("flash-button");
const appStatus = $("status");
const portsSelect = new PortSelect($("ports"));
const manifestsSelect = $("manifests");
const progressHolder = $("progressBar");
const progressBar =  $("progress");
const form = $("form");

/************************
 * Utility Functions
 ************************/

/**
 * Simple helper returns HTML element from an element's id
 *
 * @param id a string of the id of an HTML element
 * @returns {Element}
 */
function $(id) { return document.getElementById(id); }

/**
 * Processes the response from an HTTP fetch and returns the JSON promise.
 *
 * @param response from a fetch call
 * @returns {Promise}
 */
function processJSON(response) {
    return response.json();
}



/************************
 * Handle UI
************************/

flashButton.addEventListener("click", (event) => {
    disableInputs();
    fetch(manifestsSelect.value)
        .then(processJSON)
        .then(flashWithManifest);
});

/************************
 * Manage serial port events
 ************************/

 serialScanner.on("ports", (ports) => {
    portsSelect.addAll(ports);
    readyToFlash();
});

serialScanner.on("deviceAdded", (port) => {
    portsSelect.add(port);
    new Notification(`Added: ${port}!`);
});

serialScanner.on("deviceRemoved", (port) => {
    portsSelect.remove(port);
    new Notification(`Removed: ${port}!`);
});

serialScanner.on("error", onError);

/**
 * Updates UI to say it's ready
 */
function readyToFlash() {
    progressHolder.style.display = "none";
    form.style.display = "block";
    appStatus.textContent = "Ready";
    enableInputs();
}

/**
 * Enabled the serial port SELECT and flash BUTTON elements.
 */
function enableInputs() {
    portsSelect.disabled = false;
    manifestsSelect.disabled = false;
    flashButton.disabled = false;
}

function disableInputs() {
    portsSelect.disabled = true;
    manifestsSelect.disabled = true;
    flashButton.disabled = true;
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

function generateManifestList(manifestsJSON) {
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
    appStatus.textContent = "Getting latest manifests.";
    fetch(CONSTANTS.manifestList)
        .then(processJSON)
        .then(generateManifestList).catch(error => {
            setTimeout(getManifests, pollTime);
        });
}

function flashWithManifest(manifest) {
    form.style.display = "none";
    progressHolder.style.display = "block";
    appStatus.textContent = `Flashing ${portsSelect.value}`;
    const numberOfSteps = manifest.flash.length * 2;
    let currectStepNumber = 1;
    prepareBinaries(manifest, (err, flashSpec) => {
        if(err) throw err;

        const esp = new RomComm({
            portName: portsSelect.value,
            baudRate: 115200
        });

        esp.on('progress', (progress) => {
            const flashPercent = Math.round((progress.details.flashedBytes/progress.details.totalBytes) * 100);
            const processSoFar = 50; //From download and extracting.
            const flashProcess = flashPercent / 2; //To add to the overall progress
            updateProgressBar(processSoFar + flashProcess);
            appStatus.textContent = `${progress.display} - ${flashPercent}%`;

        });

        esp.open().then((result) => {
            appStatus.textContent = `Flashing device connected to ${portsSelect.value}`;
            let promise = Promise.resolve();
            return esp.flashSpecifications(flashSpec)
                .then(() => esp.close())
                .then((result) => {
                    new Notification("Flash Finished!");
                    readyToFlash();
                    log.info("Flashed to latest Espruino build!", result);
                });
        }).catch((error) => {
            new Notification("An error occured during flashing.");
            readyToFlash();
            log.error("Oh noes!", error);
        });
    }).on("entry", (progress) => {
        //For the download/extract progress. The other half is flashing.
        const extractPercent = Math.round((currectStepNumber++/numberOfSteps) * 50);
        updateProgressBar(extractPercent);
        appStatus.textContent = progress.display;
    });
}

function updateProgressBar(percent) {
    progressBar.style.width = `${percent}%`;
}

/**
 * Get's manifest list for possibilities for flashing,
 * scans serial ports and sets up timer for checking for changes.
 */
function start() {
    getManifests();
    serialScanner.scan();
    setInterval(serialScanner.checkForChanges.bind(serialScanner), CONSTANTS.pollTime);
}

/**
 * Start Application
 */
start();
