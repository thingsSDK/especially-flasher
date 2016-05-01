'use strict';

const expect = require('chai').expect;
const RomComm = require('../back-end/rom_comm');

describe('ESP8266', () => {
    const boards = require('../back-end/boards');
    it('defaults to the Esp12', () => {
        var esp = new RomComm({
            portName: 'TEST'
        });
        expect(esp.board).to.be.an.instanceof(boards.Esp12);
    });
});
