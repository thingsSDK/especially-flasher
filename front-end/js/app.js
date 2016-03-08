const SerialScanner = require("../back-end/serial_scanner");

function $(id) { return document.getElementById(id) }

const flashButton = $("flash-button");
const appStatus = $("status");
const portsSelect = $("ports");
const serialScanner = new SerialScanner();
const portToElementMap = {};
var last_notification = "";

flashButton.addEventListener("click", event => {
    var notification = new Notification("Flash Finished!");
});

serialScanner.on("ports", (ports) => {
   addPortsToSelect(ports);
   readyToFlash();
});

serialScanner.on("deviceAdded", (port) => {
    appendPortToSelect(port);
    new Notification(`Added: ${port}!`);
});

serialScanner.on("deviceRemoved", (port ) => {
    removePortFromSelect(port);
    new Notification(`Removed: ${port}!`);
});

serialScanner.on("error", onError);

/**
 * Removes existing comment, adds ports to the serial port SELECT element.
 * @param ports An Array of strings.
 */
function addPortsToSelect(ports) {
    //Empty Select
    ports.forEach(port => {
        appendPortToSelect(port);
    });
}

/**
 * Appends a single port to the end of serial port SELECT element.
 * @param port
 */
function appendPortToSelect(port){
    const option = createPortOption(port);
    portToElementMap[port] = option;
    portsSelect.appendChild(option);
}

function createPortOption(port) {
    const option = document.createElement("option");
    option.textContent = port;
    option.value = port;
    return option;
}

function removePortFromSelect(port) {
    portsSelect.removeChild(portToElementMap[port]);
    delete portToElementMap[port];
}

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

/**
 * Sets up UI
 */
function init() {
    serialScanner.scan();
    setInterval(() =>{ serialScanner.checkForChanges(); }, 1000);
}

init();