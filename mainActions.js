import assert from 'assert';
import { Record, Map, OrderedMap, List } from 'immutable';

import genUID from './util/uid';
import { startsWith, removePrefix } from './util/string';
import { parseSRT } from './util/subtitles';
import { toJS as annoTextToJS, fromJS as annoTextFromJS } from './util/annotext';
import { createAutoAnnotatedText } from './util/analysis';
import { createTimeRangeChunk, createTimeRangeChunkSet } from './util/chunk';
import createStorageBackend from './storage';

const jstr = JSON.stringify; // alias
const jpar = JSON.parse; // alias

const MainStateRecord = new Record({
  loading: false,
  sources: new OrderedMap(), // id -> SourceRecord
  decks: new OrderedMap(), // id -> DeckRecord
  snipDeckId: undefined, // should be undefined or a valid deck id
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

const DeckRecord = new Record({
  id: undefined,
  name: undefined,
  snips: new OrderedMap(), // id -> SnipRecord
});

const SnipRecord = new Record({
  id: undefined,
  texts: new List(), // List of SnipTextRecord
});

const SnipTextRecord = new Record({
  annoText: undefined,
  language: undefined,
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
          ['profile:1', jstr({name: 'default', decks: []})],
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
      return this.storage.getItems(profile.decks.map(i => ('deck:'+i)));
    }).then(deckStrs => {
      const mutDecks = {};
      for (const [k, v] of deckStrs) {
        const deckId = removePrefix(k, 'deck:');
        const deckObj = jpar(v);
        const deck = new DeckRecord({
          id: deckId,
          name: deckObj.name,
          snips: new OrderedMap(deckObj.snips.map(snip => [snip.id, new SnipRecord({id: snip.id, texts: new List(snip.texts.map(stext => new SnipTextRecord({annoText: annoTextFromJS(stext.annoText), language: stext.language})))})])),
        });
        mutDecks[deckId] = deck;
      }
      this.state.set(this.state.get()
        .set('loading', false)
        .set('decks', new OrderedMap(mutDecks))
      );

      // Set snipDeckId to just be first deck, for now
      const firstDeckId = this.state.get().decks.keySeq().get(0);
      this.state.set(this.state.get().set('snipDeckId', firstDeckId));
    });
  }

  createSource = (kind) => {
    const sourceId = genUID();
    this.state.set(this.state.get().setIn(['sources', sourceId], new SourceRecord({
      id: sourceId,
      kind,
    })));
  };

  sourceAddVideoFile = (sourceId, file, language) => {
    this.state.set(this.state.get().updateIn(['sources', sourceId, 'media'], media => media.push(new VideoMediaRecord({
      language,
      // videoFile: file,
      videoURL: URL.createObjectURL(file),
    }))));
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

  _storageUpdateKeyJSON = (key, update) => {
    return this.storage.getItem(key).then(value => {
      const obj = jpar(value);
      const newObj = update(obj); // newObj could be same identity as obj
      return this.storage.setItem(key, jstr(newObj));
    });
  };

  _storageSaveDeck = (deckId) => {
    const iDeck = this.state.get().decks.get(deckId);
    const deck = {name: iDeck.name, snips: iDeck.snips.valueSeq().map(snip => ({id: snip.id, texts: snip.texts.toArray().map(text => ({annoText: annoTextToJS(text.annoText), language: text.language}))}))};
    return this.storage.setItem('deck:' + deckId, jstr(deck));
  };

  createDeck = (name) => {
    const deckId = genUID();

    assert(name === name.trim());
    assert(name.length > 0);

    this.state.set(this.state.get().setIn(['decks', deckId], new DeckRecord({
      id: deckId,
      name: name,
    })));

    if (!this.state.get().snipDeckId) {
      this.state.set(this.state.get().set('snipDeckId', deckId));
    }

    this._storageSaveDeck(deckId).then(() => {
      return this._storageUpdateKeyJSON('profile:1', profile => { profile.decks.push(deckId); return profile; });
    });
  };

  setSnipDeckId = (deckId) => {
    // TODO: verify deckId exists
    this.state.set(this.state.get().set('snipDeckId', deckId));
  };

  addSnip = (deckId, texts) => {
    const snipId = genUID();
    const snipTexts = new List(texts.map(t => new SnipTextRecord({annoText: t.annoText, language: t.language})));

    this.state.set(this.state.get().updateIn(['decks', deckId, 'snips'], snips => snips.push(new SnipRecord({
      id: snipId,
      texts: snipTexts,
    }))));

    this._storageSaveDeck(deckId);
  };

  deleteSnip = (deckId, snipId) => {
    this.state.set(this.state.get().updateIn(['decks', deckId, 'snips'], snips => snips.delete(snipId)));

    this._storageSaveDeck(deckId);
  };
};
