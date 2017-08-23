import assert from 'assert';
import { Record, OrderedMap, List } from 'immutable';

import genUID from './util/uid';
import { parseSRT } from './util/subtitles';
import { createAutoAnnotatedText } from './util/analysis';
import { createTimeRangeChunk, createTimeRangeChunkSet, setChunkAnnoText, chunkSetToJS, chunkSetFromJS } from './util/chunk';
import { startsWith } from './util/string';
import createStorageBackend from './storage';
import { detectWithinSupported } from './util/languages';

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
  name: undefined,
  media: new List(),
  texts: new List(),
  viewPosition: 0,
  timeCreated: undefined,
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

const STORAGE_ACTIVE_KEY = 'active';

export default class MainActions {
  constructor(subscribableState) {
    this.state = subscribableState;
    this.state.set(new MainStateRecord());
    this.storage = createStorageBackend('voracious:');

    // Start loading from storage, which is async
    this._loadFromStorageKey(STORAGE_ACTIVE_KEY);
  }

  // NOTE: This takes a key argument so that we could load from a backup
  _loadFromStorageKey = (key) => {
    this.state.set(this.state.get().set('loading', true));
    this.storage.getItem(key).then(storedStateStr => {
      let newState = this.state.get();

      if (storedStateStr) {
        // Parse and load stored state JSON
        const storedState = jpar(storedStateStr);

        assert(storedState.version === 1);

        // Load in storedState
        for (const source of storedState.sources) {
          const media = [];
          for (const m of source.media) {
            media.push(new VideoMediaRecord({
              language: m.language,
              videoURL: m.videoURL,
            }));
          }

          const texts = [];
          for (const t of source.texts) {
            texts.push(new SourceTextRecord({
              language: t.language,
              chunkSet: chunkSetFromJS(t.chunkSet),
            }));
          }

          newState = newState.setIn(['sources', source.id], new SourceRecord({
            id: source.id,
            kind: source.kind,
            name: source.name,
            media: new List(media),
            texts: new List(texts),
            viewPosition: source.viewPosition,
            timeCreated: source.timeCreated,
          }));
        }

        for (const set of storedState.highlightSets) {
          newState = newState.setIn(['highlightSets', set.id], new HighlightSetRecord({
            id: set.id,
            name: set.name,
          }));
        }

        newState = newState.set('activeHighlightSetId', storedState.activeHighlightSetId);
      } else {
        // Key wasn't present, so we can initialize state to default

        // Save our empty/default state
        this._saveToStorage();
      }

      newState = newState.set('loading', false);

      // "Commit" new state
      this.state.set(newState);
    });
  };

  _saveToJSONable = () => {
    const saveState = {
      version: 1,
      sources: [],
      highlightSets: [],
      activeHighlightSetId: this.state.get().activeHighlightSetId,
    };

    for (const source of this.state.get().sources.values()) {
      const saveSource = {
        id: source.id,
        kind: source.kind,
        name: source.name,
        media: [],
        texts: [],
        viewPosition: source.viewPosition,
        timeCreated: source.timeCreated,
      };
      for (const media of source.media) {
        // NOTE: We only save media if the video URL is not an object URL
        if (media.videoURL && !startsWith(media.videoURL, 'blob:')) {
          saveSource.media.push({
            language: media.language,
            videoURL: media.videoURL,
          });
        }
      }
      for (const text of source.texts) {
        saveSource.texts.push({
          language: text.language,
          chunkSet: chunkSetToJS(text.chunkSet),
        });
      }
      saveState.sources.push(saveSource);
    }

    for (const set of this.state.get().highlightSets.values()) {
      saveState.highlightSets.push({
        id: set.id,
        name: set.name,
      });
    }

    return saveState;
  }

  _saveToStorageKey = (key) => {
    // NOTE: We don't do anything with the Promise return value,
    //  saving is "fire and forget"
    // TODO: we should check if this fails
    this.storage.setItem(STORAGE_ACTIVE_KEY, jstr(this._saveToJSONable()));
  };

  _saveToStorage = () => {
    this._saveToStorageKey(STORAGE_ACTIVE_KEY);
  };

