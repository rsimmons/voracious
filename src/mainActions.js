import { List, Record, Map as IMap } from 'immutable';

import createStorageBackend from './storage';
import { getCollectionIndex, loadCollectionSubtitleTrack } from './library';
import { openDictionaries } from './dictionary';

const jstr = JSON.stringify; // alias
const jpar = JSON.parse; // alias

const PreferencesRecord = new Record({
  showRuby: true,
  showHelp: true,
  subtitleMode: 'manual',
  subtitleOrder: new List(['jpn', 'eng']), // list of iso639-3 codes
});

const MainStateRecord = new Record({
  modalLoadingMessage: null,
  collections: new IMap(), // locator -> CollectionRecord
  preferences: new PreferencesRecord(),
});

const CollectionRecord = new Record({
  locator: undefined,
  name: undefined,
  titles: new List(), // of TitleRecords
  videos: new IMap() // id -> VideoRecord,
});

const TitleRecord = new Record({
  name: undefined,
  series: undefined,
  videoId: undefined, // only defined if not a series
  parts: undefined, // only defined if a series
});

const VideoRecord = new Record({
  id: undefined,
  name: undefined,
  videoURL: undefined,
  subtitleTracks: new IMap(), // id -> SubtitleTrackRecord
  playbackPosition: 0,
});

const SubtitleTrackRecord = new Record({
  id: undefined,
  language: undefined,
  chunkSet: undefined,
});

export default class MainActions {
  constructor(subscribableState) {
    this.state = subscribableState;

    this.initializeState().then(() => {
      console.log('MainActions state initialized');
    });
  }

  initializeState = async () => {
    this.state.set(new MainStateRecord());

    this._setLoadingMessage('Loading profile...');

    this.storage = await createStorageBackend();

    await this._storageLoadProfile();

    this._setLoadingMessage('Loading dictionaries...');

    await openDictionaries();

    this._clearLoadingMessage();
  };

  _clearLoadingMessage = (msg) => {
    this.state.set(this.state.get().set('modalLoadingMessage', null));
  };

  _setLoadingMessage = (msg) => {
    this.state.set(this.state.get().set('modalLoadingMessage', msg));
  };

  _addCollection = async (name, locator) => {
    const collectionIndex = await getCollectionIndex(locator);

    const collectionVideoRecords = []; // [k, v] pairs
    for (const vid of collectionIndex.videos) {
      const subTrackKVs = []; // [k, v] pairs
      for (const stid of vid.subtitleTrackIds) {
        subTrackKVs.push([stid, new SubtitleTrackRecord({id: stid})]);
      }

      collectionVideoRecords.push([vid.id, new VideoRecord({
        id: vid.id,
        name: vid.name,
        videoURL: vid.url,
        subtitleTracks: new IMap(subTrackKVs),
        // remaining fields are OK to leave as default
      })]);
    }

    const collectionTitleRecords = [];
    for (const title of collectionIndex.titles) {
      collectionTitleRecords.push(new TitleRecord({
        name: title.name,
        series: title.series,
        videoId: title.videoId, // only defined if not a series
        parts: title.parts, // only defined if a series
      }));
    }

    this.state.set(this.state.get().setIn(['collections', locator], new CollectionRecord({
      locator,
      name,
      videos: new IMap(collectionVideoRecords),
      titles: new List(collectionTitleRecords),
    })));
  }

  _storageLoadProfile = async () => {
    const profileStr = await this.storage.getItemMaybe('profile');

    if (profileStr) {
      const profile = jpar(profileStr);

      for (const col of profile.collections) {
        await this._addCollection(col.name, col.locator);
      }

      this.state.set(this.state.get().setIn(['preferences', 'showRuby'], profile.preferences.showRuby));
      this.state.set(this.state.get().setIn(['preferences', 'showHelp'], profile.preferences.showHelp));
      this.state.set(this.state.get().setIn(['preferences', 'subtitleMode'], profile.preferences.subtitleMode));
      this.state.set(this.state.get().setIn(['preferences', 'subtitleOrder'], new List(profile.preferences.subtitleOrder)));
    } else {
      // Key wasn't present, so initialize to default state

      // TODO: update state with default profile info, if any

      // Save our empty/default profile
      this._storageSaveProfile();
    }
  };

