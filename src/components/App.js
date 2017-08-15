import React, { Component } from 'react';
import { BrowserRouter as Router, Link, Switch, Route, Redirect } from 'react-router-dom';
import Infinite from 'react-infinite';

import './App.css';

import AnnoText from './AnnoText.js';
import Source from './Source.js';
import Select from './Select.js';

// import assert from 'assert';
import escape from 'escape-html';

import { createExpandedHighlightSetsMapSelector } from '../selectors';
import { getKind, customRender as annoTextCustomRender } from '../util/annotext';
import { downloadFile } from '../util/download';

const newlinesToBrs = s => s.replace(/\n/g, '<br/>');

// NewSourceForm
class NewSourceForm extends Component {
  render() {
    const kindOptions = [
      { value: 'video', label: 'Video' },
      { value: 'comic', label: 'Comic' },
    ];
    const { onNewSource } = this.props;
    return (
      <form onSubmit={e => { e.preventDefault(); onNewSource(this.kindVal); }}>
        <Select options={kindOptions} onSet={v => { this.kindVal = v; }} />
        <button type="submit">Create New Source</button>
      </form>
    );
  }
};

// HighlightSet
class HighlightSet extends Component {
  handleExportTSV = () => {
    const { highlightSet } = this.props;

    const lines = [];
    for (const context of highlightSet.contexts) {
      const fields = [];

      fields.push(context.chunkUID); // Useful as a stable UID for Anki

      // Find (latest) timestamp of highlight annotations
      const latestTimestamp = Math.max(...getKind(context.primaryAnnoText, 'highlight').map(a => a.data.timeCreated));
      fields.push(latestTimestamp);

      const clozedAnnotextHTML = annoTextCustomRender(
        context.primaryAnnoText,
        (a, inner) => {
          if (a.kind === 'ruby') {
            return ['<ruby>', ...inner, '<rp>(</rp><rt>', escape(a.data), '</rt><rp>)</rp></ruby>'];
          } else if (a.kind === 'highlight') {
            const clozeNum = parseInt(a.id, 16) % 1000000000; // this is hacky (relies on uid being hex, etc), but should work pretty well to generate a unique cloze id
            return ['{{c' + clozeNum + '::', ...inner, '}}'];
          } else {
            return inner;
          }
        },
        (c, i) => (c === '\n' ? '<br/>' : escape(c))
      ).join('');
      fields.push(clozedAnnotextHTML);

      const translations = [];
      for (const sec of context.secondaryAnnoTexts) {
        for (const at of sec.annoTexts) {
          translations.push(newlinesToBrs(escape(at.text)));
        }
      }
      fields.push(translations.join('<br/>'));

      lines.push(fields.join('\t') + '\n');
    }
    downloadFile(lines.join(''), 'voracious_export-' + highlightSet.name + '-' + Date.now() + '.tsv', 'text/tab-separated-values');
  };

  render() {
    const { highlightSet } = this.props;
    const ELEMENT_HEIGHT = 150;

    return (
      <div>
        <div>Id: {highlightSet.id}</div>
        <div>Name: <input ref={(el) => { this.nameInputElem = el; }} type="text" defaultValue={highlightSet.name} /> <button onClick={() => { this.props.onSetName(this.nameInputElem.value); }}>Set</button></div>
        <div>
          <button onClick={this.handleExportTSV}>Export TSV</button>
        </div>
        <Infinite elementHeight={ELEMENT_HEIGHT} useWindowAsScrollContainer>
          {highlightSet.contexts.map((context, i) => (
            <div key={i} style={{height: ELEMENT_HEIGHT, overflow: 'hidden'}}>
              <p>{i} {/*(new Date(timeCreated)).toLocaleString()*/}</p>
              <AnnoText annoText={context.primaryAnnoText} language={context.primaryLanguage} />
              <div>{context.secondaryAnnoTexts.map((sec, i) => (
                <div key={i}>{sec.annoTexts.map((t, i) => (
                  <AnnoText key={i} annoText={t} language={sec.language} />
                ))}</div>
              ))}</div>
            </div>
          ))}
        </Infinite>
      </div>
    );
  }
}

// NewDeckForm
class NewHighlightSetForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      setName: '',
    };
  }

  handleNameChange = (e) => {
    this.setState({setName: e.target.value});
  };

  handleSubmit = (e) => {
    e.preventDefault();
    this.props.onNewHighlightSet(this.state.setName.trim());
    this.setState({setName: ''});
  };

  render() {
    const nameIsValid = this.state.setName && (this.state.setName.trim() !== '');

    return (
      <form onSubmit={this.handleSubmit}>
        <input type="text" placeholder="New Set Name" value={this.state.setName} onChange={this.handleNameChange} />
        <button type="submit" {...(nameIsValid ? {} : {disabled: true})}>Create New Set</button>
      </form>
    );
  }
}

