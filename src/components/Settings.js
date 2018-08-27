import React, { Component } from 'react';

import Button from './Button';
import SettingsDictionaries from './SettingsDictionaries';
import SettingsSubOrder from './SettingsSubOrder';
import SettingsAnki from './SettingsAnki';
import SystemBrowserLink from './SystemBrowserLink.js';

import './Settings.css';

const { app } = window.require('electron').remote;

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
          <SettingsDictionaries history={history} dictionaries={mainState.dictionaries} disabledDictionaries={mainState.preferences.disabledDictionaries} onEnableDictionary={(name) => { actions.setPreferenceEnableDictionary(name); }} onDisableDictionary={(name) => { actions.setPreferenceDisableDictionary(name); }} onSetDictionaryOrder={(names) => { actions.setPreferenceDictionaryOrder(names); }} onDeleteDictionary={(name) => { actions.deleteDictionary(name); }} />
        </div>
        <div className="Settings-section">
          <h2 className="Settings-section-title">Subtitle Language Order</h2>
          <SettingsSubOrder subtitleOrder={mainState.preferences.subtitleOrder} onSetOrder={order => { actions.setPreferenceSubtitleOrder(order) }} />
        </div>
        <div className="Settings-section">
          <h2 className="Settings-section-title">Anki Export</h2>
          <SettingsAnki ankiPrefs={mainState.preferences.anki} onSetPrefModel={(n) => { actions.setPreferenceAnkiModelName(n); }} onSetPrefDeck={(n) => { actions.setPreferenceAnkiDeckName(n); }} />
        </div>
        <div className="Settings-section">
          <h2 className="Settings-section-title">Misc</h2>
          <div>You're running Voracious version {app.getVersion()}</div>
        </div>
        <div className="Settings-section">
          <h2 className="Settings-section-title">Acknowledgements</h2>
          <div>
            Voracious includes a copy of the <SystemBrowserLink href="http://www.edrdg.org/jmdict/j_jmdict.html">JMdict</SystemBrowserLink> Japanese dictionary, which is the property of the <SystemBrowserLink href="http://www.edrdg.org/">Electronic Dictionary Research and Development Group</SystemBrowserLink>, and is used in conformance with the Group's <SystemBrowserLink href="http://www.edrdg.org/edrdg/licence.html">license</SystemBrowserLink>.
          </div>
        </div>
      </div>
    );
  }
}
