import React, { Component, PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as allActionCreators from '../actions';

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

// NewDocForm
const NewDocForm = connect()(
  class extends Component {
    render() {
      const kindOptions = [
        { value: 'video', label: 'Video' },
        { value: 'comic', label: 'Comic' },
      ];
      const { actions } = this.props;
      return (
        <form onSubmit={e => { e.preventDefault(); actions.newDoc(this.kindVal); }}>
          <Select options={kindOptions} onSet={v => { this.kindVal = v; }} />
          <button type="submit">Create New Document</button>
        </form>
      );
    }
  }
);

// FileChooserForm
const FileChooser = ({ label, accept, onChoose }) => (
  <label>{label} <input type="file" accept={accept} onChange={e => { onChoose(e.target.files[0]); e.target.value = null; }} /></label>
);

// VideoImportControls
class VideoImportControls extends Component {
  render() {
    const { actions } = this.props;
    return (
      <div>
        <form>
          <FileChooser label="Import Video" accept="video/*" onChoose={(file) => { actions.importVideoFile(file, this.videoLanguageVal); }} />
          <Select options={languageOptions} onSet={v => { this.videoLanguageVal = v; }} />
        </form>
        <form>
          <FileChooser label="Import Subs (SRT)" accept=".srt" onChoose={(file) => { actions.importSubsFile(file, this.subLanguageVal); }} />
          <Select options={languageOptions} onSet={v => { this.subLanguageVal = v; }} />
        </form>
      </div>
    );
  }
}

class VideoMedia extends Component {
  render() {
    const { media, onTimeUpdate, mountedVideoElement } = this.props;
    return (
      <div style={{ textAlign: 'center', backgroundColor: 'black' }}>{media.size ? (
        <video src={media.first().videoURL} controls onTimeUpdate={e => { onTimeUpdate(e.target.currentTime); }} ref={(el) => { mountedVideoElement(el); }} />
      ) : ''
      }</div>
    );
  }
}

class PlayControls extends Component {
  constructor(props) {
    super(props);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  componentDidMount() {
    document.body.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    document.body.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown(e) {
    const { onBack, onTogglePause } = this.props;

    // console.log(e);
    if (!e.repeat) {
      switch (e.keyCode) {
        case 65: // a
          onBack();
          break;

        case 32: // space
          onTogglePause();
          break;

        default:
          // ignore
          break;
      }
    }
  }

  render() {
    return null;
  }
}

const TextChunk = ({ chunk }) => {
  const textRangeToElems = (cpBegin, cpEnd) => {
    const pieces = [];
    for (let i = cpBegin; i < cpEnd; i++) {
      const c = textArr[i];
      if (c === '\n') {
        pieces.push(<br key={`char-${i}`} />);
      } else {
        pieces.push(<span key={`char-${i}`}>{c}</span>);
      }
    }
    return pieces;
  };

  const children = [];
  const textArr = [...chunk.annoText.text.trim()]; // split up by unicode chars
  const rubyArr = chunk.annoText.ruby.toArray();

  rubyArr.sort((a, b) => a.cpBegin - b.cpBegin);

  let idx = 0;
  for (const r of rubyArr) {
    if (r.cpBegin < idx) {
      throw new Error('Overlapping ruby');
    }

    if (r.cpBegin > idx) {
      children.push(...textRangeToElems(idx, r.cpBegin));
    }

    children.push(<ruby key={`ruby-${r.cpBegin}:${r.cpEnd}`}>{textRangeToElems(r.cpBegin, r.cpEnd)}<rp>(</rp><rt>{r.rubyText}</rt><rp>)</rp></ruby>);

    idx = r.cpEnd;
  }

  // Handle remaining text
  if (idx < textArr.length) {
    children.push(...textRangeToElems(idx, textArr.length));
  }

  return <div>{children}</div>
};

const TextChunksBox = ({ chunks }) => (
  <div className="studied-text-box">{chunks.map(c => <TextChunk chunk={c} key={c.uid} />)}</div>
);

// Doc
class Doc extends Component {
  constructor(props) {
    super(props);
    this.videoElement = null;
  }

  render() {
    const { doc, actions } = this.props;
    return (
      <div>
        <div id="doc-settings">
          <div>Kind: {doc.kind}</div>
          <VideoImportControls actions={actions} />
          <div>Media:</div>
          <ul>{doc.media.map((o, i) => <li key={i}>#{i} [{o.language}]</li>)}</ul>
          <div>Texts:</div>
          <ul>{doc.texts.map((o, i) => <li key={i}>#{i} [{o.language}]</li>)}</ul>
        </div>
        <VideoMedia media={doc.media} onTimeUpdate={time => { actions.videoTimeUpdate(time); }} mountedVideoElement={(el) => { this.videoElement = el; }} />
        <PlayControls actions={actions} onBack={
            () => {
              if (this.videoElement) {
                const nt = this.videoElement.currentTime - 3.0;
                this.videoElement.currentTime = nt >= 0 ? nt : 0;
              }
            }
          } onTogglePause={
            () => {
              if (this.videoElement) {
                if (this.videoElement.paused) {
                  this.videoElement.play();
                } else {
                  this.videoElement.pause();
                }
              }
            }
          }
        />
        {(doc.texts.size >= 1) ? <TextChunksBox chunks={doc.texts.get(0).currentChunks} /> : ''}
        {(doc.texts.size >= 2) ? <TextChunksBox chunks={doc.texts.get(1).currentChunks} /> : ''}
      </div>
    );
  }
}

// App
const App = connect(
  state => ({
    doc: state.doc,
  }),
  dispatch => ({
    actions: bindActionCreators(allActionCreators, dispatch),
  })
)(({ doc, actions }) => (
  doc ? (
    <Doc doc={doc} actions={actions} />
  ) : (
    <NewDocForm actions={actions} />
  )
));

export default App;
