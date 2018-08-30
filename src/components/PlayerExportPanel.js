import React, { Component } from 'react';
import TextareaAutosize from 'react-autosize-textarea';

import { ankiConnectInvoke } from '../util/ankiConnect';
import genuid from '../util/uid';
import { customRender as annoTextCustomRender } from '../util/annotext';

import './PlayerExportPanel.css';

export default class PlayerExportPanel extends Component {
  constructor(props) {
    super(props);

    const { ankiPrefs, chunk } = this.props;

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
      console.time('extracting audio');
      audioDataPromise = this.props.onExtractAudio(chunk.position.begin, chunk.position.end);
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

    const fieldData = new Map();
    for (const [ankifn, vorfn] of ankiPrefs.fieldMap.entries()) {
      if (vorfn === 'text') {
        fieldData.set(ankifn, chunk.annoText.text);
      } else if (vorfn === 'text_readings') {
        fieldData.set(ankifn, textWithReadings);
      } else if (vorfn === 'audio') {
        fieldData.set(ankifn, audioDataPromise);
      }
    }

    this.state = {
      fieldData,
      exporting: false,
      statusMessage: '',
    };
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
      if (vorfn === 'audio') {
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
    this.props.onDone();
  }

  render() {
    const { ankiPrefs } = this.props;

    // TODO: disable Export if (!ankiPrefs.modelName || !ankiPrefs.deckName)

    return (
      <div className="PlayerExportPanel">
        <div className="PlayerExportPanel-header">Export to Anki</div>
        {(ankiPrefs.modelName && ankiPrefs.deckName && ankiPrefs.fieldMap) ? (
          <div>
            <div>{[...ankiPrefs.fieldMap.entries()].map(([ankifn, vorfn]) => {
              if (vorfn === 'audio') {
                return (
                  <div key={ankifn} className="PlayerExportPanel-field"><label>{ankifn}<div className="PlayerExportPanel-field-value">{this.state.fieldData.get(ankifn).then ? '[extracting audio...]' : '[audio]'}</div></label></div>
                );
              } else {
                return (
                  <div key={ankifn} className="PlayerExportPanel-field"><label>{ankifn}<div className="PlayerExportPanel-field-value"><TextareaAutosize value={this.state.fieldData.get(ankifn)} rows={1} maxRows={6} onChange={(e) => { this.handleFieldChange(ankifn, e.target.value); }} /></div></label></div>
                );
              }
            })}</div>
            <div>
              <button onClick={this.handleExport} disabled={this.state.exporting}>Export</button>{' '}
              <button onClick={this.handleDone} disabled={this.state.exporting}>Cancel</button>{' '}
              <span>{this.state.statusMessage}</span>
            </div>
          </div>
        ) : (
          <div>
            <div>You need to configure your Anki settings before you can export. Back out and go to Settings.</div>
            <div>
              <button onClick={this.handleDone} disabled={this.state.exporting}>Cancel</button>{' '}
            </div>
          </div>
        )}
      </div>
    );
  }
}
