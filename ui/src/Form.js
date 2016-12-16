import React from "react";
import './Form.css';

import SelectField from './SelectField';

export default (props) => {
    return <div id="form">
        <SelectField id="ports" label="Select Port:" title="Select a Serial/COM Port" values={props.ports} isDisabled={!props.readyToFlash || props.isFlashing} onChange={props.changeSelectedSerialPort} value={props.selectedPort} />
        <SelectField id="manifests" label="Select Binaries to Flash" title="Select Binaries to Flash" values={props.manifests} isDisabled={!props.readyToFlash || props.isFlashing} onChange={props.changeSelectedManifest} value={props.selectedManifest} />
        <div className="button">
            <button id="flash-button" onClick={props.flash} disabled={!props.readyToFlash || props.isFlashing} >Flash!</button>
        </div>
    </div>;
}