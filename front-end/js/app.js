const availableSerialPorts = require("../back-end/available_serial_ports");

function $(id) { return document.getElementById(id) }

const flashButton = $("flash-button");
const appStatus = $("status");
const portsSelect = $("ports");


flashButton.addEventListener("click", event => {
    var notification = new Notification("Flash Finished!");
});


function checkPorts() {
    appStatus.textContent = "Checking Serial/COM ports";
    availableSerialPorts()
        .then(addPortsToSelect)
        .then(readyToFlash)
        .catch(onError);

}

/**
 * Removes existing comment, adds ports to the serial port SELECT element.
 * @param ports An Array of strings.
 */
function addPortsToSelect(ports) {
    //Gets currently selected
    const previousValue = portsSelect.value;
    //Empty Select
    portsSelect.innerHTML = "";
    ports.forEach(port => {
        appendPortToSelect(port, previousValue)
    });
}

/**
 * Appends a single port to the end of serial port SELECT element.
 * @param port
 */
function appendPortToSelect(port, previousValue){
    const option = document.createElement("option");
    option.textContent = port;
    option.value = port;
    option.selected = previousValue === port;
    portsSelect.appendChild(option);
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
    new Notification(error.message);
}

/**
 * Sets up UI
 */
function init() {
    checkPorts();
    setInterval(checkPorts, 1000);
}

init();