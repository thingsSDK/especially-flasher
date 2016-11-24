import React from 'react';
import './SelectField.css';

export default (props) => {
    return <div className="field">
            <label htmlFor={props.id}>{props.label}</label><br />
            <select title={props.title} id={props.id} name={props.id} disabled={props.isDisabled}>

            </select>
        </div>;
}