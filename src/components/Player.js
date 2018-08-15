import React, { Component } from 'react';

import './Player.css';

import Select from './Select.js';
import AnnoText from './AnnoText.js';

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

    const { onBack, onReplay, onTogglePause, onContinue, onToggleRuby, onToggleHelp } = this.props;

    if (!e.repeat) {
      switch (e.keyCode) {
        case 37: // left arrow
          onBack();
          break;

        case 38: // up arrow
          onReplay();
          break;

        case 32: // space
          onTogglePause();
          e.preventDefault();
          break;

        case 40: // down arrow
          onContinue();
          e.preventDefault();
          break;

        case 70: // F key
          onToggleRuby();
          e.preventDefault();
          break;

        case 72: // H key
          onToggleHelp();
          e.preventDefault();
          break;

        default:
          // ignore
          break;
      }
    }
  }

  render() {
    return null;
    /*
    const { onBack, onReplay, onTogglePause, onContinue } = this.props;
    return (
      <form className="PlayControls">
        <button type="button" onClick={onBack}>Jump Back [A]</button>
        <button type="button" onClick={onReplay}>Replay [R]</button>
        <button type="button" onClick={onTogglePause}>Play/Pause [Space]</button>
        <button type="button" onClick={onContinue}>Continue [Enter]</button>
      </form>
    );
    */
  }
}

const MODE_TITLES = {
  manual: 'Manual',
  listen: 'Listening Test',
};

// Player
export default class Player extends Component {
  constructor(props) {
    super(props);
    this.videoMediaComponent = undefined;
    this.state = {
      textViewPosition: props.video.playbackPosition,
      subtitleMode: props.preferences.subtitleMode, // we just initialize from preference
      autoPaused: false, // are we paused (or have requested pause) for listen/read test?
      subtitleState: null,
    };
    this.videoTime = null;
    this.videoIsPlaying = false;
  }

  componentDidMount() {
    this.props.onNeedSubtitles();

    this.savePlaybackPositionTimer = window.setInterval(this.savePlaybackPosition, 1000);
  }

  componentWillUnmount() {
    if (this.savePlaybackPositionTimer) {
      window.clearInterval(this.savePlaybackPositionTimer);
    }
  }

  componentDidUpdate(prevProps) {
    // Compare object identity since it's immutable
    if (this.props.video.subtitleTracks !== prevProps.video.subtitleTracks) {
      this.props.onNeedSubtitles();
    }
  }

  savePlaybackPosition = () => {
    if ((this.videoTime !== null) && (this.videoTime !== undefined)) {
      this.props.onUpdatePlaybackPosition(this.videoTime);
    }
  };