// App
class App extends Component {
  constructor(props) {
    super(props);
    this.expandedHighlightSetsMapSelector = createExpandedHighlightSetsMapSelector();
  }

  handleExportBackup = () => {
    // TODO: Is calling this actions method hacky? It's not an action, really. But it makes sense if we think of actions as a model, I guess.
    const backupData = JSON.stringify(this.props.actions._saveToJSONable());
    downloadFile(backupData, 'voracious_backup_' + Date.now() + '.json', 'application/json');
  };

  render() {
    const { mainState, actions } = this.props;

    const expandedHighlightSetsMap = this.expandedHighlightSetsMapSelector(mainState); // NOTE: This is an OrderedMap

    if (mainState.loading) {
      return <h1>Loading...</h1>;
    } else {
      return (
        <Router>
          <Switch>
            <Route path="/source/:id" render={({ match, history }) => {
              const sourceId = match.params.id;
              return <Source actions={actions} source={mainState.sources.get(sourceId)} onExit={() => { history.goBack(); }} highlightSets={expandedHighlightSetsMap} activeSetId={mainState.activeHighlightSetId} onSetActiveSetId={actions.setActiveHighlightSetId} onUpdateViewPosition={(pos) => { actions.setSourceViewPosition(sourceId, pos); }} onSetChunkAnnoText={(textNum, chunkId, newAnnoText) => { actions.sourceSetChunkAnnoText(sourceId, textNum, chunkId, newAnnoText) }} onDeleteMedia={(mediaNum) => { actions.sourceDeleteMedia(sourceId, mediaNum) }} onDeleteText={(textNum) => { actions.sourceDeleteText(sourceId, textNum) }} onSetName={(name) => { actions.sourceSetName(sourceId, name); }} />;
            }}/>
            <Route render={() => (
              <div>
                <nav>
                  <Link to={'/library'}>Library</Link>
                  <Link to={'/highlights'}>Highlights</Link>
                  <Link to={'/settings'}>Settings</Link>
                </nav>
                <Switch>
                  <Route path="/library" render={() => (
                    <div>
                      <h2>Library</h2>
                      <div>
                        <NewSourceForm onNewSource={actions.createSource} />
                        {mainState.sources.valueSeq().map((s) => (
                          <div key={s.id}>
                            {s.name} <small>[{s.id}]</small>
                            <Link to={'/source/' + s.id}>View</Link>
                            <button onClick={() => { if (window.confirm('Delete source "' + s.name + '" (' + s.id + ')?')) { actions.deleteSource(s.id); } }}>Delete</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}/>
                  <Route path="/highlights" render={() => {
                    return (
                      <div>
                        <h2>Highlights</h2>
                        <div>
                          <NewHighlightSetForm onNewHighlightSet={actions.createHighlightSet} />
                          {expandedHighlightSetsMap.valueSeq().map((s) => (
                            <div key={s.id}>
                              {s.name} [{s.contexts.length}] <small>[{s.id}]</small>
                              <Link to={'/highlights/' + s.id}>View</Link>
                              <button onClick={() => { actions.deleteHighlightSet(s.id); }} {...(s.contexts.length > 0 ? {disabled: true} : {})}>Delete</button>
                            </div>
                          ))}
                        </div>
                        <Switch>
                          <Route path="/highlights/:setid" render={({ match }) => {
                            const setId = match.params.setid;
                            return (
                              <div>
                                <hr/>
                                <HighlightSet actions={actions} highlightSet={expandedHighlightSetsMap.get(setId)} onSetName={(name) => { actions.highlightSetRename(setId, name); }} />
                              </div>
                            );
                          }}/>
                          <Route path="/highlights" render={() => {
                            if (mainState.activeHighlightSetId) {
                              return <Redirect to={'/highlights/' + mainState.activeHighlightSetId}/>
                            } else {
                              return <div>No sets</div>
                            }
                          }}/>
                        </Switch>
                      </div>
                    );
                  }}/>
                  <Route path="/settings" render={() => (
                    <div>
                      <h2>Settings</h2>
                      <div><button onClick={this.handleExportBackup}>Export Backup</button></div>
                    </div>
                  )}/>
                  <Redirect to="/library"/>
                </Switch>
              </div>
            )}/>
          </Switch>
        </Router>
      );
    }
  }
}

export default App;
