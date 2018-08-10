import React, { Component } from 'react';

import './Player.css';

import Select from './Select.js';
import AnnoText from './AnnoText.js';
import Modal from './Modal.js';

import { getLastChunkAtTime } from '../util/chunk';

class VideoWrapper extends Component {
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
    const { videoURL, initialTime, onTimeUpdate, onPlaying, onPause, onEnded, onSeeking } = this.props;
    return (
      <video src={videoURL} controls onTimeUpdate={e => { onTimeUpdate(e.target.currentTime); }} onPlaying={onPlaying} onPause={onPause} onEnded={onEnded} onSeeking={onSeeking} ref={(el) => { this.videoElem = el; }} onLoadedMetadata={e => { e.target.currentTime = initialTime ? initialTime : 0; }} />
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

// Player
export default class Player extends Component {
  constructor(props) {
    super(props);
    this.videoMediaComponent = undefined;
    this.state = {
      textViewPosition: props.video.playbackPosition,
      quizMode: 'none',
      quizPause: false, // are we paused (or have requested pause) for quiz?
      quizState: null,
    };
    this.videoTime = null;
    this.videoIsPlaying = false;
  }

  componentDidMount() {
    this.savePlaybackPositionTimer = window.setInterval(this.savePlaybackPosition, 1000);
  }

  componentWillUnmount() {
    if (this.savePlaybackPositionTimer) {
      window.clearInterval(this.savePlaybackPositionTimer);
    }
  }

  savePlaybackPosition = () => {
    if ((this.videoTime !== null) && (this.videoTime !== undefined)) {
      this.props.onUpdatePlaybackPosition(this.videoTime);
    }
  };

  handleVideoTimeUpdate = (time) => {
    this.videoTime = time;

    if (this.state.quizPause) {
      // We're either paused or in the process of pausing for question,
      //  so should ignore this time update.
      return;
    }

    const { video } = this.props;

    let pauseForQuiz = false;

    // Determine if we need to pause for a quiz
    // Is the video playing? Don't want to mis-trigger pause upon seeking
    if (this.videoIsPlaying) {
      // Is there at least one text track?
      if (this.state.quizMode === 'none') {
      } else if (this.state.quizMode === 'listen') {
        if (video.texts.size >= 1) {
          const firstText = video.texts.first();

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
      const firstText = this.props.video.texts.first();
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
    return this.props.video.texts.some(text => text.role === 'transcription');
  };

  anyTranslationText = () => {
    return this.props.video.texts.some(text => text.role === 'translation');
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

  handleExit = () => {
    this.savePlaybackPosition();
    this.props.onExit();
  }

  render() {
    const { video } = this.props;

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
      <div className="Player">
        <div className="Player-main">
          <div className="Player-video-area">
            <VideoWrapper videoURL={video.videoURL} initialTime={video.playbackPosition} onTimeUpdate={this.handleVideoTimeUpdate} onPlaying={this.handleVideoPlaying} onPause={this.handleVideoPause} onEnded={this.handleVideoEnded} onSeeking={this.handleVideoSeeking} ref={(c) => { this.videoMediaComponent = c; }} />
            {/**
            <div className="Player-text-chunks">
              {video.texts.map((text, textNum) => {
                const chunk = getLastChunkAtTime(text.chunkSet, this.state.textViewPosition);

                if (chunk) {
                  return (
                    <div className="Player-text-chunk-outer" key={textNum}>
                      <div className="Player-text-chunk-inner">
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
                                <AnnoText key={chunk.uid} annoText={chunk.annoText} language={text.language} onUpdate={newAnnoText => { onSetChunkAnnoText(textNum, chunk.uid, newAnnoText); }} />
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
            **/}
          </div>
          <PlayControls onBack={this.handleBack} onReplay={this.handleReplay} onTogglePause={this.handleTogglePause} onContinue={this.handleContinue} onChangeQuizMode={this.handleSetQuizMode} />
        </div>
        <button className="Player-big-button Player-exit-button" onClick={this.handleExit}>↩</button>
      </div>
    );
  }
}