  handleVideoTimeUpdate = (time) => {
    this.videoTime = time;

    if (this.state.autoPaused) {
      // We're either paused or in the process of pausing for question,
      //  so should ignore this time update.
      return;
    }

    const { video } = this.props;

    let doAutoPause = false;

    // Determine if we need to auto-pause
    // Is the video playing? Don't want to mis-trigger pause upon seeking
    if (this.videoIsPlaying) {
      // Is there at least one text track?
      if (this.state.subtitleMode === 'manual') {
      } else if (this.state.subtitleMode === 'listen') {
        if (video.subtitleTracks.size >= 1) {
          const firstSubtitleTrack = video.subtitleTracks.first();

          // Look up chunk (if any) before this time change
          const currentChunk = getLastChunkAtTime(firstSubtitleTrack.chunkSet, this.state.textViewPosition);

          if (currentChunk) {
            // Are we passing the time that would trigger a pause?
            const PAUSE_DELAY = 0.3;
            const triggerTime = currentChunk.position.end - PAUSE_DELAY;

            if ((this.state.textViewPosition < triggerTime) && (time >= triggerTime)) {
              doAutoPause = true;
              this.setState({
                subtitleState: {
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

    if (doAutoPause) {
      this.setState({
        autoPaused: true,
      });
      this.videoMediaComponent.pause();
    } else {
      this.setState({textViewPosition: time});
    }
  };

  releaseAutoPause = () => {
    this.setState({
      autoPaused: false,
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
    this.releaseAutoPause();
  };

  handleSetSubtitleMode = (mode) => {
    switch (mode) {
      case 'manual':
        this.setState({
          subtitleMode: mode,
          autoPaused: false,
          subtitleState: null,
        });
        break;

      case 'listen':
        this.setState({
          subtitleMode: mode,
          autoPaused: false,
          subtitleState: null,
        });
        break;

      default:
        throw new Error('internal error');
    }
    this.props.onSetPreference('subtitleMode', mode);
  }

  handleBack = () => {
    if (this.videoMediaComponent) {
      this.videoMediaComponent.seekRelative(-3.0);
    }
  };

  handleReplay = () => {
    if (this.videoMediaComponent) {
      const firstSubtitleTrack = this.props.video.subtitleTracks.first();
      const currentChunk = getLastChunkAtTime(firstSubtitleTrack.chunkSet, this.state.textViewPosition);

      if (currentChunk) {
        this.videoMediaComponent.seek(currentChunk.position.begin);
        this.videoMediaComponent.play();
      }
    }
  };

  handleTogglePause = () => {
    this.releaseAutoPause();
    if (this.videoMediaComponent) {
      this.videoMediaComponent.togglePause();
    }
  };

  handleContinue = () => {
    switch (this.state.subtitleMode) {
      case 'manual':
        // ignore
        break;

      case 'listen':
        if (this.state.autoPaused) {
          const maxRevelation = this.props.video.subtitleTracks.size;
          const currentRevelation = this.state.subtitleState.textRevelation;

          if (currentRevelation > maxRevelation) {
            throw new Error('internal error');
          } else if (currentRevelation === maxRevelation) {
            // Continue playing video
            this.videoMediaComponent.play();
            this.releaseAutoPause();
            this.setState({
              subtitleState: null,
            });
          } else {
            // Increment state subtitleState.textRevelation
            this.setState(s => ({ subtitleState: { textRevelation: s.subtitleState.textRevelation + 1 }}));
          }
        }
        break;

      default:
        throw new Error('internal error');
    }
  };

  handleToggleRuby = () => {
    const { preferences, onSetPreference } = this.props;
    onSetPreference('showRuby', !preferences.showRuby);
  };

  handleToggleHelp = () => {
    const { preferences, onSetPreference } = this.props;
    onSetPreference('showHelp', !preferences.showHelp);
  };

  handleExit = () => {
    this.savePlaybackPosition();
    this.props.onExit();
  }

  render() {
    const { video } = this.props;

    const REVEAL_MESSAGE = '(press enter to reveal)';
    const HIDDEN_MESSAGE = '(hidden)';
    const LISTEN_MESSAGE = '(listen)';

    return (
      <div className="Player">
        <div className="Player-main">
          <div className="Player-video-area">
            <VideoWrapper videoURL={video.videoURL} initialTime={video.playbackPosition} onTimeUpdate={this.handleVideoTimeUpdate} onPlaying={this.handleVideoPlaying} onPause={this.handleVideoPause} onEnded={this.handleVideoEnded} onSeeking={this.handleVideoSeeking} ref={(c) => { this.videoMediaComponent = c; }} />
            <div className="Player-text-chunks">
              {video.subtitleTracks.valueSeq().map((subTrack, subTrackIdx) => {
                const chunk = subTrack.chunkSet ? getLastChunkAtTime(subTrack.chunkSet, this.state.textViewPosition) : null;

                if (chunk) {
                  return (
                    <div className="Player-text-chunk-outer" key={subTrack.id}>
                      <div className="Player-text-chunk-inner">
                        {(() => {
                          let message; // if set, a message to display instead of subtitle

                          switch (this.state.subtitleMode) {
                            case 'manual':
                              // don't change
                              break;

                            case 'listen':
                              if (this.state.autoPaused) {
                                if (subTrackIdx === this.state.subtitleState.textRevelation) {
                                  message = REVEAL_MESSAGE;
                                } else if (subTrackIdx > this.state.subtitleState.textRevelation) {
                                  message = HIDDEN_MESSAGE;
                                }
                              } else {
                                message = LISTEN_MESSAGE;
                              }
                              break;

                            default:
                              throw new Error('internal error');
                          }

                          return (
                            <div style={{position: 'relative'}}>
                              {message ? (
                                <div key={chunk.uid} style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                                  <div style={{color: '#aaa'}}>{message}</div>
                                </div>
                              ) : null}
                              <div style={{visibility: message ? 'hidden' : 'visible'}}>
                                <AnnoText key={chunk.uid} annoText={chunk.annoText} language={subTrack.language} showRuby={this.props.preferences.showRuby} />
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
          <PlayControls onBack={this.handleBack} onReplay={this.handleReplay} onTogglePause={this.handleTogglePause} onContinue={this.handleContinue} onToggleRuby={this.handleToggleRuby} onToggleHelp={this.handleToggleHelp} />
        </div>
        <button className="Player-big-button Player-exit-button" onClick={this.handleExit}>↩</button>
        <div className="Player-subtitle-controls-panel">
          Subtitle Mode:&nbsp;
          <Select options={Object.entries(MODE_TITLES).map(([k, v]) => ({value: k, label: v}))} onChange={this.handleSetSubtitleMode} value={this.state.subtitleMode} />&nbsp;&nbsp;
          <button onClick={e => { e.preventDefault(); this.handleToggleHelp(); }}>Toggle Help</button>
        </div>
        <div className="Player-help-panel" style={{display: this.props.preferences.showHelp ? 'block' : 'none'}}>
          <div className="Player-help-panel-section">
            <div className="Player-help-panel-header">Keyboard Controls</div>
            <table><tbody>
              <tr><td>Replay Sub:</td><td>&uarr;</td></tr>
              <tr><td>Reveal Sub /<br/>Continue:</td><td>&darr;</td></tr>
              <tr><td>Previous Sub:</td><td>&larr;</td></tr>
              <tr><td>Next Sub:</td><td>&rarr;</td></tr>
              <tr><td>Pause/Unpause:</td><td>space</td></tr>
              <tr><td>Toggle Furigana:</td><td>F</td></tr>
              <tr><td>Toggle Help:</td><td>H</td></tr>
            </tbody></table>
          </div>
          <div className="Player-help-panel-section">
            <div className="Player-help-panel-header">Mode: {MODE_TITLES[this.state.subtitleMode]}</div>
            {(() => {
              switch (this.state.subtitleMode) {
                case 'manual':
                  return (
                    <div>Manually toggle the display of each subtitle track using the number keys (e.g. 1 for the first track).</div>
                  );

                case 'listen':
                  return (
                    <div>Subtitles are initially hidden. At the end of each subtitle, the video will pause automatically. Could you hear what was said? Press &uarr; to replay, if necessary. Then press the &darr; key to reveal the subs, and check if you heard correctly. Then press &darr; to unpause the video.</div>
                  );

                default:
                  throw new Error('internal error');
              }
            })()}
          </div>
        </div>
      </div>
    );
  }
}
