import assert from 'assert';
import { Record, OrderedMap, List } from 'immutable';

import genUID from './util/uid';
import { parseSRT } from './util/subtitles';
import { createAutoAnnotatedText } from './util/analysis';
import { createTimeRangeChunk, createTimeRangeChunkSet, setChunkAnnoText, chunkSetToJS, chunkSetFromJS } from './util/chunk';
import { startsWith } from './util/string';
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
            media: new List(media),
            texts: new List(texts),
            viewPosition: source.viewPosition,
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

  _saveToStorageKey = (key) => {
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
        media: [],
        texts: [],
        viewPosition: source.viewPosition,
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

    // NOTE: We don't do anything with the Promise return value,
    //  saving is "fire and forget"
    // TODO: we should check if this fails
    this.storage.setItem(STORAGE_ACTIVE_KEY, jstr(saveState));
  };

  _saveToStorage = () => {
    this._saveToStorageKey(STORAGE_ACTIVE_KEY);
  };

  _saveBackup = () => {
    const backupKey = 'backup:' + (new Date()).toISOString().replace(/[-:.ZT]/g, ''); // TODO: append :uid?
    this._saveToStorageKey(backupKey);
  };

  createSource = (kind) => {
    const sourceId = genUID();
    this.state.set(this.state.get().setIn(['sources', sourceId], new SourceRecord({
      id: sourceId,
      kind,
    })));
    this._saveToStorage();
  };

  sourceAddVideoURL = (sourceId, url, language) => {
    this.state.set(this.state.get().updateIn(['sources', sourceId, 'media'], media => media.push(new VideoMediaRecord({
      language,
      videoURL: url,
    }))));
    this._saveToStorage();
  };

  sourceAddVideoFile = (sourceId, file, language) => {
    this.sourceAddVideoURL(sourceId, URL.createObjectURL(file), language);
    this._saveToStorage();
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
      this._saveToStorage();
    };
    reader.readAsText(file);
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
    this.state.set(this.state.get().deleteIn(['highlightSets', setId]));
    // TODO: update activeHighlightSetId
    this._saveToStorage();
  };

  setActiveHighlightSetId = (setId) => {
    // TODO: verify setId exists
    this.state.set(this.state.get().set('activeHighlightSetId', setId));
    this._saveToStorage();
  };
};
