import React, { Component } from 'react';
import TextareaAutosize from 'react-autosize-textarea';

import { ankiConnectInvoke } from '../util/ankiConnect';
import genuid from '../util/uid';
import { customRender as annoTextCustomRender } from '../util/annotext';

import './PlayerExportPanel.css';

export default class PlayerExportPanel extends Component {
  constructor(props) {
    super(props);

    const { ankiPrefs, chunk, videoTime } = this.props;

    const textWithReadings = annoTextCustomRender(
      chunk.annoText,
      (a, inner) => {
        if (a.kind === 'ruby') {
          return [' ', ...inner, '[', a.data, ']'];
        } else {
          return inner;
        }
      },
      (c, i) => (c)
    ).join('').trim();

    let audioDataPromise;
    if ([...ankiPrefs.fieldMap.values()].includes('audio')) {
      const AUDIO_EXTRACT_PADDING = 0.25;
      let paddedBegin = chunk.position.begin - AUDIO_EXTRACT_PADDING;
      if (paddedBegin < 0) {
        paddedBegin = 0;
      }
      const paddedEnd = chunk.position.end + AUDIO_EXTRACT_PADDING;

      console.time('extracting audio');
      audioDataPromise = this.props.onExtractAudio(paddedBegin, paddedEnd);
      audioDataPromise.then(audioData => {
        console.timeEnd('extracting audio');
        this.setState(state => {
          const newState = {...state};

          for (const [ankifn, vorfn] of ankiPrefs.fieldMap.entries()) {
            if (vorfn === 'audio') {
              this.state.fieldData.set(ankifn, audioData);
            }
          }

          return newState;
        })
      });
    }

    let imageDataPromise;
    if ([...ankiPrefs.fieldMap.values()].includes('image')) {
      console.time('extracting image');
      imageDataPromise = this.props.onExtractFrameImage(videoTime);
      imageDataPromise.then(imageData => {
        console.timeEnd('extracting image');
        this.setState(state => {
          const newState = {...state};

          for (const [ankifn, vorfn] of ankiPrefs.fieldMap.entries()) {
            if (vorfn === 'image') {
              this.state.fieldData.set(ankifn, imageData);
            }
          }

          return newState;
        })
      });
    }

    const fieldData = new Map();
    for (const [ankifn, vorfn] of ankiPrefs.fieldMap.entries()) {
      if (vorfn === 'text') {
        fieldData.set(ankifn, chunk.annoText.text);
      } else if (vorfn === 'text_readings') {
        fieldData.set(ankifn, textWithReadings);
      } else if (vorfn === 'audio') {
        fieldData.set(ankifn, audioDataPromise);
      } else if (vorfn === 'image') {
        fieldData.set(ankifn, imageDataPromise);
      }
    }

    this.state = {
      fieldData,
      exporting: false,
      statusMessage: '',
    };
  }

  componentDidMount() {
    document.body.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    document.body.removeEventListener('keydown', this.handleKeyDown);
  }

