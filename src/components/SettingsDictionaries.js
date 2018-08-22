import React, { Component } from 'react';

import { getLoadedDictionaries } from '../dictionary';
import Button from './Button';

import './SettingsDictionaries.css';

export default class SettingsDictionaries extends Component {
  render() {
    const {history} = this.props;
    return (
      <div>
        <ul className="SettingsDictionaries-dict-list">{[...getLoadedDictionaries().entries()].map(([name, info]) => (
          <li key={name}>&middot; {name} {info.builtin ? <span className="SettingsDictionaries-builtin-tag">(built-in)</span> : ''}</li>
        ))}</ul>
        <Button onClick={() => {history.push('/import_epwing'); }}>Import EPWING Dictionary</Button>
      </div>
    );
  }
}
