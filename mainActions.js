import assert from 'assert';
import { Record, Map, OrderedMap, List } from 'immutable';

import genUID from './util/uid';
import { startsWith, removePrefix } from './util/string';
import { parseSRT } from './util/subtitles';
import { toJS as annoTextToJS, fromJS as annoTextFromJS } from './util/annotext';
import { createAutoAnnotatedText } from './util/analysis';
import { createTimeRangeChunk, createTimeRangeChunkSet, setChunkAnnoText } from './util/chunk';
import createStorageBackend from './storage';

const jstr = JSON.stringify; // alias
const jpar = JSON.parse; // alias

const MainStateRecord = new Record({
  loading: false,
  sources: new OrderedMap(), // id -> SourceRecord
  highlightSets: new OrderedMap(), // id -> HighlightSetRecord
  activeHighlightSetId: undefined, // should be undefined or a valid set id
});

const SourceRecord = new Record({
  id: undefined,
  kind: undefined,
  media: new List(),
  texts: new List(),
  viewPosition: 0,
});

const VideoMediaRecord = new Record({
  language: undefined,
  // videoFile: undefined,
  videoURL: undefined,
});

const SourceTextRecord = new Record({
  language: undefined,
  chunkSet: undefined,
});

const HighlightSetRecord = new Record({
  id: undefined,
  name: undefined,
});

export default class MainActions {
  constructor(subscribableState) {
    this.state = subscribableState;
    this.state.set(new MainStateRecord());
    this.storage = createStorageBackend('voracious:');

    // Start loading from storage, which is async
    this.state.set(this.state.get().set('loading', true));
    this.storage.getItem('version').then(version => {
      if (version) {
        assert(version === '0');
        return Promise.resolve(); // return "empty" promise to be consistent
      } else {
        // Key wasn't present, so we can initialize storage to default data
        return this.storage.setItems([
          ['version', '0'],
          ['root', jstr({profiles: ['1']})], // start with a single profile, id '1'
          ['profile:1', jstr({name: 'default', highlightSets: []})],
        ]);
      }
    }).then(() => {
      // Storage is known to be initialized and at current version, so we can start loading the real data now
      return this.storage.getItem('root');
    }).then(rootStr => {
      const root = jpar(rootStr);
      assert((root.profiles.length === 1) && (root.profiles[0] === '1'));
      return this.storage.getItem('profile:1');
    }).then(profileStr => {
      const profile = jpar(profileStr);
      return this.storage.getItems(profile.highlightSets.map(i => ('highlightSet:'+i)));
    }).then(setStrs => {
      const mutSets = {};
      for (const [k, v] of setStrs) {
        const setId = removePrefix(k, 'highlightSet:');
        const setObj = jpar(v);
        const set = new HighlightSetRecord({
          id: setId,
          name: setObj.name,
        });
        mutSets[setId] = set;
      }
      this.state.set(this.state.get()
        .set('loading', false)
        .set('highlightSets', new OrderedMap(mutSets))
      );

      // Set activeHighlightSetId to just be first set, for now
      const firstHighlightSetId = this.state.get().highlightSets.keySeq().get(0);
      this.state.set(this.state.get().set('activeHighlightSetId', firstHighlightSetId));
    });
  }

  createSource = (kind) => {
    const sourceId = genUID();
    this.state.set(this.state.get().setIn(['sources', sourceId], new SourceRecord({
      id: sourceId,
      kind,
    })));
  };

  sourceAddVideoURL = (sourceId, url, language) => {
    this.state.set(this.state.get().updateIn(['sources', sourceId, 'media'], media => media.push(new VideoMediaRecord({
      language,
      videoURL: url,
    }))));
  };

  sourceAddVideoFile = (sourceId, file, language) => {
    this.sourceAddVideoURL(sourceId, URL.createObjectURL(file), language);
  };

  sourceAddSubsFile = (sourceId, file, language) => {
    // Start async file load and parse
    const reader = new FileReader();
    reader.onload = (e) => {
      // Parse loaded file data
      const subs = parseSRT(e.target.result);

      const chunks = [];
      for (const sub of subs) {
        const annoText = createAutoAnnotatedText(sub.lines, language);
        chunks.push(createTimeRangeChunk(sub.begin, sub.end, annoText));
      }
      const chunkSet = createTimeRangeChunkSet(chunks);

      this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts'], texts => texts.push(new SourceTextRecord({
        language: language,
        chunkSet,
      }))));
      // TODO: previously we revealed all texts when new sub track was added, to reduce confusion
    };
    reader.readAsText(file);
  };

  setSourceViewPosition = (sourceId, position) => {
    this.state.set(this.state.get().setIn(['sources', sourceId, 'viewPosition'], position));
  };

  sourceSetChunkAnnoText = (sourceId, textNum, chunkId, newAnnoText) => {
    this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts', textNum, 'chunkSet'], chunkSet => setChunkAnnoText(chunkSet, chunkId, newAnnoText)));
  };

/*
  _storageUpdateKeyJSON = (key, update) => {
    return this.storage.getItem(key).then(value => {
      const obj = jpar(value);
      const newObj = update(obj); // newObj could be same identity as obj
      return this.storage.setItem(key, jstr(newObj));
    });
  };

  _storageSaveHighlightSet = (setId) => {
    const iSet = this.state.get().highlightSets.get(setId);
    const set = {name: iSet.name};
    return this.storage.setItem('highlightSet:' + setId, jstr(set));
  };
*/

  createHighlightSet = (name) => {
    const setId = genUID();

    assert(name === name.trim());
    assert(name.length > 0);

    this.state.set(this.state.get().setIn(['highlightSets', setId], new HighlightSetRecord({
      id: setId,
      name: name,
    })));

    if (!this.state.get().activeHighlightSetId) {
      this.state.set(this.state.get().set('activeHighlightSetId', setId));
    }

/*
    this._storageSaveHighlightSet(setId).then(() => {
      return this._storageUpdateKeyJSON('profile:1', profile => { profile.highlightSets.push(setId); return profile; });
    });
*/
  };

  deleteHighlightSet = (setId) => {
    this.state.set(this.state.get().deleteIn(['highlightSets', setId]));
    // TODO: update activeHighlightSetId
/*
    this.storage.removeItem('deck:' + deckId).then(() => {
      return this._storageUpdateKeyJSON('profile:1', profile => { profile.decks = profile.decks.filter(i => (i !== deckId)); return profile; });
    });
*/
  };

  setActiveHighlightSetId = (setId) => {
    // TODO: verify setId exists
    this.state.set(this.state.get().set('activeHighlightSetId', setId));
  };
};
