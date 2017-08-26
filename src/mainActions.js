import assert from 'assert';
import { Record, OrderedMap, List } from 'immutable';

import genUID from './util/uid';
import { parseSRT } from './util/subtitles';
import { createAutoAnnotatedText } from './util/analysis';
import { createTimeRangeChunk, createTimeRangeChunkSet, setChunkAnnoText, getChunkJS, chunkSetToShallowJS, iterableChunkIds, chunkSetToJS, chunkSetFromJS } from './util/chunk';
import { startsWith } from './util/string';
import createStorageBackend from './storage';
import { detectWithinSupported } from './util/languages';

const jstr = JSON.stringify; // alias
const jpar = JSON.parse; // alias

const MainStateRecord = new Record({
  loading: false,
  sources: new OrderedMap(), // id -> SourceRecord
  highlightSets: new OrderedMap(), // id -> HighlightSetRecord
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
  role: undefined,
  chunkSet: undefined,
});

const HighlightSetRecord = new Record({
  id: undefined,
  name: undefined,
});

const ENABLE_NEW_SAVE = false;

export default class MainActions {
  constructor(subscribableState) {
    this.state = subscribableState;
    this.state.set(new MainStateRecord());
    this.storage = createStorageBackend('voracious:');

    // Start loading from storage, which is async
    this._loadFromStorageKey('active');
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
              role: t.role,
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
      } else {
        // Key wasn't present, so we can initialize state to default

        const initSetId = genUID();
        newState = newState.setIn(['highlightSets', initSetId], new HighlightSetRecord({
          id: initSetId,
          name: 'My Highlights',
        }));

        // Save our empty/default state
        this._saveToStorage();
        this._storageFullSave();
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
          role: text.role,
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

  _saveToStorage = () => {
    console.time('save');

    // NOTE: We don't do anything with the Promise return value,
    //  saving is "fire and forget"
    // TODO: we should check if this fails
    this.storage.setItem('active', jstr(this._saveToJSONable()));

    console.timeEnd('save');
  };

  // This is usually not needed, as we save piecemeal
  _storageFullSave = () => {
    if (!ENABLE_NEW_SAVE) return;

    this._storageRootSave();

    for (const source of this.state.get().sources.values()) {
      this._storageSourcePositionSave(source.id, source.viewPosition);

      for (let textNum = 0; textNum < source.texts.size; textNum++) {
        this._storageSourceTextSaveAllChunks(source.id, textNum);
      }
    }
  };

  _storageRootSave = () => {
    if (!ENABLE_NEW_SAVE) return;

    const rootObj = {
      sources: [],
      highlightSets: [],
    };

    for (const source of this.state.get().sources.values()) {
      const sourceObj = {
        id: source.id,
        kind: source.kind,
        name: source.name,
        media: [],
        texts: [],
        // NOTE: don't include viewPosition, saved separately
        timeCreated: source.timeCreated,
      };
      for (const media of source.media) {
        sourceObj.media.push({
          language: media.language,
          videoURL: media.videoURL,
        });
      }
      for (const text of source.texts) {
        sourceObj.texts.push({
          language: text.language,
          role: text.role,
          chunkSet: chunkSetToShallowJS(text.chunkSet),
        });
      }
      rootObj.sources.push(sourceObj);
    }

    for (const set of this.state.get().highlightSets.values()) {
      rootObj.highlightSets.push({
        id: set.id,
        name: set.name,
      });
    }

    this.storage.setItem('root', jstr(rootObj));
  };

  _storageSourcePositionSave = (sourceId, position) => {
    if (!ENABLE_NEW_SAVE) return;

    this.storage.setItem('source_position/' + sourceId, jstr(position));
  };

  _storageSourcePositionDelete = (sourceId) => {
    if (!ENABLE_NEW_SAVE) return;

    this.storage.removeItem('source_position/' + sourceId);
  };

  _storageChunkSave = (chunkId, chunkJS) => {
    if (!ENABLE_NEW_SAVE) return;

    this.storage.setItem('chunk/' + chunkId, jstr(chunkJS));
  };

  _storageChunkDelete = (chunkId) => {
    if (!ENABLE_NEW_SAVE) return;

    this.storage.removeItem('chunk/' + chunkId);
  };

  _storageSourceTextSaveAllChunks = (sourceId, textNum) => {
    if (!ENABLE_NEW_SAVE) return;

    const chunkSet = this.state.get().getIn(['sources', sourceId, 'texts', textNum, 'chunkSet']);

    for (const cid of iterableChunkIds(chunkSet)) {
      const chunkJS = getChunkJS(chunkSet, cid);
      this._storageChunkSave(cid, chunkJS);
    }
  };

  _storageSourceTextDeleteAllChunks = (sourceId, textNum) => {
    if (!ENABLE_NEW_SAVE) return;

    const chunkSet = this.state.get().getIn(['sources', sourceId, 'texts', textNum, 'chunkSet']);

    for (const cid of iterableChunkIds(chunkSet)) {
      this._storageChunkDelete(cid);
    }
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
    this._storageRootSave();

    return sourceId;
  };

  deleteSource = (sourceId) => {
    // For each text of this source, delete all chunks
    const textsCount = this.state.get().getIn(['sources', sourceId, 'texts']).size;
    for (let textNum = 0; textNum < textsCount; textNum++) {
      this._storageSourceTextDeleteAllChunks(sourceId, textNum);
    }

    this.state.set(this.state.get().deleteIn(['sources', sourceId]));

    this._saveToStorage();

    this._storageRootSave();
    this._storageSourcePositionDelete(sourceId);
  };

  sourceSetName = (sourceId, name) => {
    this.state.set(this.state.get().setIn(['sources', sourceId, 'name'], name));

    this._saveToStorage();
    this._storageRootSave();
  };

  sourceSetVideoURL = (sourceId, url) => {
    this.state.set(this.state.get().setIn(['sources', sourceId, 'media'], new List([new VideoMediaRecord({
      language: null, // don't set this field for now
      videoURL: url,
    })])));

    this._saveToStorage();
    this._storageRootSave();
  };

  sourceClearVideoURL = (sourceId) => {
    // TODO: verify that source type is video

    this.state.set(this.state.get().setIn(['sources', sourceId, 'media'], new List()));

    this._saveToStorage();
    this._storageRootSave();
  };

  sourceDeleteMedia = (sourceId, mediaNum) => {
    this.state.set(this.state.get().updateIn(['sources', sourceId, 'media'], media => media.delete(mediaNum)));

    this._saveToStorage();
    this._storageRootSave();
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

      // Determine default role
      const role = (this.state.get().sources.get(sourceId).texts.size > 0) ? 'translation' : 'transcription';

      const chunks = [];
      for (const sub of subs) {
        const annoText = createAutoAnnotatedText(sub.lines, language);
        chunks.push(createTimeRangeChunk(sub.begin, sub.end, annoText));
      }
      const chunkSet = createTimeRangeChunkSet(chunks);

      this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts'], texts => texts.push(new SourceTextRecord({
        language,
        role,
        chunkSet,
      }))));

      this._saveToStorage();
      this._storageSourceTextSaveAllChunks(sourceId, this.state.get().getIn(['sources', sourceId, 'texts']).size-1);
      this._storageRootSave();
    };
    reader.readAsText(file);
  };

  sourceSetTextRole = (sourceId, textNum, role) => {
    // TODO: verify that role is valid string, and valid given textNum
    this.state.set(this.state.get().setIn(['sources', sourceId, 'texts', textNum, 'role'], role));
    this._saveToStorage();
    this._storageRootSave();
  };

  sourceMoveUpText = (sourceId, textNum) => {
    // TODO: verify that textNum is valid
     this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts'], texts => {
      const moved = texts.get(textNum);
      return texts
        .delete(textNum)
        .insert(textNum-1, moved)
        // Ensure that moved-down text is a translation
        .setIn([textNum, 'role'], 'translation');
     }));

    this._saveToStorage();
    this._storageRootSave();
  };

  sourceDeleteText = (sourceId, textNum) => {
    this._storageSourceTextDeleteAllChunks(sourceId, textNum);

    this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts'], texts => texts.delete(textNum)));

    this._saveToStorage();
    this._storageRootSave();
  };

  setSourceViewPosition = (sourceId, position) => {
    this.state.set(this.state.get().setIn(['sources', sourceId, 'viewPosition'], position));

    this._storageSourcePositionSave(sourceId, position);
  };

  sourceSetChunkAnnoText = (sourceId, textNum, chunkId, newAnnoText) => {
    this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts', textNum, 'chunkSet'], chunkSet => setChunkAnnoText(chunkSet, chunkId, newAnnoText)));

    this._saveToStorage();

    const updatedChunkSet = this.state.get().getIn(['sources', sourceId, 'texts', textNum, 'chunkSet']);
    const chunkJS = getChunkJS(updatedChunkSet, chunkId);
    this._storageChunkSave(chunkId, chunkJS);
  };

  createHighlightSet = (name) => {
    const setId = genUID();

    assert(name === name.trim());
    assert(name.length > 0);

    this.state.set(this.state.get().setIn(['highlightSets', setId], new HighlightSetRecord({
      id: setId,
      name: name,
    })));

    this._saveToStorage();
    this._storageRootSave();
  };

  deleteHighlightSet = (setId) => {
    // TODO: If we want to disallow deleting non-empty sets,
    //  we should enforce that here. Not sure how to do that
    //  if the selectors are held elsewhere.
    let state = this.state.get();

    state = state.deleteIn(['highlightSets', setId]);

    this.state.set(state);

    this._saveToStorage();
    this._storageRootSave();
  };

  highlightSetRename = (setId, name) => {
    this.state.set(this.state.get().setIn(['highlightSets', setId, 'name'], name));

    this._saveToStorage();
    this._storageRootSave();
  };
};
