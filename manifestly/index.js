"use strict";

const fs = require("fs");
const fetch = require("node-fetch");
const prepareBinaries = require("./manifest");
const log = require("../back-end/logger");
const RomComm = require("../back-end/rom_comm");

fs.readFile("./manifest.json", (err, data) => {
    if(err) throw err;
    const manifest = JSON.parse(data);
    prepareBinaries(manifest, (err, flashSpec) => {
        if(err) throw err;

        const esp = new RomComm({
            portName: "/dev/cu.SLAB_USBtoUART",
            baudRate: 115200
        });

        esp.open().then((result) => {
            log.info("ESP is open", result);
            const firstSpec = flashSpec.shift();
            let promise = esp.flashAddress(Number.parseInt(firstSpec.address), firstSpec.buffer);

            flashSpec.forEach((spec) => {
               promise = promise.then(()=> {
                   return esp.flashAddress(Number.parseInt(spec.address), spec.buffer)
               });
            });

            return promise.then(() => esp.close())
                .then((result) => log.info("Flashed to latest Espruino build!", result));
        }).catch((error) => {
            log.error("Oh noes!", error);
        });
    });
});

