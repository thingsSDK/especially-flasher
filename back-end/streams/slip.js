"use strict";

const stream = require("stream");
const log = require("../logger");
const Transform = stream.Transform;
const Readable = stream.Readable;

// https://en.wikipedia.org/wiki/Serial_Line_Internet_Protocol
const CODES = {
    frameEnd: 0xC0,
    frameEscape: 0xDB,
    transposedFrameEnd: 0xDC,
    transposedFrameEscape: 0xDD
 };



class SlipDecoder extends Transform {
    constructor(options) {
        super(options);
        this._slipping = false;
        this.resetDecoded();
    }

    resetDecoded() {
        this.decodedIndex = 0;
        this.decoded = new Buffer(256);
    }

    // TODO:csd - Write flush

    _transform(chunk, encoding, done) {
        log.info("SlipDecoder._transform", encoding, chunk.length);
        for (let index = 0; index < chunk.length; index++) {
            let val = chunk[index];
            if (val === CODES.frameEnd) {
                log.debug("frameEnd detected");
                if (this._slipping) {
                    this._slipping = false;
                    // Return all of decoded
                    this.push(this.decoded.slice(0, this.decodedIndex));
                    log.debug("Resetting buffer");
                    this.resetDecoded();
                } else {
                    this._slipping = true;
                }
                continue;
            }
            if (this._slipping) {
                // Slip decoding
                if (val === CODES.frameEscape) {
                    // Move one past the escape char
                    index++;
                    if (chunk[index] === CODES.transposedFrameEnd) {
                        val = CODES.frameEnd;
                    } else if (chunk[index] === CODES.transposedFrameEscape) {
                        val = CODES.frameEscape;
                    }
                }
                this.decoded[this.decodedIndex++] = val;
            }
        }
        done();
    }
}

class SlipEncoder extends Transform {

    _transform(chunk, encoding, done) {
        log.info("SlipEncoder._transform", encoding);
        let encoded = new Buffer(chunk.length + 100);
        let encodedIndex = 0;
        encoded[encodedIndex++] = CODES.frameEnd;
        for (var i = 0; i < chunk.length; i++) {
            if (chunk[i] === CODES.frameEnd) {
                encoded[encodedIndex++] = CODES.frameEscape;
                encoded[encodedIndex++] = CODES.transposedFrameEnd;
            } else if (chunk[i] === CODES.frameEscape) {
                encoded[encodedIndex++] = CODES.frameEscape;
                encoded[encodedIndex++] = CODES.transposedFrameEscape;
            } else {
                encoded[encodedIndex++] = chunk[i];
            }
        }
        encoded[encodedIndex++] = CODES.frameEnd;
        this.push(encoded.slice(0, encodedIndex), encoding);
        done();
    }

}

module.exports = {
    SlipDecoder: SlipDecoder,
    SlipEncoder: SlipEncoder
};