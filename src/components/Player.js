import React, { Component } from 'react';

import './Player.css';

import Select from './Select.js';
import AnnoText from './AnnoText.js';

import { getChunkAtTime, getPrevChunkAtTime, getNextChunkAtTime } from '../util/chunk';

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

    const { onBack, onAhead, onReplay, onTogglePause, onContinue, onToggleRuby, onToggleHelp } = this.props;

    if (!e.repeat) {
      switch (e.keyCode) {
        case 37: // left arrow
          onBack();
          break;

        case 39: // right arrow
          onAhead();
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
  read: 'Reading Test',
};

// Player
export default class Player extends Component {
  constructor(props) {
    super(props);
    this.videoMediaComponent = undefined;

    const subtitleMode = props.preferences.subtitleMode;
    const subtitleState = this.initialSubtitleState(subtitleMode);
    const displayedSubTime = props.video.playbackPosition;
    this.state = {
      subtitleMode, // we just initialize from preference
      subtitleState,
      displayedSubTime,
      displayedSubs: this.getSubsToDisplay(displayedSubTime, subtitleMode, subtitleState),
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

  restorePlaybackPosition = async () => {
    const position = await this.props.getSavedPlaybackPosition();
    if (this.videoElem) {
      this.videoElem.seek(position);
    }
  };

  initialSubtitleState = (mode) => {
    if (mode === 'listen') {
      return { tracksRevealed: 0};
    } else {
      return null;
    }
  };

  getSubsToDisplay = (time, subtitleMode, subtitleState) => {
    const { video } = this.props;

    const result = video.subtitleTracks.valueSeq().toArray().map((subTrack, subTrackIdx) => {
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

    const { video } = this.props;

    const newDisplayedSubTime = time;
    let newDisplayedSubs = this.getSubsToDisplay(newDisplayedSubTime, this.state.subtitleMode, this.state.subtitleState);
    let updateSubs = true;

    // Determine if we need to auto-pause
    // Is the video playing? Don't want to mis-trigger pause upon seeking
    if (this.videoIsPlaying) {
      // Is there at least one text track?
      if (this.state.subtitleMode === 'manual') {
      } else if (this.state.subtitleMode === 'listen') {
        if (video.subtitleTracks.size >= 1) {
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
        if (video.subtitleTracks.size >= 1) {
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

      // Determine if we need to reset revelation in listen mode (whether or not video is playing)
      if (this.state.subtitleMode === 'listen') {
        if (video.subtitleTracks.size >= 1) {
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
    const { video } = this.props;

    if (this.videoMediaComponent) {
      if (video.subtitleTracks.size > 0) {
        const firstTrack = video.subtitleTracks.first();
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
    const { video } = this.props;

    if (this.videoMediaComponent) {
      if (video.subtitleTracks.size > 0) {
        const firstTrack = video.subtitleTracks.first();
        if (firstTrack.chunkSet) {
          const nextChunk = getNextChunkAtTime(firstTrack.chunkSet, this.state.displayedSubTime);

          if (nextChunk) {
            this.videoMediaComponent.seek(nextChunk.position.begin);
            // this.videoMediaComponent.play();
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
        this.videoMediaComponent.seek(currentChunk.position.begin);
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

      case 'listen':
        const maxRevelation = this.props.video.subtitleTracks.size;
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
            <VideoWrapper videoURL={video.videoURL} initialTime={video.playbackPosition} onTimeUpdate={this.handleVideoTimeUpdate} onPlaying={this.handleVideoPlaying} onPause={this.handleVideoPause} onEnded={this.handleVideoEnded} onSeeking={this.handleVideoSeeking} ref={(c) => { this.videoMediaComponent = c; }} />
            <div className="Player-text-chunks">
              {this.state.displayedSubs.map(({ subTrack, chunk }, subTrackIdx) => {
                let hidden = false;

                if ((this.state.subtitleMode === 'listen') && (subTrackIdx >= this.state.subtitleState.tracksRevealed)) {
                  hidden = true;
                }

                return chunk ? (
                  <div className="Player-text-chunk-outer" key={subTrack.id}>
                    <div className="Player-text-chunk-inner">
                      <div style={{position: 'relative'}}>
                        {hidden ? (
                          <div key={chunk.uid} style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                            <div style={{color: '#aaa'}}>(press &darr; to reveal)</div>
                          </div>
                        ) : null}
                        <div style={{visibility: hidden ? 'hidden' : 'visible'}}>
                          <AnnoText key={chunk.uid} annoText={chunk.annoText} language={subTrack.language} showRuby={this.props.preferences.showRuby} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
          <PlayControls onBack={this.handleBack} onAhead={this.handleAhead} onReplay={this.handleReplay} onTogglePause={this.handleTogglePause} onContinue={this.handleContinue} onToggleRuby={this.handleToggleRuby} onToggleHelp={this.handleToggleHelp} />
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
                    <div>Manually toggle the display of each subtitle track using the number keys (e.g. 1 for the first track). To be honest, this mode is pretty boring and you should try the others.</div>
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
      </div>
    );
  }
}