  _saveBackup = () => {
    const backupKey = 'backup:' + (new Date()).toISOString().replace(/[-:.ZT]/g, ''); // TODO: append :uid?
    this._saveToStorageKey(backupKey);
  };

  createVideoSource = () => {
    const sourceId = genUID();
    this.state.set(this.state.get().setIn(['sources', sourceId], new SourceRecord({
      id: sourceId,
      kind: 'video',
      name: 'untitled video',
      timeCreated: Date.now(),
    })));
    this._saveToStorage();
    return sourceId;
  };

  deleteSource = (sourceId) => {
    this.state.set(this.state.get().deleteIn(['sources', sourceId]));
    this._saveToStorage();
  };

  sourceSetName = (sourceId, name) => {
    this.state.set(this.state.get().setIn(['sources', sourceId, 'name'], name));
    this._saveToStorage();
  };

  sourceSetVideoURL = (sourceId, url) => {
    this.state.set(this.state.get().setIn(['sources', sourceId, 'media'], new List([new VideoMediaRecord({
      language: null, // don't set this field for now
      videoURL: url,
    })])));
    this._saveToStorage();
  };

  sourceClearVideoURL = (sourceId) => {
    // TODO: verify that source type is video

    this.state.set(this.state.get().setIn(['sources', sourceId, 'media'], new List()));
    this._saveToStorage();
  };

  sourceDeleteMedia = (sourceId, mediaNum) => {
    this.state.set(this.state.get().updateIn(['sources', sourceId, 'media'], media => media.delete(mediaNum)));
    this._saveToStorage();
  };

  sourceImportSubsFile = (sourceId, file) => {
    // Start async file load and parse
    const reader = new FileReader();
    reader.onload = (e) => {
      // Parse loaded file data
      const subs = parseSRT(e.target.result);

      // Autodetect language
      const combinedText = subs.map(s => s.lines).join();
      const language = detectWithinSupported(combinedText);

      const chunks = [];
      for (const sub of subs) {
        const annoText = createAutoAnnotatedText(sub.lines, language);
        chunks.push(createTimeRangeChunk(sub.begin, sub.end, annoText));
      }
      const chunkSet = createTimeRangeChunkSet(chunks);

      this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts'], texts => texts.push(new SourceTextRecord({
        language,
        chunkSet,
      }))));
      // TODO: previously we revealed all texts when new sub track was added, to reduce confusion
      this._saveToStorage();
    };
    reader.readAsText(file);
  };

  sourceDeleteText = (sourceId, textNum) => {
    this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts'], texts => texts.delete(textNum)));
    this._saveToStorage();
  };

  setSourceViewPosition = (sourceId, position) => {
    this.state.set(this.state.get().setIn(['sources', sourceId, 'viewPosition'], position));
    // NOTE: We don't yet save here, because it would be too frequent
  };

  sourceSetChunkAnnoText = (sourceId, textNum, chunkId, newAnnoText) => {
    this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts', textNum, 'chunkSet'], chunkSet => setChunkAnnoText(chunkSet, chunkId, newAnnoText)));
    this._saveToStorage();
  };

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
    this._saveToStorage();
  };

  deleteHighlightSet = (setId) => {
    // TODO: If we want to disallow deleting non-empty sets,
    //  we should enforce that here. Not sure how to do that
    //  if the selectors are held elsewhere.
    let state = this.state.get();

    state = state.deleteIn(['highlightSets', setId]);

    // Ensure activeHighlightSetId is valid
    if (!state.highlightSets.has(state.activeHighlightSetId)) {
      state = state.set('activeHighlightSetId', state.highlightSets.isEmpty() ? null : state.highlightSets.first().id);
    }

    this.state.set(state);

    this._saveToStorage();
  };

  highlightSetRename = (setId, name) => {
    this.state.set(this.state.get().setIn(['highlightSets', setId, 'name'], name));
    this._saveToStorage();
  };

  setActiveHighlightSetId = (setId) => {
    // Ensure that setId is valid
    const sets = this.state.get().highlightSets;
    if (sets.isEmpty()) {
      assert(setId === null);
    } else {
      assert(sets.some(s => (s.id === setId)));
    }

    this.state.set(this.state.get().set('activeHighlightSetId', setId));
    this._saveToStorage();
  };
};
