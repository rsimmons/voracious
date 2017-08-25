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

  render() {
    const { media, initialTime, onTimeUpdate, onPlaying, onPause, onEnded, onSeeking } = this.props;
    return (
      <video src={media.first().videoURL} controls onTimeUpdate={e => { onTimeUpdate(e.target.currentTime); }} onPlaying={onPlaying} onPause={onPause} onEnded={onEnded} onSeeking={onSeeking} ref={(el) => { this.videoElem = el; }} onLoadedMetadata={e => { e.target.currentTime = initialTime ? initialTime : 0; }} />
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
    const { onBack, onReplay, onTogglePause, onContinue, onChangeQuizMode } = this.props;
    return (
      <form className="PlayControls">
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
      showingSettings: !props.source.media.size || !props.source.texts.size,
    };
    this.videoTime = null;
    this.videoIsPlaying = false;
  }

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

  handleContinue = () => {
    switch (this.state.quizMode) {
      case 'none':
        // ignore
        break;

      case 'listen':
        if (this.state.quizPause) {
          switch (this.state.quizState.textRevelation) {
            case 0:
              this.setState((s) => { s.quizState.textRevelation++; });
              break;

            case 1:
              this.setState((s) => { s.quizState.textRevelation++; });
              break;

            case 2:
              // Continue playing video
              this.videoMediaComponent.play();
              this.releaseQuizPause();
              this.setState({
                quizState: null,
              });
              break;

            default:
              throw new Error('internal error');
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
    // TODO: this should probably be last-reported time,
    //  slightly different than textViewPosition?
    this.props.onUpdateViewPosition(this.state.textViewPosition);
    this.props.onExit();
  }

  render() {
    const { source, highlightSets, onSetChunkAnnoText, onSetName, onDeleteSource, onSetVideoURL, onClearVideoURL, onImportSubsFile, onSetTextRole, onMoveUpText, onDeleteText } = this.props;

    // Is source ready to be used? Not very useful if there isn't
    //  at least a video and subs.
    const sourceReady = source.media.size && source.texts.size;

    // Based on quiz mode and state, determine what texts are shown
    let showFirstText = true;
    let showRestTexts = true;
    switch (this.state.quizMode) {
      case 'none':
        // don't change
        break;

      case 'listen':
        if (this.state.quizPause) {
          switch (this.state.quizState.textRevelation) {
            case 0:
              showFirstText = false;
              showRestTexts = false;
              break;

            case 1:
              showFirstText = true;
              showRestTexts = false;
              break;

            case 2:
              showFirstText = true;
              showRestTexts = true;
              break;

            default:
              throw new Error('internal error');
          }
        } else {
          showFirstText = false;
          showRestTexts = false;
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
              <VideoMedia media={source.media} initialTime={this.props.source.viewPosition} onTimeUpdate={this.handleVideoTimeUpdate} onPlaying={this.handleVideoPlaying} onPause={this.handleVideoPause} onEnded={this.handleVideoEnded} onSeeking={this.handleVideoSeeking} ref={(c) => { this.videoMediaComponent = c; }} />
              <div className="Source-text-chunks">
                {source.texts.map((text, textNum) => {
                  const chunk = getLastChunkAtTime(text.chunkSet, this.state.textViewPosition);

                  if (chunk) {
                    return (
                      <div className="Source-text-chunk-outer" key={textNum}>
                        <div className="Source-text-chunk-inner">
                          {(() => {
                            const textHidden = ((textNum === 0) && !showFirstText) || ((textNum > 0) && !showRestTexts);

                            return (
                              <div style={{position: 'relative'}}>
                                {textHidden ? (
                                  <div key={chunk.uid} style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                                    <div style={{color: '#aaa'}}>(hidden)</div>
                                  </div>
                                ) : null}
                                <div style={{visibility: textHidden ? 'hidden' : 'visible'}}>
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
            <PlayControls onBack={this.handleBack} onReplay={this.handleReplay} onTogglePause={this.handleTogglePause} onContinue={this.handleContinue} onChangeQuizMode={this.handleSetQuizMode} />
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
