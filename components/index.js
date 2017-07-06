import assert from 'assert';
import escape from 'escape-html';
import React, { Component, PropTypes } from 'react';
import Immutable, { Record, Map } from 'immutable';
import { createSelector } from 'reselect';
import shallowCompare from 'react-addons-shallow-compare';

import { getKindAtIndex, getKind, addAnnotation, concat as concatAnnoTexts, customRender as annoTextCustomRender, clearKindInRange } from '../util/annotext';
import { getChunksAtTime } from '../util/chunk';

const languageOptions = [
  { value: 'ja', label: 'Japanese' },
  { value: 'en', label: 'English' },
];

const newlinesToBrs = s => s.split('\n').map((o, i) => <span key={i}>{o}<br/></span>);

// Select, "uncontrolled" but watches changes
class Select extends Component {
  componentWillMount() {
    const { options, onSet } = this.props;
    if (options.length > 0) {
      onSet(options[0].value);
    }
  }

  render() {
    const { options, onSet } = this.props;
    return (
      <select onChange={e => onSet(e.target.value)}>
        {options.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
}

// ClipboardCopier
class ClipboardCopier extends Component {
  onSubmit = (e) => {
    e.preventDefault();
    // TODO: could check input is set and input.select is truthy, and wrap copy+blur in a try block
    this.inputElem.select();
    document.execCommand('copy');
    this.inputElem.blur();
  }

  render() {
    const { text, buttonText } = this.props;
    return (
      <form onSubmit={this.onSubmit}>
        <input style={{ /*width: '2em'*/ }} type="text" value={text} readOnly ref={(el) => { this.inputElem = el; }} />
        <button type="submit">{buttonText}</button>
      </form>
    );
  }
}

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

// FileChooserForm
const FileChooser = ({ label, accept, onChoose }) => (
  <label>{label} <input type="file" accept={accept} onChange={e => { onChoose(e.target.files[0]); e.target.value = null; }} /></label>
);

// VideoImportControls
class VideoImportControls extends Component {
  render() {
    const { onImportVideoFile, onImportSubsFile } = this.props;
    return (
      <div>
        <form>
          <FileChooser label="Import Video" accept="video/*" onChoose={(file) => { onImportVideoFile(file, this.videoLanguageVal); }} />
          <Select options={languageOptions} onSet={v => { this.videoLanguageVal = v; }} />
        </form>
        <form>
          <FileChooser label="Import Subs (SRT)" accept=".srt" onChoose={(file) => { onImportSubsFile(file, this.subLanguageVal); }} />
          <Select options={languageOptions} onSet={v => { this.subLanguageVal = v; }} />
        </form>
      </div>
    );
  }
}

class VideoMedia extends Component {
  constructor(props) {
    super(props);
    this.videoElem = null;
  }

  seekRelative(dt) {
    if (this.videoElem) {
      const nt = this.videoElem.currentTime + dt;
      this.videoElem.currentTime = nt >= 0 ? nt : 0;
    }
  }

  togglePause() {
    if (this.videoElem) {
      if (this.videoElem.paused) {
        this.videoElem.play();
      } else {
        this.videoElem.pause();
      }
    }
  }

  render() {
    const { media, initialTime, onTimeUpdate } = this.props;
    return (
      <div style={{ textAlign: 'center', backgroundColor: 'black' }}>{media.size ? (
        <video src={media.first().videoURL} controls onTimeUpdate={e => { onTimeUpdate(e.target.currentTime); }} ref={(el) => { this.videoElem = el; }} onLoadedMetadata={e => { e.target.currentTime = initialTime ? initialTime : 0; }} />
      ) : ''
      }</div>
    );
  }
}

class PlayControls extends Component {
  componentDidMount() {
    document.body.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    document.body.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = (e) => {
    const { onBack, onTogglePause, onHideText, onRevealMoreText } = this.props;

    if (!e.repeat) {
      switch (e.keyCode) {
        case 65: // a
          onBack();
          break;

        case 68: // d
          onHideText();
          break;

        case 70: // f
          onRevealMoreText();
          break;

        case 32: // space
          onTogglePause();
          e.preventDefault();
          break;

        default:
          // ignore
          break;
      }
    }
  }

  render() {
    const { onBack, onTogglePause, onHideText, onRevealMoreText } = this.props;
    return (
      <form style={{ textAlign: 'center', margin: '10px auto' }}>
        <button type="button" onClick={onBack}>Jump Back [A]</button>
        <button type="button" onClick={onHideText}>Hide Texts [D]</button>
        <button type="button" onClick={onRevealMoreText}>Reveal Next Text [F]</button>
        <button type="button" onClick={onTogglePause}>Play/Pause [Space]</button>
      </form>
    );
  }
}

const isAncestorNode = (potentialAncestor, given) => {
  let n = given;
  while (true) {
    if (n === potentialAncestor) {
      return true;
    }
    if (n.parentNode) {
      n = n.parentNode;
    } else {
      return false;
    }
  }
}

const CPRange = new Record({
  cpBegin: null,
  cpEnd: null,
});

class AnnoText extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectionRange: null,
      inspectedIndex: null, // codepoint index of char we're doing a "tooltip" for
    };
    this.tooltipTimeout = null; // it does not work to have this in state
    this.dragStartIndex = null; // codepoint index of character that mousedown happened on, if mouse is still down
  }

  shouldComponentUpdate(nextProps, nextState) {
    return shallowCompare(this, nextProps, nextState);
  }

  componentDidMount() {
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.handleMouseUp);

    this.clearTooltipTimeout();
    if (this.props.onSelectionChange && this.state.selectionRange) {
      this.props.onSelectionChange(null);
    }
  }

