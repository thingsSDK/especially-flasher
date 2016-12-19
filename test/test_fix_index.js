const path = require('path');

const assert = require('chai').assert;

const {openAndFix} = require('../scripts/helpers');

describe('npm run fix-index', () => {
    it('should remove / in front of /static', () => {
        const updatedFileContents = openAndFix(path.join(__dirname, 'index.html'));
        const expectedContents = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="shortcut icon" href="/favicon.ico"><title>Flasher.js</title><link href="static/css/main.d1281cb5.css" rel="stylesheet"></head><body><div id="root"></div><script type="text/javascript" src="static/js/main.26d69339.js"></script></body></html>';
        assert(updatedFileContents === expectedContents, "expectedContents didn't match the updatedFileContents");
    });
});