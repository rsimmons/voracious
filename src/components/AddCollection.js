import React, { Component } from 'react';

import './AddCollection.css';

import Button from './Button.js';

const { ipcRenderer } = window.require('electron'); // use window to avoid webpack

export default class AddCollection extends Component {
  constructor(props) {
    super(props);

    this.state = {
      collectionName: '',
      collectionDirectory: undefined,
    };

    ipcRenderer.on('chose-collection-directory', this.handleIpcChoseCollectionDirectory);
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('chose-collection-directory', this.handleIpcChoseCollectionDirectory);
  }

  handleNameChange = (e) => {
    this.setState({collectionName: e.target.value});
  };

  handleIpcChoseCollectionDirectory = (e, dir) => {
    this.setState({collectionDirectory: dir});
  };

  handleClickChooseCollectionDirectory = () => {
    ipcRenderer.send('choose-collection-directory');
  };

  handleAddCollection = () => {
    this.props.onAdd(this.state.collectionName, this.state.collectionDirectory);
  };

  render() {
    const { onExit } = this.props;

    return (
      <div>
        <button className="AddCollection-big-button AddCollection-exit-button" onClick={onExit}>↩</button>
        <br />
        <br />
        <br />
        <div><label>Name: <input value={this.state.collectionName} onChange={this.handleNameChange} placeholder="My Videos" /></label></div>
        <div>Folder: {this.state.collectionDirectory || <span><i>Not selected</i></span>}</div>
        <Button onClick={this.handleClickChooseCollectionDirectory}>Select Collection Folder</Button>
        <Button disabled={!this.state.collectionName || !this.state.collectionDirectory} onClick={this.handleAddCollection}>Add Collection</Button>
      </div>
    );
  }
}
