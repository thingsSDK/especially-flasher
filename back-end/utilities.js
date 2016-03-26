"use strict";

const log = require("./logger");

function delay(time) {
    return new Promise((resolve) => {
        log.info("Delaying for %d ms", time);
        setTimeout(resolve, time);
    });
}

function repeatPromise(times, callback) {
    let chain = Promise.resolve();
    for (let i = 0; i < times; i++) {
        chain = chain.then(() => callback());
    }
    return chain;
}

module.exports = {
    delay: delay,
    repeatPromise: repeatPromise
};
