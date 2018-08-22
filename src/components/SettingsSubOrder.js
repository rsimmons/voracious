import React, { Component } from 'react';

import './SettingsSubOrder.css';

export default class SettingsSubOrder extends Component {
  constructor(props) {
    super(props);

    this.state = {
      orderStr: props.subtitleOrder.toArray().join(','),
    };
  }

  // Returns null if invalid
  parseOrderStr = () => {
    const langs = this.state.orderStr.split(',').map(s => s.trim());
    if (!langs.every(lang => /^[a-z]{3}$/.exec(lang))) {
      return null;
    }
    return langs;
  };

  handleChangeOrderStr = (e) => {
    this.setState({orderStr: e.target.value});
  };

  handleSet = () => {
    this.props.onSetOrder(this.parseOrderStr());
  };

  render() {
    return (
      <div className="SettingsSubOrder">
        <span>If a video has multiple subtitle tracks, they will be ordered according to the following list of language codes (ISO 639-3 codes, separated by commas). It's recommended that you put languages in increasing order of your ability.</span><br />
        <input value={this.state.orderStr} onChange={this.handleChangeOrderStr} /> <button onClick={this.handleSet} disabled={!this.parseOrderStr()}>Set</button>
      </div>
    );
  }
}
