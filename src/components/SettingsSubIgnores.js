import React, { Component } from 'react';

import './SettingsSubIgnores.css';

export default class SettingsSubIgnores extends Component {
  constructor(props) {
    super(props);

    this.state = {
      ignoresStr: props.subtitleIgnores.toArray().join(','),
    };
  }

  // Returns null if invalid
  parseIgnoresStr = () => {
    const langs = this.state.ignoresStr.split(',').map(s => s.trim()).filter(s => s);
    if (!langs.every(lang => /^[a-z]{3}$/.exec(lang))) {
      return null;
    }
    return langs;
  };

  handleChangeIgnoresStr = (e) => {
    this.setState({ignoresStr: e.target.value});
  };

  handleSet = () => {
    this.props.onSetIgnores(this.parseIgnoresStr());
  };

  render() {
    return (
      <div className="SettingsSubIgnores">
        <span>Subtitle tracks will be ignored/hidden if their language is in the following list of language codes (ISO 639-3 codes, separated by commas).</span><br />
        <input value={this.state.ignoresStr} onChange={this.handleChangeIgnoresStr} /> <button onClick={this.handleSet} disabled={!this.parseIgnoresStr()}>Set</button>
      </div>
    );
  }
}
