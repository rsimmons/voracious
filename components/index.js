import React, { Component, PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import * as allActionCreators from '../actions';

const languageOptions = [
  { value: 'ja', label: 'Japanese' },
  { value: 'en', label: 'English' },
];

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
          <FileChooser label="Import Video" accept="video/*" onChoose={(file) => { actions.importVideoFile(file); }} />
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
      <div>{media.size ? (
        <video src={media.first().videoURL} controls onTimeUpdate={e => { onTimeUpdate(e.target.currentTime); }} ref={(el) => { mountedVideoElement(el); }} />
      ) : 'No video media'
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
        <div style={{ float: 'right', backgroundColor: '#ddd', padding: '10px' }}>
          <div>Kind: {doc.kind}</div>
          <VideoImportControls actions={actions} />
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
        <div>{doc.texts.size ? JSON.stringify(doc.texts.first().currentChunks.toJS()) : ''}</div>
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
