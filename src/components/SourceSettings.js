import React, { PureComponent } from 'react';

import './SourceSettings.css';

import LanguageSelect from './LanguageSelect.js';
import Editable from './Editable.js';
import Button from './Button.js';


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

export default class SourceSettings extends PureComponent {
  handleClickSetVideoURL = () => {
    this.props.onSetVideoURL(this.videoURLInputElem.value);
  };

  render() {
    const { source, onSetName, onClearVideoURL, onImportSubsFile, onDeleteText, onDeleteSource } = this.props;

    return (
      <div className="SourceSettings">
        <div style={{fontSize: '1.6em'}}><Editable value={source.name} onUpdate={(v) => { onSetName(v); }}/></div>
        <div style={{marginTop: '0.5em', maxWidth: '25em'}}>
          <span>Video:&nbsp;</span>
          {source.media.size ? (
            <span><a target="_blank" href={source.media.first().videoURL}>{source.media.first().videoURL}</a>{' '}<button onClick={onClearVideoURL}>Clear URL</button></span>
          ) : (
            <span><input type="text" placeholder="Video URL" ref={el => this.videoURLInputElem = el} />{' '}<button onClick={this.handleClickSetVideoURL}>Set URL</button></span>
          )}
        </div>
        <div style={{marginTop: '0.5em'}}>
          Subtitle Tracks:{' '}
          {!source.texts.size ? (
            <em>none</em>
          ) : null}
        </div>
        <ul className="SourceSettings-texts-list">{source.texts.map((o, i) => (
          <li key={i}>
            [{o.chunkSet.chunkMap.size} segments]
            {' '}
            <LanguageSelect value={o.language} onChange={(lang) => { console.log(lang) }}/>
            {' '}
            <button onClick={() => { if (window.confirm('Delete subtitle track?')) { onDeleteText(i); } }}>Delete</button>
          </li>
        ))}</ul>
        <div style={{marginTop: '1em'}}>
          <form>
            <Button onClick={() => {this.subsFileChooserElem.choose()}}>Import Subs (SRT)</Button>
            <HiddenFileChooser accept=".srt" onChoose={(file) => { onImportSubsFile(file); }} ref={el => {this.subsFileChooserElem = el}} />
            {' '}<Button onClick={() => { if (window.confirm('Delete "' + source.name + '"?')) { onDeleteSource(); } }}>Delete Video</Button>
          </form>
        </div>
      </div>
    );
  }
}
