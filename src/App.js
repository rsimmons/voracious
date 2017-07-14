import React, { Component, PureComponent } from 'react';
import './App.css';
import assert from 'assert';
import escape from 'escape-html';
import Immutable, { Record } from 'immutable';
// import { createSelector } from 'reselect';

import { getKindAtIndex, getKind, addAnnotation, customRender as annoTextCustomRender, clearKindInRange, getInRangeAsJS, removeAnnoIndex } from './util/annotext';
import { getChunksAtTime, getChunksInRange, iteratableChunks } from './util/chunk';
import { cpSlice } from './util/string';

const languageOptions = [
  { value: 'ja', label: 'Japanese' },
  { value: 'en', label: 'English' },
];

// const newlinesToBrs = s => s.split('\n').map((o, i) => <span key={i}>{o}<br/></span>);

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
    const { onImportVideoFile, onImportVideoURL, onImportSubsFile } = this.props;
    return (
      <div>
        <form>
          <FileChooser label="Import Video File" accept="video/*" onChoose={(file) => { onImportVideoFile(file, this.videoFileLanguageVal); }} />
          <Select options={languageOptions} onSet={v => { this.videoFileLanguageVal = v; }} />
        </form>
        <form>
          <label>Import Video URL <input type="text" placeholder="Video URL" onChange={(e) => { this.videoURLVal = e.target.value; }} />
          <Select options={languageOptions} onSet={v => { this.videoURLLanguageVal = v; }} />
          <button type="submit" onClick={(e) => { e.preventDefault(); onImportVideoURL(this.videoURLVal, this.videoURLLanguageVal); }}>Import</button>
          </label>
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
    // Only process event if the target is the body,
    // to avoid messing with typing into input elements, etc.
    // Should we do this instead? e.target.tagName.toUpperCase() === 'INPUT'
    if (e.target !== document.body) {
      return;
    }

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

const CPRange = new Record({
  cpBegin: null,
  cpEnd: null,
});

class AnnoText extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      selectionRange: null,
      inspectedIndex: null, // codepoint index of char we're doing a "tooltip" for
    };
    this.tooltipTimeout = null; // it does not work to have this in state
    this.dragStartIndex = null; // codepoint index of character that mousedown happened on, if mouse is still down
  }

  componentDidMount() {
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.handleMouseUp);

    this.clearTooltipTimeout();
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

  handleSetLemma = () => {
    const { annoText, onUpdate } = this.props;
    const lemmaText = this.setLemmaTextInput.value.trim();
    if (lemmaText === '') {
      return;
    }
    const {cpBegin, cpEnd} = this.state.selectionRange;
    const newAnnoText = addAnnotation(annoText, cpBegin, cpEnd, 'lemma', lemmaText);
    onUpdate(newAnnoText);
    this.clearSelection();
  };

  handleAddHighlight = () => {
    const { annoText, onUpdate } = this.props;
    const {cpBegin, cpEnd} = this.state.selectionRange;
    // TODO: the data for the annotation should be immutable, a Record
    let newAnnoText = addAnnotation(annoText, cpBegin, cpEnd, 'highlight', {timeCreated: Date.now(), setId: this.props.activeSetId});
    onUpdate(newAnnoText);
    this.clearSelection();
  };

  render() {
    const { annoText, language, onUpdate, setBriefs, activeSetId, onSetActiveSetId } = this.props;

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

    let annosInSelection = [];
    if (this.state.selectionRange) {
      annosInSelection = getInRangeAsJS(annoText, this.state.selectionRange.cpBegin, this.state.selectionRange.cpEnd);
    }

    const annoTextChildren = annoTextCustomRender(
      annoText,
      (a, inner) => {
        if (a.kind === 'ruby') {
          return [<ruby key={`ruby-${a.cpBegin}:${a.cpEnd}`}>{inner}<rp>(</rp><rt>{a.data}</rt><rp>)</rp></ruby>];
        } else if (a.kind === 'highlight') {
          return [<span key={`highlight-${a.cpBegin}:${a.cpEnd}`} className='annotext-highlight'>{inner}</span>];
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
            classNames.push('word');
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

    const floatWidth = '240px';
    return (
      <div>
        <div style={{ float: 'right', width: floatWidth, textAlign: 'left', backgroundColor: '#eee', padding: '10px', fontSize: '12px' }}>
          <ClipboardCopier text={annoTextHTML} buttonText="Copy HTML" />
          {(this.state.selectionRange && onUpdate) ? (
            <form>
              <input ref={(el) => { this.setRubyTextInput = el; }} placeholder="ruby text" /><button type="button" onClick={this.handleSetRuby} >Set Ruby</button><br />
              <input ref={(el) => { this.setLemmaTextInput = el; }} placeholder="lemma" /><button type="button" onClick={this.handleSetLemma} >Set Lemma</button><br />
              <select value={activeSetId} onChange={e => onSetActiveSetId(e.target.value)}>
                {setBriefs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" onClick={this.handleAddHighlight} {...(setBriefs.isEmpty() ? {disabled: true} : {})}>Highlight</button>
              <br />
              {annosInSelection.map(a => (
                <div key={a.annoIndex}>[{cpSlice(annoText.text, a.cpBegin, a.cpEnd)}]:{a.kind}={typeof(a.data) === 'string' ? ('[' + a.data + ']') : '<object>'} <button onClick={(e) => {
                  e.preventDefault();
                  onUpdate(removeAnnoIndex(annoText, a.annoIndex));
                }}>X</button></div>
              ))}
            </form>
          ) : ''}
        </div>
        <div style={{ margin: '0 ' + floatWidth }} lang={language} ref={(el) => { this.textContainerElem = el; }}>{annoTextChildren}</div>
      </div>
    );
  }
}

const TextChunksBox = ({ chunks, language, hidden, onChunkSetAnnoText, setBriefs, activeSetId, onSetActiveSetId }) => (
  <div className="studied-text-box">
    <div className="language-tag">{language.toUpperCase()}</div>
    <div>{chunks.map(c => (hidden ? <div key={c.uid} style={{color: '#ccc'}}>(hidden)</div> : <AnnoText key={c.uid} annoText={c.annoText} language={language} onUpdate={newAnnoText => { onChunkSetAnnoText(c.uid, newAnnoText); }} setBriefs={setBriefs} activeSetId={activeSetId} onSetActiveSetId={onSetActiveSetId} />))}</div>
  </div>
);

// Source
class Source extends Component {
  constructor(props) {
    super(props);
    this.videoMediaComponent = undefined;
    this.state = {
      textRevelation: props.source.texts.size + 1, // reveal all texts to start
    };
  }

  handleImportVideoURL = (url, language) => {
    const {source, actions} = this.props;
    actions.sourceAddVideoURL(source.id, url, language);
  };

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

  render() {
    const { source, onExit, setBriefs, activeSetId, onSetActiveSetId, onSetChunkAnnoText, onDeleteMedia, onDeleteText } = this.props;

    return (
      <div>
        <div id="source-settings">
          <div>Id: {source.id}</div>
          <div>Name: <input ref={(el) => { this.nameInputElem = el; }} type="text" defaultValue={source.name} /> <button onClick={() => { this.props.onSetName(this.nameInputElem.value); }}>Set</button></div>
          <div>Kind: {source.kind}</div>
          <VideoImportControls onImportVideoURL={this.handleImportVideoURL} onImportVideoFile={this.handleImportVideoFile} onImportSubsFile={this.handleImportSubsFile} />
          <div>Media:</div>
          <ul>{source.media.map((o, i) => (
            <li key={i}>#{i} [{o.language}]
              <button onClick={() => { if (window.confirm('Delete media?')) { onDeleteMedia(i); } }}>Delete</button>
            </li>
          ))}</ul>
          <div>Texts:</div>
          <ul>{source.texts.map((o, i) => (
            <li key={i}>#{i} [{o.language}]
              <button onClick={() => { if (window.confirm('Delete text?')) { onDeleteText(i); } }}>Delete</button>
            </li>
          ))}</ul>
          <button onClick={onExit}>Exit To Top</button>
        </div>
        <VideoMedia media={source.media} initialTime={this.props.source.viewPosition} onTimeUpdate={this.handleVideoTimeUpdate} ref={(c) => { this.videoMediaComponent = c; }} />
        <PlayControls onBack={this.handleBack} onTogglePause={this.handlePause} onHideText={this.handleHideText} onRevealMoreText={this.handleRevealMoreText} />
        {source.texts.map((text, i) => <TextChunksBox key={i} chunks={getChunksAtTime(text.chunkSet, this.props.source.viewPosition)} language={text.language} hidden={this.state.textRevelation <= i}  onChunkSetAnnoText={(chunkId, newAnnoText) => { onSetChunkAnnoText(i, chunkId, newAnnoText); }} setBriefs={setBriefs} activeSetId={activeSetId} onSetActiveSetId={onSetActiveSetId} />)}
      </div>
    );
  }
}

function findSourceHighlightsWithContext(source, highlightSetId) {
  const contexts = [];
  for (const text of source.texts) {
    for (const chunk of iteratableChunks(text.chunkSet)) {
      const hls = getKind(chunk.annoText, 'highlight');
      if (hls.some(a => (a.data.setId === highlightSetId))) {
        // There are some highlights matching the given set id

        // Pull related chunks+texts from other text tracks (translations, generally)
        const secondaryAnnoTexts = []; // list of {language, annoTexts: [annoText...]}
        for (const otherText of source.texts) {
          if (otherText === text) {
            continue;
          }
          const otherChunks = getChunksInRange(otherText.chunkSet, chunk.position.begin, chunk.position.end);
          // TODO: sort otherChunks by time, if not already
          const otherChunkTexts = [];
          for (const otherChunk of otherChunks) {
            otherChunkTexts.push(otherChunk.annoText);
          }
          if (otherChunkTexts.length > 0) {
            secondaryAnnoTexts.push({language: otherText.language, annoTexts: otherChunkTexts});
          }
        }

        contexts.push({
          primaryAnnoText: chunk.annoText, // this one has highlights
          primaryLanguage: text.language,
          secondaryAnnoTexts: secondaryAnnoTexts, // list of {language, annoTexts: [annoText...]}
        });
      }
    }
  }

  return contexts;
}

function findAllHighlightsWithContext(sources, highlightSetId) {
  let result = [];

  for (const source of sources) {
    result = result.concat(findSourceHighlightsWithContext(source, highlightSetId));
  }

  return result;
}

// HighlightSet
class HighlightSet extends Component {
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
    const { highlightSet, sources, onExit } = this.props;

    const contexts = findAllHighlightsWithContext(sources, highlightSet.id);

    return (
      <div>
        <div>{highlightSet.name} <small>{highlightSet.id}</small></div>
        <div>
          <button onClick={this.handleExportTSV} disabled>Export TSV</button>
          <button onClick={onExit}>Exit To Top</button>
        </div>
        <div>{contexts.map((context, i) => (
          <div key={i}>
            <p>{i} {/*(new Date(timeCreated)).toLocaleString()*/}</p>
            <AnnoText annoText={context.primaryAnnoText} language={context.primaryLanguage} />
            <div>{context.secondaryAnnoTexts.map((sec, i) => (
              <div key={i}>{sec.annoTexts.map((t, i) => (
                <AnnoText key={i} annoText={t} language={sec.language} />
              ))}</div>
            ))}</div>
          </div>
        ))}</div>
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
    this.state = {
      viewingMode: 'top',
      viewingId: undefined,
    };
  }

  render() {
    const { mainState, actions } = this.props;

    // TODO: wrap in selector
    const setBriefs = mainState.highlightSets.valueSeq().map(s => ({
      id: s.id,
      name: s.name,
    }));

    // Sanity check on activeSetId integrity
    // TODO: move this into model
    if (setBriefs.isEmpty()) {
      assert(!mainState.activeHighlightSetId);
    } else {
      assert(setBriefs.some(s => (s.id === mainState.activeHighlightSetId)));
    }

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
                {s.name} <small>[{s.id}]</small>
                <button onClick={() => {this.setState({viewingMode: 'source', viewingId: s.id})}}>View</button>
                <button onClick={() => { if (window.confirm('Delete source "' + s.name + '" (' + s.id + ')?')) { actions.deleteSource(s.id); } }}>Delete</button>
              </div>
            ))}
          </div>
          <div>
            <h2>Highlights</h2>
            <NewHighlightSetForm onNewHighlightSet={actions.createHighlightSet} />
            {mainState.highlightSets.valueSeq().map((s) => (
              <div key={s.id}>
                {s.name} <small>[{s.id}]</small>
                <button onClick={() => { this.setState({viewingMode: 'set', viewingId: s.id}); }}>View</button>
                <button onClick={() => { if (window.confirm('Delete set "' + s.name + '"?')) { actions.deleteHighlightSet(s.id); } }} disabled>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )
    } else if (this.state.viewingMode === 'source') {
      const sourceId = this.state.viewingId;
      return <Source actions={actions} source={mainState.sources.get(sourceId)} onExit={() => { this.setState({viewingMode: 'top', viewingId: undefined})}} setBriefs={setBriefs} activeSetId={mainState.activeHighlightSetId} onSetActiveSetId={actions.setActiveHighlightSetId} onUpdateViewPosition={(pos) => { actions.setSourceViewPosition(sourceId, pos); }} onSetChunkAnnoText={(textNum, chunkId, newAnnoText) => { actions.sourceSetChunkAnnoText(sourceId, textNum, chunkId, newAnnoText) }} onDeleteMedia={(mediaNum) => { actions.sourceDeleteMedia(sourceId, mediaNum) }} onDeleteText={(textNum) => { actions.sourceDeleteText(sourceId, textNum) }} onSetName={(name) => { actions.sourceSetName(sourceId, name); }} />
    } else if (this.state.viewingMode === 'set') {
      return <HighlightSet actions={actions} sources={mainState.sources.valueSeq()} highlightSet={mainState.highlightSets.get(this.state.viewingId)} onExit={() => { this.setState({viewingMode: 'top', viewingId: undefined})}} />
    }
  }
}

export default App;