  clearTooltipTimeout() {
    if (this.tooltipTimeout) {
      window.clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
  }

  setTooltipTimeout() {
    if (this.tooltipTimeout) {
      window.clearTimeout(this.tooltipTimeout);
    }
    this.tooltipTimeout = window.setTimeout(
      () => { this.setState({ inspectedIndex: null }); this.tooltipTimeout = null; },
      500
    );
  }

  setSelRange = (newSelRange) => {
    if (!Immutable.is(newSelRange, this.state.selectionRange)) {
      this.setState({selectionRange: newSelRange});
    }
    if (this.props.onSelectionChange) {
      this.props.onSelectionChange(newSelRange);
    }
  };

  clearSelection = () => {
    this.setSelRange(null);
  }

  setSelection = (begin, end) => {
    this.setSelRange(new CPRange({cpBegin: begin, cpEnd: end}));
  }

  handleMouseUp = (e) => {
    this.dragStartIndex = null;
    document.removeEventListener('mouseup', this.handleMouseUp);
  };

  handleCharMouseDown = (e) => {
    e.preventDefault();
    const cpIndex = +e.currentTarget.getAttribute('data-index');
    this.dragStartIndex = cpIndex;
    if (this.state.selectionRange && (cpIndex >= this.state.selectionRange.cpBegin) && (cpIndex < this.state.selectionRange.cpEnd)) {
      this.clearSelection();
    } else {
      this.setSelection(cpIndex, cpIndex+1);
    }
    document.addEventListener('mouseup', this.handleMouseUp);
  };

  handleCharMouseEnter = (e) => {
    const cpIndex = +e.currentTarget.getAttribute('data-index');
    this.setState({inspectedIndex: cpIndex});
    if (this.dragStartIndex !== null) {
      let a = this.dragStartIndex;
      let b = cpIndex;
      if (b < a) {
        [a, b] = [b, a];
      }
      this.setSelection(a, b+1);
    }
    this.clearTooltipTimeout();
  };

  handleCharMouseLeave = (e) => {
    this.setTooltipTimeout();
  };

  handleSetRuby = () => {
    const { annoText, onUpdate } = this.props;
    const rubyText = this.setRubyTextInput.value.trim();
    const {cpBegin, cpEnd} = this.state.selectionRange;
    let newAnnoText = clearKindInRange(annoText, cpBegin, cpEnd, 'ruby');
    if (rubyText !== '') {
      newAnnoText = addAnnotation(newAnnoText, cpBegin, cpEnd, 'ruby', rubyText);
    }
    onUpdate(newAnnoText);
    this.clearSelection();
  };

  handleAddMark = () => {
    const { annoText, onUpdate } = this.props;
    const {cpBegin, cpEnd} = this.state.selectionRange;
    let newAnnoText = addAnnotation(annoText, cpBegin, cpEnd, 'mark', null);
    onUpdate(newAnnoText);
    this.clearSelection();
  };

  render() {
    const { annoText, language, onUpdate } = this.props;

    const inspectedIndex = this.state.inspectedIndex;
    const hitLemmaInfoElems = [];
    const hitLemmaIndexes = new Set();
    if (inspectedIndex !== null) {
      const hitLemmaAnnos = getKindAtIndex(annoText, 'lemma', inspectedIndex);
      hitLemmaAnnos.forEach((lemmaAnno) => {
        var encLemma = encodeURIComponent(lemmaAnno.data);
        hitLemmaInfoElems.push(
          <span key={`wordinfo-${lemmaAnno.cpBegin}:${lemmaAnno.cpEnd}`}>{lemmaAnno.data}<br />
            <span style={{ fontSize: '0.5em' }}>
              <a className="dict-linkout" href={'http://ejje.weblio.jp/content/' + encLemma} target="_blank">Weblio</a>{' '}
              <a className="dict-linkout" href={'http://eow.alc.co.jp/search?q=' + encLemma} target="_blank">ALC</a>{' '}
              <a className="dict-linkout" href={'http://dictionary.goo.ne.jp/srch/all/' + encLemma + '/m0u/'} target="_blank">goo</a>{' '}
              <a className="dict-linkout" href={'http://tangorin.com/general/' + encLemma} target="_blank">Tangorin</a>
            </span>
          </span>
        );
      });
      hitLemmaAnnos.forEach((lemmaAnno) => {
        for (let i = lemmaAnno.cpBegin; i < lemmaAnno.cpEnd; i++) {
          hitLemmaIndexes.add(i);
        }
      });
    }
    const selectedIndexes = new Set();
    if (this.state.selectionRange) {
      for (let i = this.state.selectionRange.cpBegin; i < this.state.selectionRange.cpEnd; i++) {
        selectedIndexes.add(i);
      }
    }

    const annoTextChildren = annoTextCustomRender(
      annoText,
      (a, inner) => {
        if (a.kind === 'ruby') {
          return [<ruby key={`ruby-${a.cpBegin}:${a.cpEnd}`}>{inner}<rp>(</rp><rt>{a.data}</rt><rp>)</rp></ruby>];
        } else if (a.kind === 'selection') {
          return [<span key={`selection-${a.cpBegin}:${a.cpEnd}`} className='annotext-selected'>{inner}</span>];
        } else if (a.kind === 'mark') {
          return [<span key={`mark-${a.cpBegin}:${a.cpEnd}`} className='annotext-marked'>{inner}</span>];
        } else {
          return inner;
        }
      },
      (c, i) => {
        if (c === '\n') {
          return <br key={`char-${i}`} />;
        } else {
          const isInspected = (i === inspectedIndex);

          const toolTipElem = (isInspected && (hitLemmaInfoElems.length > 0))
            ? <span style={{zIndex: 100}}><span className="textchar-tooltip">{hitLemmaInfoElems}</span><span className="textchar-tooltip-triangle"> </span></span>
            : '';

          const classNames = ['textchar'];
          if (isInspected) {
            classNames.push('inspected');
          }
          if (selectedIndexes.has(i)) {
            classNames.push('selected');
          } else if (hitLemmaIndexes.has(i)) {
            classNames.push('highlighted');
          }

          return <span className={classNames.join(' ')} onMouseDown={this.handleCharMouseDown} onMouseEnter={this.handleCharMouseEnter} onMouseLeave={this.handleCharMouseLeave} data-index={i} key={`char-${i}`}>{toolTipElem}{c}</span>;
        }
      }
    );

    const annoTextHTML = annoTextCustomRender(
      annoText,
      (a, inner) => {
        if (a.kind === 'ruby') {
          return ['<ruby>', ...inner, '<rp>(</rp><rt>', escape(a.data), '</rt><rp>)</rp></ruby>'];
        } else {
          return inner;
        }
      },
      (c, i) => (c === '\n' ? '<br/>' : escape(c))
    ).join('');

    const floatWidth = '10em';
    return (
      <div>
        <div style={{ float: 'right', width: floatWidth, textAlign: 'left', backgroundColor: '#eee', padding: '10px' }}>
          <ClipboardCopier text={annoTextHTML} buttonText="Copy HTML" />
          {(this.state.selectionRange && onUpdate) ? (
            <form>
              <input ref={(el) => { this.setRubyTextInput = el; }} placeholder="ruby text" /><button type="button" onClick={this.handleSetRuby} >Set Ruby</button><br />
              <button type="button" onClick={this.handleAddMark} >Add Mark</button>
              {/*
              <button type="button" className="clear-words-button">Clear Words</button><br />
              <input className="mark-word-lemma" placeholder="Lemma (if not base form)" /><button type="button" className="mark-word-button">Mark Word</button>
              */}
            </form>
          ) : ''}
        </div>
        <div style={{ margin: '0 ' + floatWidth }} lang={language} ref={(el) => { this.textContainerElem = el; }}>{annoTextChildren}</div>
      </div>
    );
  }
}

const TextChunksBox = ({ chunks, language, hidden, onChunkSelectionChange, onChunkSetAnnoText }) => (
  <div className="studied-text-box">
    <div className="language-tag">{language.toUpperCase()}</div>
    <div>{chunks.map(c => (hidden ? <div key={c.uid} style={{color: '#ccc'}}>(hidden)</div> : <AnnoText key={c.uid} annoText={c.annoText} language={language} onSelectionChange={s => { onChunkSelectionChange(c.uid, s); }} onUpdate={newAnnoText => { onChunkSetAnnoText(c.uid, newAnnoText); }} />))}</div>
  </div>
);

// Source
class Source extends Component {
  constructor(props) {
    super(props);
    this.videoMediaComponent = undefined;
    this.state = {
      textRevelation: props.source.texts.size + 1, // reveal all texts to start
      chunkSelections: new Map(), // chunkId -> CPRange
    };
  }

