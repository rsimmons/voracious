import React, { Component } from 'react';

import Button from './Button';
import SettingsDictionaries from './SettingsDictionaries';
import SettingsSubOrder from './SettingsSubOrder';

import './Settings.css';

export default class Settings extends Component {
  render() {
    const {mainState, actions, history} = this.props;

    return (
      <div>
        <div className="Settings-section">
          <h2 className="Settings-section-title">Collections</h2>
          <Button onClick={() => {history.push('/add_collection'); }}>Add Collection</Button>&nbsp;
        </div>
        <div className="Settings-section">
          <h2 className="Settings-section-title">Dictionaries</h2>
          <SettingsDictionaries history={history} />
        </div>
        <div className="Settings-section">
          <h2 className="Settings-section-title">Subtitle Language Order</h2>
          <SettingsSubOrder subtitleOrder={mainState.preferences.subtitleOrder} onSetOrder={order => { actions.setPreferenceSubtitleOrder(order) }} />
        </div>
      </div>
    );
  }
}
