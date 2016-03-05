var serialport = require("serialport");

module.exports = function getAvailablePorts(){
    return new Promise(function(resolve, reject){
        serialport.list(function (err, ports) {
            if(err) reject(err);
            else resolve(ports.map(p => { return p.comName }));
        });
  });
};
