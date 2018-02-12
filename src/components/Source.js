import React, { Component } from 'react';

import './Source.css';

import SourceSettings from './SourceSettings.js';
import Select from './Select.js';
import AnnoText from './AnnoText.js';
import Modal from './Modal.js';

import { getLastChunkAtTime } from '../util/chunk';

class VideoMedia extends Component {
  constructor(props) {
    super(props);
    this.videoElem = null;
  }

  seek(t) {
    if (this.videoElem) {
      this.videoElem.currentTime = t;
    }
  }

  seekRelative(dt) {
    if (this.videoElem) {
      const nt = this.videoElem.currentTime + dt;
      this.videoElem.currentTime = nt >= 0 ? nt : 0;
    }
  }

  play() {
    this.videoElem.play();
  }

  pause() {
    this.videoElem.pause();
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

  setVideoRef = (el) => {
    this.videoElem = el;
    if (this.videoElem) {
      this.videoElem.playbackRate = this.props.playbackRate;
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.playbackRate !== this.props.playbackRate && this.videoElem) {
      this.videoElem.playbackRate = this.props.playbackRate;
    }
  }

  render() {
    const { media, initialTime, onTimeUpdate, onPlaying, onPause, onEnded, onSeeking } = this.props;
    return (
      <video src={media.first().videoURL} controls onTimeUpdate={e => { onTimeUpdate(e.target.currentTime); }} onPlaying={onPlaying} onPause={onPause} onEnded={onEnded} onSeeking={onSeeking} ref={this.setVideoRef} onLoadedMetadata={e => { e.target.currentTime = initialTime ? initialTime : 0; }} />
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

    const { onBack, onReplay, onTogglePause, onContinue } = this.props;

    if (!e.repeat) {
      switch (e.keyCode) {
        case 65: // a
          onBack();
          break;

        case 82: // r
          onReplay();
          break;

        case 32: // space
          onTogglePause();
          e.preventDefault();
          break;

        case 13: // ener
          onContinue();
          e.preventDefault();
          break;

        default:
          // ignore
          break;
      }
    }
  }

  render() {
    const { onBack, onReplay, onTogglePause, onContinue, onChangeQuizMode, onChangePlaybackRate } = this.props;
    return (
      <form className="PlayControls">
        <Select
            value={this.props.playbackRate}
            onChange={onChangePlaybackRate} options={[
              { value: "0.5", label: "50%" },
              { value: "0.75", label: "75%" },
              { value: "1", label: "Normal Speed" }
            ]} />
        <button type="button" onClick={onBack}>Jump Back [A]</button>
        <button type="button" onClick={onReplay}>Replay [R]</button>
        <button type="button" onClick={onTogglePause}>Play/Pause [Space]</button>
        <button type="button" onClick={onContinue}>Continue [Enter]</button>
        <Select options={[
          {value: 'none', label: 'None'},
          {value: 'listen', label: 'Listen'},
        ]} onChange={onChangeQuizMode} />
      </form>
    );
  }
}

// Source
export default class Source extends Component {
  constructor(props) {
    super(props);
    this.videoMediaComponent = undefined;
    this.state = {
      textViewPosition: props.source.viewPosition,
      quizMode: 'none',
      quizPause: false, // are we paused (or have requested pause) for quiz?
      quizState: null,
      playbackRate: 1.0,
      showingSettings: !props.source.media.size || !props.source.texts.size,
    };
    this.videoTime = null;
    this.videoIsPlaying = false;
  }

  componentDidMount() {
    this.saveViewPositionTimer = window.setInterval(this.saveViewPosition, 1000);
  }

  componentWillUnmount() {
    if (this.saveViewPositionTimer) {
      window.clearInterval(this.saveViewPositionTimer);
    }
  }

  saveViewPosition = () => {
    if ((this.videoTime !== null) && (this.videoTime !== undefined)) {
      this.props.onUpdateViewPosition(this.videoTime);
    }
  };

  handleVideoTimeUpdate = (time) => {
    this.videoTime = time;

    if (this.state.quizPause) {
      // We're either paused or in the process of pausing for question,
      //  so should ignore this time update.
      return;
    }

    const { source } = this.props;

    let pauseForQuiz = false;

    // Determine if we need to pause for a quiz
    // Is the video playing? Don't want to mis-trigger pause upon seeking
    if (this.videoIsPlaying) {
      // Is there at least one text track?
      if (this.state.quizMode === 'none') {
      } else if (this.state.quizMode === 'listen') {
        if (source.texts.size >= 1) {
          const firstText = source.texts.first();

          // Look up chunk (if any) before this time change
          const currentChunk = getLastChunkAtTime(firstText.chunkSet, this.state.textViewPosition);

          if (currentChunk) {
            // Are we passing the time that would trigger a pause for quiz?
            const PAUSE_DELAY = 0.3;
            const triggerTime = currentChunk.position.end - PAUSE_DELAY;

            if ((this.state.textViewPosition < triggerTime) && (time >= triggerTime)) {
              pauseForQuiz = true;
              this.setState({
                quizState: {
                  textRevelation: 0,
                }
              });
            }
          }
        }
      } else {
        throw new Error('internal error');
      }
    }

    if (pauseForQuiz) {
      this.setState({
        quizPause: true,
      });
      this.videoMediaComponent.pause();
    } else {
      this.setState({textViewPosition: time});
    }
  };

  releaseQuizPause = () => {
    this.setState({
      quizPause: false,
      // Resync displayed text with video time, since they may have gotten
      //  very slightly out of sync if we were paused for question
      textViewPosition: this.videoTime,
    });
  }

  handleChangePlaybackRate = (value) => {
    this.setState({playbackRate: parseFloat(value)});
  }

  handleVideoPlaying = () => {
    this.videoIsPlaying = true;
  };

  handleVideoPause = () => {
    this.videoIsPlaying = false;
  };

  handleVideoEnded = () => {
    this.videoIsPlaying = false;
  };

  handleVideoSeeking = () => {
    this.videoIsPlaying = false;
    this.releaseQuizPause();
  };

  handleSetQuizMode = (mode) => {
    switch (mode) {
      case 'none':
        this.setState({
          quizMode: mode,
          quizPause: false,
          quizState: null,
        });
        break;

      case 'listen':
        this.setState({
          quizMode: mode,
          quizPause: false,
          quizState: null,
        });
        break;

      default:
        throw new Error('internal error');
    }
  }

  handleBack = () => {
    if (this.videoMediaComponent) {
      this.videoMediaComponent.seekRelative(-3.0);
    }
  };

  handleReplay = () => {
    if (this.videoMediaComponent) {
      const firstText = this.props.source.texts.first();
      const currentChunk = getLastChunkAtTime(firstText.chunkSet, this.state.textViewPosition);

      if (currentChunk) {
        this.videoMediaComponent.seek(currentChunk.position.begin);
        this.videoMediaComponent.play();
      }
    }
  };

  handleTogglePause = () => {
    this.releaseQuizPause();
    if (this.videoMediaComponent) {
      this.videoMediaComponent.togglePause();
    }
  };

  anyTranscriptionText = () => {
    return this.props.source.texts.some(text => text.role === 'transcription');
  };

  anyTranslationText = () => {
    return this.props.source.texts.some(text => text.role === 'translation');
  };

  handleContinue = () => {
    switch (this.state.quizMode) {
      case 'none':
        // ignore
        break;

      case 'listen':
        if (this.state.quizPause) {
          const anyTranscription = this.anyTranscriptionText();
          const anyTranslation = this.anyTranslationText();
          if (!(anyTranscription || anyTranslation)) {
            throw new Error('unpossible?');
          }

          const maxRevelation = (+anyTranscription) + (+anyTranslation);
          const currentRevelation = this.state.quizState.textRevelation;

          if (currentRevelation > maxRevelation) {
            throw new Error('internal error');
          } else if (currentRevelation === maxRevelation) {
            // Continue playing video
            this.videoMediaComponent.play();
            this.releaseQuizPause();
            this.setState({
              quizState: null,
            });
          } else {
            // Increment state quizState.textRevelation
            this.setState(s => ({ quizState: { textRevelation: s.quizState.textRevelation + 1 }}));
          }
        }
        break;

      default:
        throw new Error('internal error');
    }
  };

  handleToggleSettings = () => {
    this.setState(state => ({ ...state, showingSettings: !state.showingSettings}));
  }

  handleExit = () => {
    this.saveViewPosition();
    this.props.onExit();
  }

  render() {
    const { source, highlightSets, onSetChunkAnnoText, onSetName, onDeleteSource, onSetVideoURL, onClearVideoURL, onImportSubsFile, onSetTextRole, onMoveUpText, onDeleteText } = this.props;

    // Is source ready to be used? Not very useful if there isn't
    //  at least a video and subs.
    const sourceReady = source.media.size && source.texts.size;

    // Based on quiz mode and state, determine if we override text displays
    let transcriptionMessage = null;
    let translationsMessage = null;
    const REVEAL_MESSAGE = '(press enter to reveal)';
    const HIDDEN_MESSAGE = '(hidden)';
    const LISTEN_MESSAGE = '(listen)';

    switch (this.state.quizMode) {
      case 'none':
        // don't change
        break;

      case 'listen':
        if (this.state.quizPause) {
          switch (this.state.quizState.textRevelation) {
            case 0:
              if (this.anyTranscriptionText()) {
                transcriptionMessage = REVEAL_MESSAGE;
                translationsMessage = HIDDEN_MESSAGE;
              } else {
                translationsMessage = REVEAL_MESSAGE;
              }
              break;

            case 1:
              if (this.anyTranscriptionText()) {
                translationsMessage = REVEAL_MESSAGE;
              } else {
                // don't change
              }
              break;

            case 2:
              // don't change
              break;

            default:
              throw new Error('internal error');
          }
        } else {
          transcriptionMessage = LISTEN_MESSAGE;
          translationsMessage = LISTEN_MESSAGE;
        }
        break;

      default:
        throw new Error('internal error');
    }

    return (
      <div className="Source">
        {sourceReady ? (
          <div className="Source-main">
            <div className="Source-video-area">
              <VideoMedia
                  media={source.media}
                  playbackRate={this.state.playbackRate}
                  initialTime={this.props.source.viewPosition}
                  onTimeUpdate={this.handleVideoTimeUpdate}
                  onPlaying={this.handleVideoPlaying}
                  onPause={this.handleVideoPause}
                  onEnded={this.handleVideoEnded}
                  onSeeking={this.handleVideoSeeking}
                  ref={(c) => { this.videoMediaComponent = c; }} />
              <div className="Source-text-chunks">
                {source.texts.map((text, textNum) => {
                  const chunk = getLastChunkAtTime(text.chunkSet, this.state.textViewPosition);

                  if (chunk) {
                    return (
                      <div className="Source-text-chunk-outer" key={textNum}>
                        <div className="Source-text-chunk-inner">
                          {(() => {
                            let message;
                            if (text.role === 'transcription') {
                              message = transcriptionMessage;
                            } else if (text.role === 'translation') {
                              message = translationsMessage;
                            } else {
                              throw new Error('unpossible?');
                            }

                            return (
                              <div style={{position: 'relative'}}>
                                {message ? (
                                  <div key={chunk.uid} style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                                    <div style={{color: '#aaa'}}>{message}</div>
                                  </div>
                                ) : null}
                                <div style={{visibility: message ? 'hidden' : 'visible'}}>
                                  <AnnoText key={chunk.uid} annoText={chunk.annoText} language={text.language} onUpdate={newAnnoText => { onSetChunkAnnoText(textNum, chunk.uid, newAnnoText); }} highlightSets={highlightSets} />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  } else {
                    return null;
                  }
                })}
              </div>
            </div>
            <PlayControls playbackRate={this.state.playbackRate} onBack={this.handleBack} onReplay={this.handleReplay} onTogglePause={this.handleTogglePause} onContinue={this.handleContinue} onChangeQuizMode={this.handleSetQuizMode} onChangePlaybackRate={this.handleChangePlaybackRate} />
          </div>
        ) : (
          <div className="Source-blackfill"></div>
        )}
        {this.state.showingSettings ? (
          <Modal onClickOutside={() => { this.setState({showingSettings: false}) }}>
            <div className="Source-settings-wrapper">
              <SourceSettings source={source} onSetName={onSetName} onSetVideoURL={onSetVideoURL} onClearVideoURL={onClearVideoURL} onImportSubsFile={onImportSubsFile} onSetTextRole={onSetTextRole} onMoveUpText={onMoveUpText} onDeleteText={onDeleteText} onDeleteSource={onDeleteSource} />
            </div>
          </Modal>
        ) : null}
        <button className="Source-big-button Source-exit-button" onClick={this.handleExit}>↩</button>
        <button className="Source-big-button Source-toggle-settings-button" onClick={this.handleToggleSettings}>ⓘ</button>
      </div>
    );
  }
}
