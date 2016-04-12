"use strict";

const log = require("./logger");

/**
 * Creates delays in time. Ideal for gaurenteeing time between executions
 * between {Promise} resolve handlers.
 * @param time in milliseconds
 * @returns {Promise}
 */
function delay(time) {
    return new Promise((resolve) => {
        log.info("Delaying for %d ms", time);
        setTimeout(() => resolve(time), time);
    });
}

/**
 * Repeats a promise until a condition is met, or `maxAttempts` have occurred
 * @param callback This is a function that should return the promise to repeat
 * @param checkFn A function that will run on each go, truthy values will stop the loop
 * @param maxAttempts [OPTIONAL] Number of times this should loop.
 * @returns {Promise}
 */
function retryPromiseUntil(callback, checkFn, maxAttempts) {
    if (!callback.hasOwnProperty("attemptCount")) {
        callback.attemptCount = 0;
    }

    let result = checkFn();
    log.debug("Retrying promise...");
    if (result) {
        log.info("Check function returned", result);
        return result;
    }
    callback.attemptCount++;
    log.debug("Performing attempt", callback.attemptCount);
    if (maxAttempts && callback.attemptCount > maxAttempts) {
        log.warn("Max attempts reached exiting");
        return;
    }
    // Recursively return the promise
    return Promise.resolve()
        .then(() => callback())
        .then(() => retryPromiseUntil(callback, checkFn, maxAttempts));
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
    retryPromiseUntil: retryPromiseUntil,
    promiseChain: promiseChain
};
