import React from "react";
import './Form.css';

import SelectField from './SelectField.js';

export default () => {
    return <div id="form">
        <SelectField id="ports" label="Select Port:" title="Select a Serial/COM Port" isDisabled={true} />
        <SelectField id="manifests" label="Select Binaries to Flash" title="Select Binaries to Flash" isDisabled={true} />
        <div className="button">
            <button id="flash-button" disabled>Flash!</button>
        </div>
    </div>;
}