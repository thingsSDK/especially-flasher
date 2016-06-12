"use strict";

class PortSelect {
    /**
     * PortSelect constructor. Requires an HTML select element.
     * @param selectElement an HTMLSelectElement.
     */
    constructor(selectElement) {
        this.selectElement = selectElement;
        this.map = {}; // Cache matching the text value of a port to OPTION element.
    }

    /**
     * Appends a single port to the end of serial port SELECT element.
     * Adds port to map.
     * @param port
     */
    add(port) {
        const option = this.createOption(port);
        this.map[port] = option;
        this.selectElement.appendChild(option);
    }

    /**
     * Removed single port from the serial port SELECT element.
     * Removes port from map.
     * @param port
     */
    remove(port) {
        this.selectElement.removeChild(this.map[port]);
        delete this.map[port];
    }

    /**
     * Removes existing comment, adds ports to the serial port SELECT element.
     * @param ports. An Array of strings.
     */
    addAll(ports) {
        ports.forEach(port => {
            this.add(port);
        });
    }

    /**
     * Creates option with the port text and value.
     * @param port
     * @returns {Element}
     */
    createOption(port) {
        const option = document.createElement("option");
        option.textContent = port;
        option.value = port;
        return option;
    }

    /**
     * Pass through.
     * Updates the disabled attribute on the SELECT element.
     * @param value
     */
    set disabled (value) {
        this.selectElement.disabled = value;
    }

    /**
     * Pass through
     * @returns the selectElememnt's value.
     */
    get value() {
        return this.selectElement.value;
    }

    get children() {
        return this.selectElement.children;
    }
};

module.exports = PortSelect;