  handleImportVideoFile = (file, language) => {
    const {source, actions} = this.props;
    actions.sourceAddVideoFile(source.id, file, language);
  };

  handleImportSubsFile = (file, language) => {
    const {source, actions} = this.props;
    actions.sourceAddSubsFile(source.id, file, language);
  };

  handleVideoTimeUpdate = (time) => {
    this.props.onUpdateViewPosition(time);
  };

  handleBack = () => {
    if (this.videoMediaComponent) {
      this.videoMediaComponent.seekRelative(-3.0);
    }
  };

  handlePause = () => {
    if (this.videoMediaComponent) {
      this.videoMediaComponent.togglePause();
    }
  };

  handleHideText = () => {
    this.setState({textRevelation: 0});
  };

  handleRevealMoreText = () => {
    this.setState({textRevelation: Math.min(this.state.textRevelation + 1, this.props.source.texts.size)});
  };

  handleSnip = () => {
    // TODO: we could check if there are any chunk ids in this.state.chunkSelections that shouldn't be there

    const snipTexts = [];
    for (const text of this.props.source.texts) {
      const annoTexts = [];

      for (const chunk of getChunksAtTime(text.chunkSet, this.props.source.viewPosition)) {
        if (this.state.chunkSelections.has(chunk.uid)) {
          const r = this.state.chunkSelections.get(chunk.uid);
          annoTexts.push(addAnnotation(chunk.annoText, r.cpBegin, r.cpEnd, 'selection', null));
        } else {
          annoTexts.push(chunk.annoText);
        }
      }

      snipTexts.push({
        language: text.language,
        annoText: concatAnnoTexts(annoTexts),
      });
    }
    this.props.onAddSnip(this.props.snipDeckId, snipTexts);
  };

