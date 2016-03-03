var getAvailablePorts = require("./spike/available_serial_ports");

getAvailablePorts().then((ports) => {
    console.dir(ports);
}).catch(console.error);