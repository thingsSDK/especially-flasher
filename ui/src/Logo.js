import React from 'react';
import './Logo.css';
const points = '52,28 63,28 51,93 57,93 72,4 78,4 62,93 68,93 78,38 84,38,73,93 79,93 86,55 91,55 69,176 75,176 91,88 97,88 85,154 90,154 102,88 108,88,100,136 105,136 114,88 119,88 117,99 128,99';
const hidden = { opacity: 0 };
const visible = { opacity: 1 };

function backgroundCSS(percent) {
    if (percent >= 100) {
        return hidden;
    } else {
        return visible;
    }
}

function firstDotCSS(percent) {
    if(percent > 0 ) {
        return visible;
    } else {
        return hidden;
    }
}

function lastDotCSS(percent) {
    if(percent < 100) {
        return hidden;
    } else {
        return visible;
    }
}

function pointsForPercent(percent) {

    const pointsArray = points.split(" ");
    const upto = pointsArray.length * (percent / 100);
    const showPoints = pointsArray.filter((points, index) => index <= upto);
    return showPoints.join(' ');
}

export default (props) => {
    return <div id="logo">
        <svg version="1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 180 180">
            <g>
                <title>Flasher.js</title>
                <linearGradient id="SVGID_1_" gradientUnits="userSpaceOnUse" x1="49" y1="145" x2="128" y2="145" gradientTransform="matrix(1 0 0 1 0 -55)">
                    <stop offset="0" className='stop0' />
                    <stop offset="1" className='stop1' />
                </linearGradient>
                <polyline className='bg' style={backgroundCSS(props.percent)} points={points} />
                <circle className='bg' style={backgroundCSS(props.percent)} cx="49" cy="28" r="3" />
                <circle className='bg' style={backgroundCSS(props.percent)} cx="131" cy="100" r="3" />
                <polyline className='st0' points={pointsForPercent(props.percent)} />
                <circle className='st1' style={firstDotCSS(props.percent)} cx="49" cy="28" r="3" />
                <circle className='st2' style={lastDotCSS(props.percent)} cx="131" cy="100" r="3" />
            </g>
        </svg>
    </div>;
}