  handleChunkSelectionChange = (chunkId, selection) => {
    if (selection) {
      this.setState({chunkSelections: this.state.chunkSelections.set(chunkId, selection)});
    } else {
      this.setState({chunkSelections: this.state.chunkSelections.delete(chunkId)});
    }
  };

  render() {
    const { source, onExit, deckBriefs, snipDeckId, onSetSnipDeckId, onSourceSetChunkAnnoText } = this.props;

    // Sanity check on snipDeckId integrity
    if (deckBriefs.isEmpty()) {
      assert(!snipDeckId);
    } else {
      assert(deckBriefs.some(d => (d.id === snipDeckId)));
    }

    return (
      <div>
        <div id="source-settings">
          <div>Id {source.id}</div>
          <div>Kind: {source.kind}</div>
          <VideoImportControls onImportVideoFile={this.handleImportVideoFile} onImportSubsFile={this.handleImportSubsFile} />
          <div>Media:</div>
          <ul>{source.media.map((o, i) => <li key={i}>#{i} [{o.language}]</li>)}</ul>
          <div>Texts:</div>
          <ul>{source.texts.map((o, i) => <li key={i}>#{i} [{o.language}]</li>)}</ul>
          <button onClick={onExit}>Exit To Top</button>
        </div>
        <VideoMedia media={source.media} initialTime={this.props.source.viewPosition} onTimeUpdate={this.handleVideoTimeUpdate} ref={(c) => { this.videoMediaComponent = c; }} />
        <PlayControls onBack={this.handleBack} onTogglePause={this.handlePause} onHideText={this.handleHideText} onRevealMoreText={this.handleRevealMoreText} />
        <form style={{ textAlign: 'center', margin: '10px auto' }}>
          <select value={snipDeckId} onChange={e => onSetSnipDeckId(e.target.value)}>
            {deckBriefs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button type="button" onClick={this.handleSnip} {...(deckBriefs.isEmpty() ? {disabled: true} : {})}>Snip</button>
        </form>
        {source.texts.map((text, i) => <TextChunksBox key={i} chunks={getChunksAtTime(text.chunkSet, this.props.source.viewPosition)} language={text.language} hidden={this.state.textRevelation <= i} onChunkSelectionChange={this.handleChunkSelectionChange} onChunkSetAnnoText={(chunkId, newAnnoText) => { onSourceSetChunkAnnoText(source.id, i, chunkId, newAnnoText); }} />)}
      </div>
    );
  }
}

// Deck
class Deck extends Component {
  handleDeleteSnip = (snipId) => {
    if (window.confirm('Are you sure you want to delete this snip?')) {
      this.props.onDeleteSnip(snipId);
    }
  };

  handleExportTSV = () => {
    function download(content, filename, contentType) {
      const a = document.createElement('a');
      const blob = new Blob([content], {'type': contentType});
      a.href = window.URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    }

    const lines = [];
    for (const snip of this.props.deck.snips.values()) {
      const firstAnnoText = snip.texts.first().annoText; // TODO: unhack

      // If no selection, skip
      const sortedSelectionAnnos = getKind(firstAnnoText, 'selection');
      if (!sortedSelectionAnnos.length) {
        continue;
      }

      const fields = [];

      fields.push(snip.timeCreated); // Useful as a pseudo-uid and to sort by in Anki

      const clozedAnnotextHTML = annoTextCustomRender(
        firstAnnoText,
        (a, inner) => {
          if (a.kind === 'ruby') {
            return ['<ruby>', ...inner, '<rp>(</rp><rt>', escape(a.data), '</rt><rp>)</rp></ruby>'];
          } else if (a.kind === 'selection') {
            return ['{{c1::', ...inner, '}}'];
          } else {
            return inner;
          }
        },
        (c, i) => (c === '\n' ? '<br/>' : escape(c))
      ).join('');
      fields.push(clozedAnnotextHTML);

      const translations = snip.texts.rest().map(t => t.annoText.text).join('<br/>');
      fields.push(translations);

      lines.push(fields.join('\t') + '\n');
    }
    download(lines.join(''), 'voracious_' + Date.now() + '.tsv', 'text/tab-separated-values');
  };

  render() {
    const { deck, onExit } = this.props;
    return (
      <div>
        <div>{deck.name} <small>{deck.id}</small></div>
        <div>
          <button onClick={this.handleExportTSV}>Export TSV</button>
          <button onClick={onExit}>Exit To Top</button>
        </div>
        <div>{deck.snips.toArray().map((snip) => (
          <div key={snip.id}>
            <p>snip id {snip.id} {(new Date(snip.timeCreated)).toLocaleString()} <button onClick={() => { this.handleDeleteSnip(snip.id); }}>Delete</button></p>
            <div>{snip.texts.map((snipText, i) => (
              <AnnoText key={i} annoText={snipText.annoText} language={snipText.language} />
            ))}</div>
          </div>
        ))}</div>
      </div>
    );
  }
}

// NewDeckForm
class NewDeckForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      deckName: '',
    };
  }

  handleNameChange = (e) => {
    this.setState({deckName: e.target.value});
  };

  handleSubmit = (e) => {
    e.preventDefault();
    this.props.onNewDeck(this.state.deckName.trim());
    this.setState({deckName: ''});
  };

  render() {
    const nameIsValid = this.state.deckName && (this.state.deckName.trim() !== '');

    return (
      <form onSubmit={this.handleSubmit}>
        <input type="text" placeholder="New Deck Name" value={this.state.deckName} onChange={this.handleNameChange} />
        <button type="submit" {...(nameIsValid ? {} : {disabled: true})}>Create New Deck</button>
      </form>
    );
  }
}

// App
class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      viewingMode: 'top',
      viewingId: undefined,
    };
  }