  handleExport = async () => {
    const { ankiPrefs } = this.props;

    if (this.state.exporting) {
      return;
    }

    this.setState({
      exporting: true,
      statusMessage: 'Waiting for media...',
    });

    const fieldData = this.state.fieldData;

    // Wait for audio, if necessary
    const mediaPromises = [];
    for (const [ankifn, vorfn] of ankiPrefs.fieldMap.entries()) {
      if ((vorfn === 'audio') && (vorfn === 'image')) {
        mediaPromises.push(fieldData.get(ankifn));
      }
    }
    await Promise.all(mediaPromises);

    this.setState({
      statusMessage: 'Exporting media...',
    });

    const addNoteFields = {};
    for (const [ankifn, vorfn] of ankiPrefs.fieldMap.entries()) {
      if ((vorfn === 'text') || (vorfn === 'text_readings') || (vorfn === 'nofill')) {
        addNoteFields[ankifn] = fieldData.get(ankifn);
      } else if (vorfn === 'audio') {
        // NOTE: If audio is being sent to multiple fields, each will get its own file
        const audioFilename = 'voracious_' + genuid() + '.mp3';

        console.time('store audio to Anki');
        try {
          await ankiConnectInvoke('storeMediaFile', 6, {
            filename: audioFilename,
            data: fieldData.get(ankifn).toString('base64'),
          });
        } catch (e) {
          this.setState({
            exporting: false,
            statusMessage: e.toString(),
          });
          return;
        }
        console.timeEnd('store audio to Anki');

        addNoteFields[ankifn] = '[sound:' + audioFilename + ']';
      } else if (vorfn === 'image') {
        // NOTE: If image is being sent to multiple fields, each will get its own file
        const imageFilename = 'voracious_' + genuid() + '.jpg';

        console.time('store image to Anki');
        try {
          await ankiConnectInvoke('storeMediaFile', 6, {
            filename: imageFilename,
            data: fieldData.get(ankifn).toString('base64'),
          });
        } catch (e) {
          this.setState({
            exporting: false,
            statusMessage: e.toString(),
          });
          return;
        }
        console.timeEnd('store image to Anki');

        addNoteFields[ankifn] = '<img src="' + imageFilename + '" />';
      } else {
        throw new Error('unrecognized field type');
      }
    }

    this.setState({
      statusMessage: 'Exporting note...',
    });

    console.time('add note to Anki');
    try {
      await ankiConnectInvoke('addNote', 6, {
        'note': {
          'deckName': ankiPrefs.deckName,
          'modelName': ankiPrefs.modelName,
          'tags': ['voracious'],
          'fields': addNoteFields,
        },
      });
    } catch (e) {
      this.setState({
        exporting: false,
        statusMessage: e.toString(),
      });
      return;
    }
    console.timeEnd('add note to Anki');

    this.props.onDone();
  };

  handleFieldChange = (fn, value) => {
    this.setState(state => {
      const newState = {...state};
      newState.fieldData.set(fn, value);
      return newState;
    });
  };

  handleDone = () => {
    if (this.state.exporting) {
      return;
    }

    this.props.onDone();
  };

  handleKeyDown = (e) => {
    // Only process event if the target is the body,
    // to avoid messing with typing into input elements, etc.
    // Should we do this instead? e.target.tagName.toUpperCase() === 'INPUT'
    if (e.target !== document.body) {
      return;
    }

    if (!e.repeat) {
      switch (e.keyCode) {
        case 13: // enter
          e.preventDefault();
          this.handleExport();
          break;

        case 27: // esc
          e.preventDefault();
          this.handleDone();
          break;

        default:
          // ignore
          break;
      }
    }
  };

  render() {
    const { ankiPrefs } = this.props;

    const configured = (ankiPrefs.modelName && ankiPrefs.deckName && ankiPrefs.fieldMap);

    return (
      <div className="PlayerExportPanel">
        <div className="PlayerExportPanel-buttons">
          <div>
            <button onClick={this.handleExport} disabled={this.state.exporting || !configured}>Export [enter]</button>{' '}
            <button onClick={this.handleDone} disabled={this.state.exporting}>Cancel [esc]</button><br/>
          </div>
          <div className="PlayerExportPanel-status-message">{this.state.statusMessage}</div>
        </div>
        <div className="PlayerExportPanel-header">Export to Anki</div>
        {configured ? (
          <div>
            <div>{[...ankiPrefs.fieldMap.entries()].map(([ankifn, vorfn]) => {
              if (vorfn === 'audio') {
                return (
                  <div key={ankifn} className="PlayerExportPanel-field"><label>{ankifn}<div className="PlayerExportPanel-field-value">{this.state.fieldData.get(ankifn).then ? '[extracting audio...]' : '[audio]'}</div></label></div>
                );
              } else if (vorfn === 'image') {
                return (
                  <div key={ankifn} className="PlayerExportPanel-field"><label>{ankifn}<div className="PlayerExportPanel-field-value">{this.state.fieldData.get(ankifn).then ? '[extracting image...]' : '[image]'}</div></label></div>
                );
              } else {
                return (
                  <div key={ankifn} className="PlayerExportPanel-field"><label>{ankifn}<div className="PlayerExportPanel-field-value"><TextareaAutosize value={this.state.fieldData.get(ankifn)} rows={1} maxRows={6} onChange={(e) => { this.handleFieldChange(ankifn, e.target.value); }} /></div></label></div>
                );
              }
            })}</div>
          </div>
        ) : (
          <div>You need to configure your Anki settings before you can export. Back out and go to Settings.</div>
        )}
      </div>
    );
  }
}
