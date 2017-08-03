import React, { Component } from 'react';

import Select from './Select.js';
import AnnoText from './AnnoText.js';

import { getChunksAtTime } from '../util/chunk';

const languageOptions = [
  { value: 'ja', label: 'Japanese' },
  { value: 'en', label: 'English' },
];

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

const TextChunksBox = ({ chunks, language, hidden, onChunkSetAnnoText, highlightSets, activeSetId, onSetActiveSetId }) => (
  <div className="studied-text-box">
    <div className="language-tag">{language.toUpperCase()}</div>
    <div>{chunks.map(c => (hidden ? <div key={c.uid} style={{color: '#ccc'}}>(hidden)</div> : <AnnoText key={c.uid} annoText={c.annoText} language={language} onUpdate={newAnnoText => { onChunkSetAnnoText(c.uid, newAnnoText); }} highlightSets={highlightSets} activeSetId={activeSetId} onSetActiveSetId={onSetActiveSetId} />))}</div>
  </div>
);

// Source
export default class Source extends Component {
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
    const { source, onExit, highlightSets, activeSetId, onSetActiveSetId, onSetChunkAnnoText, onDeleteMedia, onDeleteText } = this.props;

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
        {source.texts.map((text, i) => <TextChunksBox key={i} chunks={getChunksAtTime(text.chunkSet, this.props.source.viewPosition)} language={text.language} hidden={this.state.textRevelation <= i}  onChunkSetAnnoText={(chunkId, newAnnoText) => { onSetChunkAnnoText(i, chunkId, newAnnoText); }} highlightSets={highlightSets} activeSetId={activeSetId} onSetActiveSetId={onSetActiveSetId} />)}
      </div>
    );
  }
}
