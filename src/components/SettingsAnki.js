import React, { Component } from 'react';

import { ankiConnectInvoke } from '../util/ankiConnect';

import './SettingsAnki.css';

export default class SettingsAnki extends Component {
  constructor(props) {
    super(props);

    this.state = {
      statusMessage: '',
      ankiModels: [],
      ankiDecks: [],
    };
  }

  componentDidMount() {
    this.updateFromAnki();
  }

  updateFromAnki = async () => {
    this.setState({statusMessage: 'Connecting to Anki...'});
    try {
      const models = await ankiConnectInvoke('modelNames', 6);
      const decks = await ankiConnectInvoke('deckNames', 6);

      models.sort();
      decks.sort();

      this.setState({
        statusMessage: 'Connected to Anki',
        ankiModels: models,
        ankiDecks: decks,
      });
    } catch (e) {
      this.setState({
        statusMessage: e.toString(),
        ankiModels: [],
        ankiDecks: [],
      });
    }
  };

  handleRefresh = async () => {
    await this.updateFromAnki();
  };

  handleChangeModel = (e) => {
    this.props.onSetPrefModel(e.target.value);
  };

  handleChangeDeck   = (e) => {
    this.props.onSetPrefDeck(e.target.value);
  };

  render() {
    const { ankiPrefs } = this.props;

    const modelOptions = [];
    if (ankiPrefs.modelName && !this.state.ankiModels.includes(ankiPrefs.modelName)) {
      modelOptions.push(ankiPrefs.modelName);
    }
    modelOptions.push(...this.state.ankiModels);

    const deckOptions = [];
    if (ankiPrefs.deckName && !this.state.ankiDecks.includes(ankiPrefs.deckName)) {
      deckOptions.push(ankiPrefs.deckName);
    }
    deckOptions.push(...this.state.ankiDecks);

    return (
      <div>
        <div className="SettingsAnki-instructions">Voracious can create Anki cards and instantly import them if you have the <a href="https://ankiweb.net/shared/info/2055492159">AnkiConnect</a> add-on installed. Make sure Anki is running with AnkiConnect installed, and then specify below how you want new cards to be created.</div>
        <div>Status: {this.state.statusMessage} <button onClick={this.handleRefresh}>Refresh</button></div>
        <div><label>Note Type{' '}
          <select value={ankiPrefs.modelName || ''} onChange={this.handleChangeModel}>
            {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
        </label></div>
        <div><label>Deck{' '}
          <select value={ankiPrefs.deckName || ''} onChange={this.handleChangeDeck}>
            {deckOptions.map((deck) => <option key={deck} value={deck}>{deck}</option>)}
          </select>
        </label></div>
      </div>
    );
  }
}
