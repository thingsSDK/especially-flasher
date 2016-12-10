import React from 'react';
import './SelectField.css';

export default props => {
    return <div className="field">
            <label htmlFor={props.id}>{props.label}</label><br />
            <select onChange={props.onChange} value={props.value} title={props.title} id={props.id} name={props.id} disabled={props.isDisabled}>
                {props.values.map(object => <option key={object.value} value={object.value}>{object.display}</option>)}
            </select>
        </div>;
}

