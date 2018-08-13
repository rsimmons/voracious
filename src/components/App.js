import React, { Component } from 'react';
import { BrowserRouter as Router, Link, NavLink, Switch, Route, Redirect } from 'react-router-dom';

import './App.css';

import Button from './Button.js';
import Player from './Player.js';
import AddCollection from './AddCollection.js';

import { downloadFile } from '../util/download';

// App
class App extends Component {
  handleExportBackup = () => {
    // TODO: Is calling this actions method hacky? It's not an action, really. But it makes sense if we think of actions as a model, I guess.
    const backupData = JSON.stringify(this.props.actions._saveToJSONable());
    downloadFile(backupData, 'voracious_backup_' + (new Date()).toISOString() + '.json', 'application/json');
  };

  render() {
    const { mainState, actions } = this.props;

    if (mainState.loading) {
      return <h1>Loading...</h1>;
    } else {
      return (
        <Router>
          <Switch>
            <Route path="/player/:cid/:vid" render={({ match, history }) => {
              const collectionId = decodeURIComponent(match.params.cid);
              const videoId = decodeURIComponent(match.params.vid);
              return <Player video={mainState.collections.get(collectionId).videos.get(videoId)} onExit={() => { history.goBack(); }} onUpdatePlaybackPosition={(pos) => { actions.saveVideoPlaybackPosition(collectionId, videoId, pos); }} onNeedSubtitles={() => { actions.loadSubtitlesIfNeeded(collectionId, videoId); }} />;
            }}/>
            <Route path="/add_collection" render={({ history }) => {
              return <AddCollection onAdd={(name, dir) => { actions.addLocalCollection(name, dir); history.replace('/library'); }} onExit={() => { history.goBack(); }} />;
            }}/>
            <Route render={() => (
              <div className="App-main-wrapper">
                <nav className="App-main-nav header-font">
                  <NavLink to={'/library'} activeClassName="selected">Library</NavLink>
                  <NavLink to={'/settings'} activeClassName="selected">Settings</NavLink>
                </nav>
                <div className="App-below-main-nav">
                  <Switch>
                    <Route path="/library" render={({ history }) => (
                      <ul>
                        {mainState.collections.valueSeq().map((collection) => (
                          <li className="App-collection" key={collection.id}>
                            <div className="App-collection-header">
                              <h2 className="App-collection-title header-font">{collection.name}</h2>
                              <div className="App-collection-id">{collection.id}</div>
                            </div>
                            <ul>
                              {collection.videos.valueSeq().map((video) => (
                                <li key={video.id} className="App-library-list-item">
                                  <Link to={'/player/' + encodeURIComponent(collection.id) + '/' + encodeURIComponent(video.id)}>
                                    {video.name} [{video.subtitleTracks.size}]
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    )}/>
                    <Route path="/settings" render={({history}) => (
                      <div>
                        <Button onClick={() => {history.push('/add_collection'); }}>Add Collection</Button>
                        <Button onClick={this.handleExportBackup}>Export Backup</Button>
                      </div>
                    )}/>
                    <Redirect to="/library"/>
                  </Switch>
                </div>
              </div>
            )}/>
          </Switch>
        </Router>
      );
    }
  }
}

export default App;
