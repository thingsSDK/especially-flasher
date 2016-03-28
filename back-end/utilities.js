"use strict";

const log = require("./logger");

function delay(time) {
    return new Promise((resolve) => {
        log.info("Delaying for %d ms", time);
        setTimeout(resolve, time);
    });
}

/**
 * Repeats a promise for `times` amount.
 * `callback` is a no parameter based function that **returns** a Promise.
 */
function repeatPromise(times, callback) {
    let chain = Promise.resolve();
    // Range just used for closure based loop
    let range = new Array(times)
        .fill(0)
        .map((value, index) => index);
    range.forEach(() => {
        chain = chain.then(() => callback());
    });
    return chain;
}

/**
 * There is probably a better way to do this.  This returns a synchronized thenable chain.
 */
function promiseChain(promiseFunctions) {
    log.debug("Chaining %d promises", promiseFunctions.length);
    return promiseFunctions.reduce((prev, current, index) => {
        log.debug("Chaining promise #%d", index);
        // Lazily return the promise
        return prev.then(() => current());
    }, Promise.resolve());
}

module.exports = {
    delay: delay,
    repeatPromise: repeatPromise,
    promiseChain: promiseChain
};
