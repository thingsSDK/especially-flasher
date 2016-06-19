const fs = require('fs');
const path = require('path');
const rootPath = path.join(__dirname, '..')
const nslog = path.join(rootPath, 'node_modules', 'nslog', 'build', 'Release', 'nslog.node');
const serial_port = path.join(rootPath, 'node_modules', 'serialport', 'build', 'Release', 'serialport.node');

fs.unlinkSync(nslog);
fs.unlinkSync(serial_port);