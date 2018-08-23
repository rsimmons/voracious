import React, { Component } from 'react';

import Button from './Button';

import './SettingsDictionaries.css';

export default class SettingsDictionaries extends Component {
  handleMove = (idx, direction) => {
    const names = [...this.props.dictionaries.keys()];

    if (direction === -1) {
      if (idx === 0) {
        throw new Error('Can\'t move first one up');
      }
      [names[idx], names[idx-1]] = [names[idx-1], names[idx]];
    } else if (direction === 1) {
      if (idx === (names.length-1)) {
        throw new Error('Can\'t move last one down');
      }
      [names[idx], names[idx+1]] = [names[idx+1], names[idx]];
    } else {
      throw new Error('Bad direction');
    }

    this.props.onSetDictionaryOrder(names);
  };

  handleDelete = (name) => {
    if (window.confirm('Are you sure you want to delete "' + name + '"?')) {
      this.props.onDeleteDictionary(name);
    }
  };

  render() {
    const {history, dictionaries, disabledDictionaries} = this.props;
    return (
      <div>
        <ul className="SettingsDictionaries-dict-list">{[...dictionaries.entries()].map(([name, info], idx) => (
          <li key={name}>&middot; <span className={disabledDictionaries.has(name) ? 'SettingsDictionaries-name-disabled' : ''}>{name}</span> {disabledDictionaries.has(name) ? (
            <button onClick={() => { this.props.onEnableDictionary(name); }}>Enable</button>
          ) : (
            <button onClick={() => { this.props.onDisableDictionary(name); }}>Disable</button>
          )} {dictionaries.size > 1 ? (
            <span><button onClick={() => { this.handleMove(idx, -1); }} disabled={idx === 0}>Move Up</button> <button onClick={() => { this.handleMove(idx, 1); }} disabled={idx === (dictionaries.size-1)}>Move Down</button></span>
          ) : null
          } {info.builtin ? (
            <span className="SettingsDictionaries-builtin-tag">(built-in)</span>
          ) : (
            <button onClick={() => { this.handleDelete(name); }}>Delete</button>
          )}</li>
        ))}</ul>
        <Button onClick={() => {history.push('/import_epwing'); }}>Import EPWING Dictionary</Button>
      </div>
    );
  }
}
