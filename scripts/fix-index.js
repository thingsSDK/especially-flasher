const fs = require('fs');
const path = require('path');
const { openAndFix } = require('./helpers');
const rootPath = path.join(__dirname, '..');
const pathToIndex = path.join(rootPath, 'front-end', 'index.html');

console.log('Fixing UI...');
const fileContents = openAndFix(pathToIndex, 'utf8');
fs.writeFileSync(pathToIndex, fileContents);
console.log('...fixed');