const fs = require('fs');
const path = require('path');
const rootPath = path.join(__dirname, '..');
const nslog = path.join(rootPath, 'node_modules', 'nslog', 'build', 'Release', 'nslog.node');
const serial_port = path.join(rootPath, 'node_modules', 'serialport', 'build', 'Release', 'serialport.node');

try {
    fs.unlinkSync(nslog);
} catch(e) {
    //Eat error
}
try {
    fs.unlinkSync(serial_port);
} catch(e) {
    //Eat error
}
