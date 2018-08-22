import React, { Component } from 'react';

import './ImportEpwing.css';

import SecondaryScreen from './SecondaryScreen.js';
import SystemBrowserLink from './SystemBrowserLink.js';
import Button from './Button.js';
import { importEpwing, openDictionaries } from '../dictionary';

const { ipcRenderer } = window.require('electron'); // use window to avoid webpack

export default class ImportEpwing extends Component {
  constructor(props) {
    super(props);

    this.state = {
      epwingDirectory: undefined,
      importing: false,
      statusType: 'working',
      statusText: '',
    };

    ipcRenderer.on('chose-directory', this.handleIpcChoseDirectory);
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('chose-directory', this.handleIpcChoseDirectory);
  }

  handleIpcChoseDirectory = (e, dir) => {
    this.setState({epwingDirectory: dir});
  };

  handleClickChooseDirectory = (e) => {
    e.preventDefault();
    ipcRenderer.send('choose-directory', 'Choose EPWING folder');
  };

  handleImport = async () => {
    this.setState({
      importing: true,
      statusType: 'working',
      statusText: 'Importing ' + this.state.epwingDirectory + '... (may take a while)',
    });

    try {
      await importEpwing(this.state.epwingDirectory);

      await openDictionaries(progressMsg => {
        this.setState({
          statusText: 'Reloading dictionaries: ' + progressMsg,
        });
      });

      this.setState({
        importing: false,
        statusType: 'success',
        statusText: 'EPWING imported successfully',
        epwingDirectory: undefined,
      });
    } catch (e) {
      console.log(e.message);
      let statusText = 'Something went wrong';
      if (e.message.includes('unrecognized dictionary format')) {
        statusText = 'The folder you selected does not appear to be an EPWING dictionary';
      } else if (e.message.includes('failed to find compatible extractor')) {
        statusText = 'The EPWING you selected is not supported (see instructions above)';
      }

      this.setState({
        importing: false,
        statusType: 'error',
        statusText: statusText,
      });
    }
  };

  render() {
    const { onExit } = this.props;

    return (
      <SecondaryScreen title="Import EPWING Dictionary">
        <div>If your EPWING dictionary is archived (e.g. a ZIP or RAR file), first unarchive it. Then choose its root folder, the one that contains the CATALOGS file. Note that Voracious relies on Yomichan Importer to import EPWINGS, and only certain specific dictionaries are supported (<SystemBrowserLink href="https://foosoft.net/projects/yomichan-import/">see the list here</SystemBrowserLink>).</div>
        <br />
        <div>Folder: {this.state.epwingDirectory || <span><i>None selected</i></span>} <button disabled={this.state.importing} onClick={this.handleClickChooseDirectory}>Choose Folder</button></div>
        <br />
        <div className={'ImportEpwing-status ImportEpwing-status-' + this.state.statusType}>{this.state.statusText}&nbsp;</div>
        <br />
        <div>
          <Button disabled={!this.state.epwingDirectory || this.state.importing} onClick={this.handleImport}>Import Selected Folder</Button>&nbsp;
          <Button disabled={this.state.importing} onClick={onExit}>Back</Button>
        </div>
      </SecondaryScreen>
    );
  }
}