  _storageSaveProfile = async () => {
    const state = this.state.get();

    const profileObj = {
      collections: [],
      preferences: {
        showRuby: state.preferences.showRuby,
        showHelp: state.preferences.showHelp,
        subtitleMode: state.preferences.subtitleMode,
        subtitleOrder: state.preferences.subtitleOrder.toArray(),
      },
    };

    for (const collection of state.collections.values()) {
      profileObj.collections.push({
        locator: collection.locator,
        name: collection.name,
      });
    }

    await this.storage.setItem('profile', jstr(profileObj));
  };

  loadVideoPlaybackPosition = async (collectionLocator, videoId) => {
    const positionStr = await this.storage.getItemMaybe('playback_position/' + encodeURIComponent(collectionLocator) + '/' + encodeURIComponent(videoId));
    if (!positionStr) {
      return 0;
    }

    const position = jpar(positionStr);

    // In addition to (asynchronously) returning the position, we update the in-memory state to have it
    this.state.set(this.state.get().setIn(['collections', collectionLocator, 'videos', videoId, 'playbackPosition'], position));

    return position;
  };

  _storageSavePlaybackPosition = async (collectionLocator, videoId, position) => {
    await this.storage.setItem('playback_position/' + encodeURIComponent(collectionLocator) + '/' + encodeURIComponent(videoId), jstr(position));
  };

  saveVideoPlaybackPosition = async (collectionLocator, videoId, position) => {
    const currentPosition = this.state.get().collections.get(collectionLocator).videos.get(videoId).playbackPosition;
    if (position === currentPosition) {
      return;
    }

    this.state.set(this.state.get().setIn(['collections', collectionLocator, 'videos', videoId, 'playbackPosition'], position));

    await this._storageSavePlaybackPosition(collectionLocator, videoId, position);
  };

  loadSubtitlesIfNeeded = async (collectionLocator, videoId) => {
    const subTracks = this.state.get().getIn(['collections', collectionLocator, 'videos', videoId, 'subtitleTracks']);

    for (const subTrack of subTracks.values()) {
      if (!subTrack.chunkSet) {
        const stid = subTrack.id;
        console.log('loading sub track...', collectionLocator, videoId, stid);
        const {language, chunkSet} = await loadCollectionSubtitleTrack(collectionLocator, stid);
        // NOTE: It's OK to update state, we are iterating from immutable object
        this.state.set(this.state.get().updateIn(['collections', collectionLocator, 'videos', videoId, 'subtitleTracks', stid], subTrack => subTrack.merge({language, chunkSet})));
        console.log('loaded sub track', collectionLocator, videoId, stid);
      }
    }
  };

  addLocalCollection = async (name, directory) => {
    await this._addCollection(name, 'local:'+directory);
    await this._storageSaveProfile();
  };

  removeCollection = async (locator) => {
    this.state.set(this.state.get().deleteIn(['collections', locator]));
    await this._storageSaveProfile();
  };

  setPreference = async (pref, value) => {
    // TODO: validate pref, value?
    this.state.set(this.state.get().setIn(['preferences', pref], value));
    await this._storageSaveProfile();
  };

  sortSubtitleTracksMap = (subTracksMap) => {
    const prefOrder = this.state.get().preferences.subtitleOrder.toArray();

    const arr = subTracksMap.valueSeq().toArray();
    arr.sort((a, b) => {
      const aIdx = prefOrder.includes(a.language) ? prefOrder.indexOf(a.language) : Infinity;
      const bIdx = prefOrder.includes(b.language) ? prefOrder.indexOf(b.language) : Infinity;

      if (aIdx < bIdx) {
        return -1;
      } else if (aIdx > bIdx) {
        return 1;
      } else {
        const al = a.language || '';
        const bl = b.language || '';
        const ac = al.localeCompare(bl);
        if (ac !== 0) {
          return ac;
        } else {
          return a.id.localeCompare(b.id);
        }
      }
    });
    return arr;
  };
};
