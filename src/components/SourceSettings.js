import React, { PureComponent } from 'react';

import './SourceSettings.css';

import Select from './Select.js';
import LanguageSelect from './LanguageSelect.js';
import Editable from './Editable.js';
import Button from './Button.js';
import { startsWith, removePrefix } from '../util/string';

const { ipcRenderer } = window.require('electron'); // use window to avoid webpack

const LOCAL_PREFIX = 'local://';

class HiddenFileChooser extends PureComponent {
  choose = () => {
    this.inputElem.click();
  };

  handleChange = (e) => {
    this.props.onChoose(e.target.files[0]);
    e.target.value = null;
  };

  render() {
    const { accept } = this.props;
    return (
      <input type="file" accept={accept} onChange={this.handleChange} style={{display: 'none'}} ref={el => {this.inputElem = el}} />
    );
  }
}

const FIRST_ROLE_OPTIONS = [
  {value: 'transcription', label: 'transcription'},
  {value: 'translation', label: 'translation'},
];

const REST_ROLE_OPTIONS = [
  {value: 'transcription', label: 'transcription', disabled: true},
  {value: 'translation', label: 'translation'},
];

export default class SourceSettings extends PureComponent {
  constructor(props) {
    super(props);

    ipcRenderer.on('chose-video-file', this.handleIpcChoseVideoFile);
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('chose-video-file', this.handleIpcChoseVideoFile);
  }

  handleIpcChoseVideoFile = (e, fn) => {
    this.props.onSetVideoURL(LOCAL_PREFIX + fn);
  };

  handleClickSetVideoURL = () => {
    this.props.onSetVideoURL(this.videoURLInputElem.value);
  };

  handleClickChooseVideoFile = () => {
    ipcRenderer.send('choose-video-file');
  };

  renderVideoURL = (url) => {
    if (startsWith(url, LOCAL_PREFIX)) {
      const fn = removePrefix(url, LOCAL_PREFIX);
      return fn;
    } else {
      return <a target="_blank" href={url}>{url}</a>;
    }
  };

  render() {
    const { source, onSetName, onClearVideoURL, onImportSubsFile, onSetTextRole, onMoveUpText, onDeleteText, onDeleteSource } = this.props;

    return (
      <div className="SourceSettings">
        <div style={{fontSize: '1.6em'}}><Editable value={source.name} onUpdate={(v) => { onSetName(v); }}/></div>
        <div style={{marginTop: '0.5em', maxWidth: '25em'}}>
          <span>Video:&nbsp;</span>
          {source.media.size ? (
            <span style={{wordBreak: 'break-all'}}>{this.renderVideoURL(source.media.first().videoURL)}{' '}<button onClick={onClearVideoURL}>Unset</button></span>
          ) : (
            <span><button onClick={this.handleClickChooseVideoFile}>Choose File</button> or <input type="text" placeholder="Video URL" ref={el => this.videoURLInputElem = el} />{' '}<button onClick={this.handleClickSetVideoURL}>Set URL</button></span>
          )}
        </div>
        <div style={{marginTop: '0.5em'}}>
          Subtitle Tracks:{' '}
          {!source.texts.size ? (
            <em>none</em>
          ) : null}
        </div>
        <ul className="SourceSettings-texts-list">{source.texts.map((text, i) => (
          <li key={i}>
            [{text.chunkSet.chunkMap.size} segments]
            {' '}
            <LanguageSelect value={text.language} onChange={(lang) => { /* don't allow changing yet */ }}/>
            {' '}
            <Select value={text.role} options={(i === 0) ? FIRST_ROLE_OPTIONS : REST_ROLE_OPTIONS} onChange={role => { onSetTextRole(i, role) }}/>
            {' '}
            <button onClick={() => { onMoveUpText(i) }} disabled={i === 0}>Move Up</button>
            {' '}
            <button onClick={() => { if (window.confirm('Delete subtitle track? Any highlights on this track will be lost, and this cannot be undone.')) { onDeleteText(i); } }}>Delete</button>
          </li>
        ))}</ul>
        <div style={{marginTop: '1em'}}>
          <form>
            <Button onClick={() => {this.subsFileChooserElem.choose()}}>Import Subs</Button>
            <HiddenFileChooser accept=".srt" onChoose={(file) => { onImportSubsFile(file); }} ref={el => {this.subsFileChooserElem = el}} />
            {' '}<Button onClick={() => { if (window.confirm('Delete "' + source.name + '" and all its subtitle tracks? This cannot be undone.')) { onDeleteSource(); } }}>Delete Video</Button>
          </form>
        </div>
      </div>
    );
  }
}
