const fs = require('fs');

function openAndFix(file) {
    const fileContent = fs.readFileSync(file, 'utf-8').toString();
    const replaced = fileContent.replace(/\/static/g,'static');
    return replaced;
}


module.exports = {
    openAndFix
};