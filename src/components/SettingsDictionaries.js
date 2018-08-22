import React, { Component } from 'react';

import Button from './Button';

import './SettingsDictionaries.css';

export default class SettingsDictionaries extends Component {
  handleDeleteDictionary = (name) => {
    if (window.confirm('Are you sure you want to delete "' + name + '"?')) {
      this.props.onDeleteDictionary(name);
    }
  };

  render() {
    const {history, dictionaries, disabledDictionaries} = this.props;
    return (
      <div>
        <ul className="SettingsDictionaries-dict-list">{[...dictionaries.entries()].map(([name, info]) => (
          <li key={name}>&middot; <span className={disabledDictionaries.has(name) ? 'SettingsDictionaries-name-disabled' : ''}>{name}</span> {disabledDictionaries.has(name) ? (
            <button onClick={() => { this.props.onEnableDictionary(name); }}>Enable</button>
          ) : (
            <button onClick={() => { this.props.onDisableDictionary(name); }}>Disable</button>
          )} {info.builtin ? (
            <span className="SettingsDictionaries-builtin-tag">(built-in)</span>
          ) : (
            <button onClick={() => { this.handleDeleteDictionary(name); }}>Delete</button>
          )}</li>
        ))}</ul>
        <Button onClick={() => {history.push('/import_epwing'); }}>Import EPWING Dictionary</Button>
      </div>
    );
  }
}
