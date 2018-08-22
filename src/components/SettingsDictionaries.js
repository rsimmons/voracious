import React, { Component } from 'react';

import { getLoadedDictionaries, deleteDictionary } from '../dictionary';
import Button from './Button';

import './SettingsDictionaries.css';

export default class SettingsDictionaries extends Component {
  handleDeleteDictionary = (name) => {
    if (window.confirm('Are you sure you want to delete "' + name + '"?')) {
      deleteDictionary(name);
      this.forceUpdate();
    }
  };

  render() {
    const {history} = this.props;
    return (
      <div>
        <ul className="SettingsDictionaries-dict-list">{[...getLoadedDictionaries().entries()].map(([name, info]) => (
          <li key={name}>&middot; {name} {info.builtin ? (
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
