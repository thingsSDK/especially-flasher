module.exports = {
    CODES: {
        frameEnd: 0xC0,
        frameEscape: 0xDB,
        transposedFrameEnd: 0xDC,
        transposedFrameEscape: 0xDD
    },
    
    decode: function(slipped) {
        let decoded = new Buffer(slipped.length);
        let decodedLength = 0;
        for (let index = 0; index < slipped.length; index++) {
            let val = slipped[index];
            if (val === CODES.frameEscape) {
                // Move one past the escape char
                index++;
                if (slipped[index] === CODES.transposedFrameEnd) {
                    val = CODES.frameEnd;    
                } else if (slipped[index] === CODES.transposedFrameEscape) {
                    val = CODES.frameEscape;
                }
            }
            decoded[decodedLength++] = val;
        }
        return decoded.slice(0, decodedLength);               
    }
}
