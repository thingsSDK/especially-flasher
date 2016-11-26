"use strict";

const childProcess = require("child_process");
const ERROR_MESSAGES = {
    USER_NOT_IN_DIALOUT: "User not part of dialout group"
}
/**
* Checks for the if the current Linux user is part of the dialout group
* @param success callback if they are part of the dialout group
* @param failure callback if they are not part of the dialout group
*/
function checkDialout(success, failure) {
    childProcess.exec("id -Gn", (err, stdout, sterr) => {
        if(err) {
            failure(err);
        } else {
            const groups = stdout;
	    if (groups.match(/(dialout|tty|uucp)/)) {
	      success();
            } else {
                const dialoutMissingError = new Error(ERROR_MESSAGES.USER_NOT_IN_DIALOUT);
                failure(dialoutMissingError);
            }
        }        
    });
}

module.exports = checkDialout;
module.exports.ERROR_MESSAGES = ERROR_MESSAGES;
