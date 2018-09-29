import React, { Component } from 'react';

import './Player.css';

import Select from './Select.js';
import AnnoText from './AnnoText.js';
import PlayerExportPanel from './PlayerExportPanel';

import { getChunkAtTime, getPrevChunkAtTime, getNextChunkAtTime } from '../util/chunk';

const { remote } = window.require('electron');

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

  handleCanPlay = (e) => {
    if (e.target.webkitAudioDecodedByteCount === 0) {
      this.props.onNoAudio();
    }
  }

  render() {
    const { videoURL, initialTime, onTimeUpdate, onPlaying, onPause, onEnded, onSeeking } = this.props;
    return (
      <video src={videoURL} controls controlsList="nodownload nofullscreen" onTimeUpdate={e => { onTimeUpdate(e.target.currentTime); }} onPlaying={onPlaying} onPause={onPause} onEnded={onEnded} onSeeking={onSeeking} ref={(el) => { this.videoElem = el; }} onLoadedMetadata={e => { e.target.currentTime = initialTime ? initialTime : 0; }} onCanPlay={this.handleCanPlay} />
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

    const { onBack, onAhead, onReplay, onTogglePause, onContinue, onToggleRuby, onToggleHelp, onNumberKey, onExportCard, onToggleFullscreen } = this.props;

    if (!e.repeat) {
      if ((e.keyCode >= 49) && (e.keyCode <= 57)) {
        onNumberKey(e.keyCode - 48);
        e.preventDefault();
      } else {
        switch (e.keyCode) {
          case 37: // left arrow
            onBack();
            e.preventDefault();
            break;

          case 39: // right arrow
            onAhead();
            e.preventDefault();
            break;

          case 38: // up arrow
            onReplay();
            e.preventDefault();
            break;

          case 32: // space
            onTogglePause();
            e.preventDefault();
            break;

          case 40: // down arrow
            onContinue();
            e.preventDefault();
            break;

          case 69: // E key
            onExportCard();
            e.preventDefault();
            break;

          case 70: // F key
            // onToggleRuby();
            onToggleFullscreen();
            e.preventDefault();
            break;

          case 82: // R key
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
  qcheck: 'Quick Check',
  listen: 'Listening Practice',
  read: 'Reading Practice',
};

// Player
export default class Player extends Component {
  constructor(props) {
    super(props);
    this.videoMediaComponent = undefined;
    this.firstAnnoTextComponent = undefined;

    const subtitleMode = props.preferences.subtitleMode;
    const subtitleState = this.initialSubtitleState(subtitleMode);
    const displayedSubTime = props.video.playbackPosition;
    this.state = {
      subtitleMode, // we just initialize from preference
      subtitleState,
      displayedSubTime,
      displayedSubs: this.getSubsToDisplay(displayedSubTime, subtitleMode, subtitleState),
      noAudio: false,
      exporting: null,
    };

    this.videoTime = null;
    this.videoIsPlaying = false;
    this.subsFrozen = false;
  }

  componentDidMount() {
    this.props.onNeedSubtitles();
    this.restorePlaybackPosition();

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

    // this check is probably not perfect.. technically could have same id in different collection?
    if (this.props.video.id !== prevProps.video.id) {
      this.restorePlaybackPosition();
    }
  }

  getOrderedSubtitleTracks = () => {
    return this.props.sortSubtitleTracksMap(this.props.video.subtitleTracks);
  }

  restorePlaybackPosition = async () => {
    const position = await this.props.getSavedPlaybackPosition();
    if (this.videoElem) {
      this.videoElem.seek(position);
    }
  };

  initialSubtitleState = (mode) => {
    if ((mode === 'qcheck') || (mode === 'listen')) {
      return { tracksRevealed: 0};
    } else if (mode === 'manual') {
      return { trackHidden: [] };
    } else {
      return null;
    }
  };

  getSubsToDisplay = (time, subtitleMode, subtitleState) => {
    const result = this.getOrderedSubtitleTracks().map((subTrack, subTrackIdx) => {
      const chunk = subTrack.chunkSet ? getChunkAtTime(subTrack.chunkSet, time) : null;

      return {
        subTrack,
        chunk,
      };
    });

    return result;
  };

  savePlaybackPosition = () => {
    if ((this.videoTime !== null) && (this.videoTime !== undefined)) {
      this.props.onUpdatePlaybackPosition(this.videoTime);
    }
  };

  handleVideoTimeUpdate = (time) => {
    // console.log('time update', time, 'subsFrozen', this.subsFrozen);

    if (this.subsFrozen) {
      // If subs are frozen, we skip all the auto-pause logic and subtitle time updating
      return;
    }

    const newDisplayedSubTime = time;
    let newDisplayedSubs = this.getSubsToDisplay(newDisplayedSubTime, this.state.subtitleMode, this.state.subtitleState);
    let updateSubs = true;

    // Determine if we need to auto-pause
    // Is the video playing? Don't want to mis-trigger pause upon seeking
    if (this.videoIsPlaying) {
      // Is there at least one text track?
      if (this.state.subtitleMode === 'manual') {
      } else if (this.state.subtitleMode === 'qcheck') {
      } else if (this.state.subtitleMode === 'listen') {
        if (this.state.displayedSubs.length >= 1) {
          const currentChunk = this.state.displayedSubs[0].chunk;
          if (currentChunk) {
            // Are we passing the time that would trigger a pause?
            const PAUSE_DELAY = 0.3;
            const triggerTime = currentChunk.position.end - PAUSE_DELAY;

            if ((this.videoTime < triggerTime) && (time >= triggerTime)) {
              this.subsFrozen = true;
              updateSubs = false;
              this.videoMediaComponent.pause();
            }
          }
        }
      } else if (this.state.subtitleMode === 'read') {
        if (this.state.displayedSubs.length >= 1) {
          // TODO: A better way to do this would be to find the next sub-start even after the current time,
          // and then subtract the pause delay from that. If we are crossing that trigger time, then
          // do the pause (so we don't overshoot). We would also need to fast-forward the displayedSubTime
          // to the start of the next chunk.

          // Look up chunk (if any) before this time change
          const currentChunk = this.state.displayedSubs[0].chunk;
          const newChunk = newDisplayedSubs[0].chunk;

          if ((currentChunk !== newChunk) && newChunk) {
            this.subsFrozen = true;
            this.videoMediaComponent.pause();
          }
        }
      } else {
        throw new Error('internal error');
      }
    }

    this.videoTime = time;

    if (updateSubs) {
      let newSubtitleState = this.state.subtitleState;

      // Determine if we need to reset revelation (whether or not video is playing)
      if ((this.state.subtitleMode === 'qcheck') || (this.state.subtitleMode === 'listen')) {
        if (this.state.displayedSubs.length > 0) {
          if (newDisplayedSubs[0].chunk !== this.state.displayedSubs[0].chunk) {
            // Reset subtitle track revelation
            newSubtitleState = {tracksRevealed: 0};
          }
        }
      }

      this.setState({
        displayedSubTime: newDisplayedSubTime,
        displayedSubs: newDisplayedSubs,
        subtitleState: newSubtitleState,
      });
    }
  };

  unfreezeSubs = () => {
    this.subsFrozen = false;
  };

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
    this.unfreezeSubs();
  };

  handleNoAudio = () => {
    this.setState({noAudio: true});
  };

  handleSetSubtitleMode = (newMode) => {
    this.setState(s => {
      const newSubtitleState = this.initialSubtitleState(newMode);
      return {
        subtitleMode: newMode,
        subtitleState: newSubtitleState,
        displayedSubTime: s.displayedSubTime,
        displayedSubs: this.getSubsToDisplay(s.displayedSubTime, newMode, newSubtitleState),
      };
    });
    this.props.onSetPreference('subtitleMode', newMode);
  };

  handleBack = () => {
    if (this.videoMediaComponent) {
      const ost = this.getOrderedSubtitleTracks();
      if (ost.length > 0) {
        const firstTrack = ost[0];
        if (firstTrack.chunkSet) {
          const prevChunk = getPrevChunkAtTime(firstTrack.chunkSet, this.state.displayedSubTime);

          if (prevChunk) {
            this.videoMediaComponent.seek(prevChunk.position.begin);
            // this.videoMediaComponent.play();
          }
        }
      } else {
        this.videoMediaComponent.seekRelative(-3.0);
      }
    }
  };

  handleAhead = () => {
    if (this.videoMediaComponent) {
      const ost = this.getOrderedSubtitleTracks();
      if (ost.length > 0) {
        const firstTrack = ost[0];
        if (firstTrack.chunkSet) {
          const nextChunk = getNextChunkAtTime(firstTrack.chunkSet, this.state.displayedSubTime);

          if (nextChunk) {
            this.videoMediaComponent.seek(nextChunk.position.begin+0.05); // add a bit to fix a precision bug

            // If in read mode, we miss the start by jumping ahead, so we need to pause here
            if (this.state.subtitleMode === 'read') {
              this.videoMediaComponent.pause();
            }
          }
        }
      } else {
        this.videoMediaComponent.seekRelative(3.0);
      }
    }
  };

  handleReplay = () => {
    if (this.videoMediaComponent) {
      const currentChunk = (this.state.displayedSubs.length > 0) ? this.state.displayedSubs[0].chunk : null;

      if (currentChunk) {
        this.videoMediaComponent.seek(currentChunk.position.begin+0.05); // add a bit to fix a precision bug
        this.videoMediaComponent.play();
      }
    }
  };

  handleTogglePause = () => {
    this.unfreezeSubs();
    if (this.videoMediaComponent) {
      this.videoMediaComponent.togglePause();
    }
  };

  handleContinue = () => {
    switch (this.state.subtitleMode) {
      case 'manual':
        this.videoMediaComponent.play();
        break;

      case 'qcheck': // fall through
      case 'listen':
        const maxRevelation = this.state.displayedSubs.length;
        const currentRevelation = this.state.subtitleState.tracksRevealed;

        if (currentRevelation > maxRevelation) {
          throw new Error('internal error');
        } else if (currentRevelation === maxRevelation) {
          // Continue playing video
          this.videoMediaComponent.play();
          this.unfreezeSubs();
        } else {
          // Reveal one more subtitle track
          this.setState(s => {
            const newSubtitleState = {tracksRevealed: s.subtitleState.tracksRevealed + 1};
            return {
              ...s,
              subtitleState: newSubtitleState,
              displayedSubs: this.getSubsToDisplay(s.displayedSubTime, s.subtitleMode, newSubtitleState),
            };
          });

          if (this.state.subtitleMode === 'qcheck') {
            this.videoMediaComponent.pause();
          }
        }
        break;

      case 'read':
        // This appears safe to do even if the video is already playing
        this.videoMediaComponent.play();
        this.unfreezeSubs();
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

  handleNumberKey = (number) => {
    if (this.state.subtitleMode === 'manual') {
      const newTrackHidden = [...this.state.subtitleState.trackHidden];
      const znumber = number - 1;
      newTrackHidden[znumber] = !newTrackHidden[znumber];
      this.setState({subtitleState: {trackHidden: newTrackHidden}});
    }
  };

  handleExportCard = () => {
    if (!this.state.displayedSubs.length) {
      return;
    }

    const currentChunk = this.state.displayedSubs[0].chunk;
    if (!currentChunk) {
      return;
    }

    this.setState(state => {
      const newState = {...state};
      if (!state.exporting) {
        newState.exporting = {
          chunk: currentChunk,
          videoTime: this.videoTime,
          selectedText: this.firstAnnoTextComponent ? this.firstAnnoTextComponent.getSelectedText() : null,
        };
      }
      return newState;
    });
  };

  handleExportDone = () => {
    this.setState({
      exporting: null,
    });
  };

  handleToggleFullscreen = () => {
    const currentWindow = remote.getCurrentWindow();
    currentWindow.setFullScreen(!currentWindow.isFullScreen());
  };

  handleExit = () => {
    this.savePlaybackPosition();
    this.props.onExit();
  }

  render() {
    const { video } = this.props;

    return (
      <div className="Player">
        <div className="Player-main">
          <div className="Player-video-area">
            <VideoWrapper videoURL={video.videoURL} initialTime={video.playbackPosition} onTimeUpdate={this.handleVideoTimeUpdate} onPlaying={this.handleVideoPlaying} onPause={this.handleVideoPause} onEnded={this.handleVideoEnded} onSeeking={this.handleVideoSeeking} onNoAudio={this.handleNoAudio} ref={(c) => { this.videoMediaComponent = c; }} />
            <div className="Player-text-chunks">
              {this.state.displayedSubs.map(({ subTrack, chunk }, subTrackIdx) => {
                let hidden = false;

                if (((this.state.subtitleMode === 'qcheck') || (this.state.subtitleMode === 'listen')) && (subTrackIdx >= this.state.subtitleState.tracksRevealed)) {
                  hidden = true;
                } else if ((this.state.subtitleMode === 'manual') && (this.state.subtitleState.trackHidden[subTrackIdx])) {
                  hidden = true;
                }

                return chunk ? (
                  <div className="Player-text-chunk-outer" key={subTrack.id}>
                    <div className="Player-text-chunk-inner">
                      <div style={{position: 'relative'}}>
                        {hidden ? (
                          <div key={chunk.uid} className="Player-text-reveal-instructions">
                            <div style={{color: '#aaa'}}>(press &darr; to reveal)</div>
                          </div>
                        ) : null}
                        <div className={'Player-text-chunk-annotext Player-text-chunk-annotext-' + (hidden ? 'hidden' : 'visible')}>
                          <AnnoText key={chunk.uid} annoText={chunk.annoText} language={subTrack.language} showRuby={this.props.preferences.showRuby} searchDictionaries={this.props.searchDictionaries} ref={(subTrackIdx === 0) ? (c => { this.firstAnnoTextComponent = c; }) : null} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
          <PlayControls onBack={this.handleBack} onAhead={this.handleAhead} onReplay={this.handleReplay} onTogglePause={this.handleTogglePause} onContinue={this.handleContinue} onToggleRuby={this.handleToggleRuby} onToggleHelp={this.handleToggleHelp} onNumberKey={this.handleNumberKey} onExportCard={this.handleExportCard} onToggleFullscreen={this.handleToggleFullscreen} />
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
              <tr><td>Reveal Sub /<br/>Unpause:</td><td>&darr;</td></tr>
              <tr><td>Previous Sub:</td><td>&larr;</td></tr>
              <tr><td>Next Sub:</td><td>&rarr;</td></tr>
              <tr><td>Pause/Unpause:</td><td>space</td></tr>
              <tr><td>Export To Anki:</td><td>E</td></tr>
              <tr><td>Toggle Fullscreen:</td><td>F</td></tr>
              <tr><td>Toggle Furigana/Ruby:</td><td>R</td></tr>
              <tr><td>Toggle Help:</td><td>H</td></tr>
              {(this.state.subtitleMode === 'manual') ? (
                <tr><td>Hide/Show<br />Sub Track:</td><td>[1-9]</td></tr>
              ) : null}
            </tbody></table>
          </div>
          <div className="Player-help-panel-section">
            <div className="Player-help-panel-header">Mode: {MODE_TITLES[this.state.subtitleMode]}</div>
            {(() => {
              switch (this.state.subtitleMode) {
                case 'manual':
                  return (
                    <div>Manually toggle the display of each subtitle track using the number keys (e.g. 1 for the first track). To be honest, this mode is pretty boring and you should try the others.</div>
                  );

                case 'qcheck':
                  return (
                    <div>Subtitles are normally hidden, but when you press &darr; the video is paused and the (first) subtitle track is revealed. Press &darr; to reveal more subtitle tracks, if any. Then press &darr; to unpause the video and continue. This mode is useful if you can generally understand the video and want to avoid reading the subtitles unless you need them.</div>
                  );

                case 'listen':
                  return (
                    <div>Subtitles are initially hidden. At the end of each subtitle, the video will pause automatically. Could you hear what was said? Press &uarr; to replay, if necessary. Then press the &darr; key to reveal the subs, and check if you heard correctly. Then press &darr; to unpause the video.</div>
                  );

                case 'read':
                  return (
                    <div>At the start of each new subtitle, the video will pause automatically. Try reading the sub. Then press &darr; to unpause the video, and hear it spoken. Did you read it correctly?</div>
                  );

                default:
                  throw new Error('internal error');
              }
            })()}
          </div>
        </div>
        { this.state.noAudio ? (
          <div className="Player-no-audio-warning-layer">
            <div className="Player-no-audio-warning">
              video file has no audio or<br />an unsupported audio codec
            </div>
          </div>
        ) : null}
        { this.state.exporting ? (
          <div className="Player-export-panel">
            <PlayerExportPanel ankiPrefs={this.props.ankiPrefs} onExtractAudio={this.props.onExtractAudio} onExtractFrameImage={this.props.onExtractFrameImage} onDone={this.handleExportDone} {...this.state.exporting} />
          </div>
        ) : null}
      </div>
    );
  }
}
