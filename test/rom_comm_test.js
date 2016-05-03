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

describe('RomComm', () => {
   const esp = new RomComm({
       portName: "/dev/ttys000",
       baud: 9600
   });
   describe('handleResponse', () => {
       // Helper function for response creation, takes *args
      const handle = function() {
        let data = new Buffer(Uint8Array.from(arguments));
        return esp.handleResponse(data);
      }
      const SUCCESS = new Buffer([0x00, 0x00]);
      it('ignores missing headers', () => {
          expect(handle(1, 8, 2)).to.be.false;
      });
      it('ensures direction', () => {
         expect(handle(114, 108, 0, 108, 156, 158, 124, 0, 140)).to.be.false;
      });
      it('emits on success', done => {
          esp.on('RECEIVED-FLASH_DOWNLOAD_BEGIN', body => {
              expect(body).to.deep.equal(SUCCESS);
              done();
          });
          // Result from flash download begin
          let result = handle(1, 2, 2, 0, 7, 7, 18, 32, 0 ,0);
          expect(result).to.be.true;
      })
   });
});
