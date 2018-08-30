import { List, Record, Map as IMap, Set as ISet } from 'immutable';

import createStorageBackend from './storage';
import { getCollectionIndex, loadCollectionSubtitleTrack } from './library';
import { loadDictionaries, searchIndex } from './dictionary';

const fs = window.require('fs-extra'); // use window to avoid webpack
const { process } = window.require('electron').remote;

const jstr = JSON.stringify; // alias
const jpar = JSON.parse; // alias

const AnkiPreferencesRecord = new Record({
  modelName: undefined,
  deckName: undefined,
  fieldMap: new IMap(), // Anki field to our field that fills it
});

const PreferencesRecord = new Record({
  showRuby: true,
  showHelp: true,
  subtitleMode: 'manual',
  subtitleOrder: new List(['jpn', 'eng']), // list of iso639-3 codes
  disabledDictionaries: new ISet(),
  dictionaryOrder: new List(),
  anki: new AnkiPreferencesRecord(),
});

const MainStateRecord = new Record({
  modalLoadingMessage: null,
  collections: new IMap(), // locator -> CollectionRecord
  dictionaries: new IMap(), // name -> object that we don't mutate (TODO: make it a Record)
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
  loadingSubs: false,
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

    if (!process.argv.includes('--nodicts')) {
      this._setLoadingMessage('Loading dictionaries...');

      await this._loadDictionaries(progressMsg => {
        this._setLoadingMessage(progressMsg);
      });
    }

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
      this.state.set(this.state.get().setIn(['preferences', 'disabledDictionaries'], new ISet(profile.preferences.disabledDictionaries)));
      this.state.set(this.state.get().setIn(['preferences', 'dictionaryOrder'], new List(profile.preferences.dictionaryOrder)));

      if (!profile.preferences.anki) {
        profile.preferences.anki = {};
      }
      const ankiPrefRecord = new AnkiPreferencesRecord({
        deckName: profile.preferences.anki.deckName,
        modelName: profile.preferences.anki.modelName,
        fieldMap: new IMap(profile.preferences.anki.fieldMap),
      });
      this.state.set(this.state.get().setIn(['preferences', 'anki'], ankiPrefRecord));
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
        disabledDictionaries: state.preferences.disabledDictionaries.toArray(),
        dictionaryOrder: state.preferences.dictionaryOrder.toArray(),
        anki: state.preferences.anki.toJS(),
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
    if (this.state.get().getIn(['collections', collectionLocator, 'videos', videoId, 'loadingSubs'])) {
      return;
    }

    this.state.set(this.state.get().setIn(['collections', collectionLocator, 'videos', videoId, 'loadingSubs'], true));

    const subTracks = this.state.get().getIn(['collections', collectionLocator, 'videos', videoId, 'subtitleTracks']);

    for (const subTrack of subTracks.values()) {
      if (!subTrack.chunkSet && !subTrack.loading) {
        const stid = subTrack.id;
        console.log('loading sub track...', collectionLocator, videoId, stid);
        const {language, chunkSet} = await loadCollectionSubtitleTrack(collectionLocator, stid);
        // NOTE: It's OK to update state, we are iterating from immutable object
        this.state.set(this.state.get().updateIn(['collections', collectionLocator, 'videos', videoId, 'subtitleTracks', stid], subTrack => subTrack.merge({
          language,
          chunkSet,
        })));
        console.log('loaded sub track', collectionLocator, videoId, stid);
      }
    }

    this.state.set(this.state.get().setIn(['collections', collectionLocator, 'videos', videoId, 'loadingSubs'], false));
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

  setPreferenceSubtitleOrder = async (orderArr) => {
    this.state.set(this.state.get().setIn(['preferences', 'subtitleOrder'], new List(orderArr)));
    await this._storageSaveProfile();
  };

  setPreferenceDisableDictionary = async (dictName) => {
    this.state.set(this.state.get().updateIn(['preferences', 'disabledDictionaries'], set => set.add(dictName)));
    await this._storageSaveProfile();
  };

  setPreferenceEnableDictionary = async (dictName) => {
    this.state.set(this.state.get().updateIn(['preferences', 'disabledDictionaries'], set => set.remove(dictName)));
    await this._storageSaveProfile();
  };

  setPreferenceDictionaryOrder = async (names) => {
    this.state.set(this.state.get().setIn(['preferences', 'dictionaryOrder'], new List(names)));
    this._updateDictionaryOrderByPreference();
    await this._storageSaveProfile();
  };

  setPreferenceAnki = async (prefs) => {
    this.state.set(this.state.get().setIn(['preferences', 'anki'], new AnkiPreferencesRecord({
      deckName: prefs.deckName,
      modelName: prefs.modelName,
      fieldMap: new IMap(prefs.fieldMap),
    })));
    await this._storageSaveProfile();
  };

  _loadDictionaries = async (reportProgress) => {
    const dictionaries = await loadDictionaries(reportProgress);

    const items = [];
    for (const info of dictionaries) {
      items.push([info.name, info]);
    }

    this.state.set(this.state.get().set('dictionaries', new IMap(items)));

    this._updateDictionaryOrderByPreference();
  };

  _updateDictionaryOrderByPreference = () => {
    const state = this.state.get();

    const items = [];
    for (const name of state.preferences.dictionaryOrder) {
      if (state.dictionaries.has(name)) {
        items.push([name, state.dictionaries.get(name)]);
      }
    }

    for (const [name, info] of state.dictionaries.entries()) {
      if (!state.preferences.dictionaryOrder.has(name)) {
        items.push([name, info]);
      }
    }

    this.state.set(state.set('dictionaries', new IMap(items)));
  };

  searchDictionaries = (word) => {
    const state = this.state.get();

    const results = [];

    for (const [name, info] of state.dictionaries) {
      if (!state.preferences.disabledDictionaries.has(name)) {
        for (const text of searchIndex(info.index, word)) {
          results.push({
            dictionaryName: name,
            text,
          });
        }
      }
    }

    return results;
  };

  reloadDictionaries = async (reportProgress) => {
    await this._loadDictionaries(reportProgress);
  };

  deleteDictionary = async (name) => {
    const dict = this.state.get().dictionaries.get(name);

    if (dict.builtin) {
      throw new Error('Not allowed to delete built-in dictionary');
    }

    await fs.unlink(dict.filename);

    this.state.set(this.state.get().deleteIn(['dictionaries', name]));
  };
};