  render() {
    const { mainState, actions } = this.props;

    // TODO: wrap in selector
    const deckBriefs = mainState.decks.valueSeq().map(deck => ({
      id: deck.id,
      name: deck.name,
    }));

    if (mainState.loading) {
      return <h1>Loading...</h1>;
    } else if (this.state.viewingMode === 'top') {
      return (
        <div>
          <div>
            <h2>Sources</h2>
            <NewSourceForm onNewSource={actions.createSource} />
            {mainState.sources.valueSeq().map((s) => (
              <div key={s.id}>
                Source Id {s.id} ({s.kind})
                <button onClick={() => {this.setState({viewingMode: 'source', viewingId: s.id})}}>View</button>
              </div>
            ))}
          </div>
          <div>
            <h2>Decks</h2>
            <NewDeckForm onNewDeck={actions.createDeck} />
            {mainState.decks.valueSeq().map((d) => (
              <div key={d.id}>
                {d.name} <small>[{d.id}]</small>
                <button onClick={() => { this.setState({viewingMode: 'deck', viewingId: d.id}); }}>View</button>
                <button onClick={() => { if (window.confirm('Delete deck "' + d.name + '"?')) { actions.deleteDeck(d.id); } }}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )
    } else if (this.state.viewingMode === 'source') {
      return <Source actions={actions} source={mainState.sources.get(this.state.viewingId)} onExit={() => { this.setState({viewingMode: 'top', viewingId: undefined})}} deckBriefs={deckBriefs} snipDeckId={mainState.snipDeckId} onSetSnipDeckId={actions.setSnipDeckId} onAddSnip={actions.addSnip} onUpdateViewPosition={(pos) => { actions.setSourceViewPosition(this.state.viewingId, pos); }} onSourceSetChunkAnnoText={actions.sourceSetChunkAnnoText} />
    } else if (this.state.viewingMode === 'deck') {
      return <Deck actions={actions} deck={mainState.decks.get(this.state.viewingId)} onExit={() => { this.setState({viewingMode: 'top', viewingId: undefined})}} onDeleteSnip={(snipId) => { actions.deleteSnip(this.state.viewingId, snipId); }} />
    }
  }
}

export default App;
