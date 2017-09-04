import assert from 'assert';
import { Record, OrderedMap, List } from 'immutable';

import genUID from './util/uid';
import { parseSRT } from './util/subtitles';
import { createAutoAnnotatedText } from './util/analysis';
import { createTimeRangeChunk, createTimeRangeChunkSet, setChunkAnnoText, chunkToJSNoID, chunkFromIdJS, getChunkById, chunkSetChunkIdsArray, chunkSetIterableChunkIds, chunkSetIterableChunks, getChunksInRange } from './util/chunk';
import { getKind } from './util/annotext';
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
  chunkSetId: undefined,
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

    this.state.set(this.state.get().set('loading', true));

    this.storage = createStorageBackend().then((backend) => {
      this.storage = backend;
      console.time('load');
      this._storageLoad().then(() => {
        console.timeEnd('load');
      });
    });
  }

  _generateDefaultState = () => {
    let newState = new MainStateRecord();

    const initSetId = genUID();
    newState = newState.setIn(['highlightSets', initSetId], new HighlightSetRecord({
      id: initSetId,
      name: 'My Highlights',
    }));

    return newState;
  };

  _storageLoad = async () => {
    const rootStr = await this.storage.getItemMaybe('root');

    if (rootStr) {
      let newState = new MainStateRecord();

      const root = jpar(rootStr);

      // Load sources
      for (const source of root.sources) {
        const media = [];
        for (const m of source.media) {
          media.push(new VideoMediaRecord({
            language: m.language,
            videoURL: m.videoURL,
          }));
        }

        const texts = [];
        for (const t of source.texts) {
          const chunkIds = jpar(await this.storage.getItem('chunk_set/' + t.chunkSetId));
          const chunks = [];
          const chunkStrs = await this.storage.getItems(chunkIds.map(cid => 'chunk/' + cid));
          if (chunkIds.length !== chunkStrs.length) {
            throw new Error('not all chunks found');
          }
          for (let i = 0; i < chunkIds.length; i++) {
            chunks.push(chunkFromIdJS(chunkIds[i], jpar(chunkStrs[i])));
          }

          texts.push(new SourceTextRecord({
            language: t.language,
            role: t.role,
            chunkSetId: t.chunkSetId,
            chunkSet: createTimeRangeChunkSet(chunks),
          }));
        }

        const viewPositionStr = await this.storage.getItemMaybe('source_position/' + source.id);
        const viewPosition = viewPositionStr ? jpar(viewPositionStr) : 0;

        newState = newState.setIn(['sources', source.id], new SourceRecord({
          id: source.id,
          kind: source.kind,
          name: source.name,
          media: new List(media),
          texts: new List(texts),
          viewPosition,
          timeCreated: source.timeCreated,
        }));
      }

      // Load highlight sets
      for (const set of root.highlightSets) {
        newState = newState.setIn(['highlightSets', set.id], new HighlightSetRecord({
          id: set.id,
          name: set.name,
        }));
      }

      // "Commit" new state object we've constructed
      this.state.set(newState);
    } else {
      // Key wasn't present, so initialize to default state
      this.state.set(this._generateDefaultState());

      // Save our empty/default state
      this._storageFullSave();
    }
  };

  // This is usually not needed, as we save piecemeal
  _storageFullSave = () => {
    this._storageRootSave();

    for (const source of this.state.get().sources.values()) {
      this._storageSourcePositionSave(source.id, source.viewPosition);

      for (const text of source.texts) {
        this._storageSaveChunkSet(text.chunkSetId, text.chunkSet);
        this._storageSaveAllChunksInSet(text.chunkSet);
      }
    }
  };

  _storageRootSave = () => {
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
          chunkSetId: text.chunkSetId,
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
    this.storage.setItem('source_position/' + sourceId, jstr(position));
  };

  _storageSourcePositionDelete = (sourceId) => {
    this.storage.removeItem('source_position/' + sourceId);
  };

  _storageSaveChunkSet = (chunkSetId, chunkSet) => {
    this.storage.setItem('chunk_set/' + chunkSetId, jstr(chunkSetChunkIdsArray(chunkSet)));
  };

  _storageDeleteChunkSet = (chunkSetId) => {
    this.storage.removeItem('chunk_set/' + chunkSetId);
  };

  _storageChunkSave = (chunkId, chunkJS) => {
    this.storage.setItem('chunk/' + chunkId, jstr(chunkJS));
  };

  _storageChunkDelete = (chunkId) => {
    this.storage.removeItem('chunk/' + chunkId);
  };

  _storageSaveAllChunksInSet = (chunkSet) => {
    for (const chunk of chunkSetIterableChunks(chunkSet)) {
      const chunkJS = chunkToJSNoID(chunk);
      this._storageChunkSave(chunk.uid, chunkJS);
    }
  };

  _storageDeleteAllChunksInSet = (chunkSet) => {
    for (const cid of chunkSetIterableChunkIds(chunkSet)) {
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

    this._storageRootSave();

    return sourceId;
  };

  deleteSource = (sourceId) => {
    // For each text of this source, delete chunkSet and all chunks
    for (const text of this.state.get().getIn(['sources', sourceId, 'texts'])) {
      this._storageDeleteChunkSet(text.chunkSetId);
      this._storageDeleteAllChunksInSet(text.chunkSet);
    }

    this.state.set(this.state.get().deleteIn(['sources', sourceId]));


    this._storageRootSave();
    this._storageSourcePositionDelete(sourceId);
  };

  sourceSetName = (sourceId, name) => {
    this.state.set(this.state.get().setIn(['sources', sourceId, 'name'], name));

    this._storageRootSave();
  };

  sourceSetVideoURL = (sourceId, url) => {
    this.state.set(this.state.get().setIn(['sources', sourceId, 'media'], new List([new VideoMediaRecord({
      language: null, // don't set this field for now
      videoURL: url,
    })])));

    this._storageRootSave();
  };

  sourceClearVideoURL = (sourceId) => {
    // TODO: verify that source type is video

    this.state.set(this.state.get().setIn(['sources', sourceId, 'media'], new List()));

    this._storageRootSave();
  };

  sourceDeleteMedia = (sourceId, mediaNum) => {
    this.state.set(this.state.get().updateIn(['sources', sourceId, 'media'], media => media.delete(mediaNum)));

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

      const chunkSetId = genUID();
      const chunkSet = createTimeRangeChunkSet(chunks);

      this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts'], texts => texts.push(new SourceTextRecord({
        language,
        role,
        chunkSetId,
        chunkSet,
      }))));

      this._storageSaveChunkSet(chunkSetId, chunkSet);
      this._storageSaveAllChunksInSet(chunkSet);
      this._storageRootSave();
    };
    reader.readAsText(file);
  };

  sourceSetTextRole = (sourceId, textNum, role) => {
    // TODO: verify that role is valid string, and valid given textNum
    this.state.set(this.state.get().setIn(['sources', sourceId, 'texts', textNum, 'role'], role));
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

    this._storageRootSave();
  };

  sourceDeleteText = (sourceId, textNum) => {
    const text = this.state.get().getIn(['sources', sourceId, 'texts', textNum]);
    this._storageDeleteChunkSet(text.chunkSetId);
    this._storageDeleteAllChunksInSet(text.chunkSet);

    this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts'], texts => texts.delete(textNum)));

    this._storageRootSave();
  };

  setSourceViewPosition = (sourceId, position) => {
    this.state.set(this.state.get().setIn(['sources', sourceId, 'viewPosition'], position));

    this._storageSourcePositionSave(sourceId, position);
  };

  sourceSetChunkAnnoText = (sourceId, textNum, chunkId, newAnnoText) => {
    this.state.set(this.state.get().updateIn(['sources', sourceId, 'texts', textNum, 'chunkSet'], chunkSet => setChunkAnnoText(chunkSet, chunkId, newAnnoText)));


    const updatedChunkSet = this.state.get().getIn(['sources', sourceId, 'texts', textNum, 'chunkSet']);
    const updatedChunk = getChunkById(updatedChunkSet, chunkId);
    const chunkJS = chunkToJSNoID(updatedChunk);
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

    this._storageRootSave();
  };

  deleteHighlightSet = (setId) => {
    // TODO: If we want to disallow deleting non-empty sets,
    //  we should enforce that here. Not sure how to do that
    //  if the selectors are held elsewhere.
    let state = this.state.get();

    state = state.deleteIn(['highlightSets', setId]);

    this.state.set(state);

    this._storageRootSave();
  };

  highlightSetRename = (setId, name) => {
    this.state.set(this.state.get().setIn(['highlightSets', setId, 'name'], name));

    this._storageRootSave();
  };

  _getSourceHighlightSetContexts = (source, highlightSetId) => {
    const contexts = [];

    for (const text of source.texts) {
      for (const chunk of chunkSetIterableChunks(text.chunkSet)) {
        const hls = getKind(chunk.annoText, 'highlight');
        if (hls.some(a => (a.data.setId === highlightSetId))) {
          // There are some highlights matching the given set id

          // Pull related chunks+texts from other text tracks (translations, generally)
          const secondaryAnnoTexts = []; // list of {language, annoTexts: [annoText...]}
          for (const otherText of source.texts) {
            if (otherText === text) {
              continue;
            }
            const otherChunks = getChunksInRange(otherText.chunkSet, chunk.position.begin, chunk.position.end);
            // TODO: sort otherChunks by time, if not already
            const otherChunkTexts = [];
            for (const otherChunk of otherChunks) {
              otherChunkTexts.push(otherChunk.annoText);
            }
            if (otherChunkTexts.length > 0) {
              secondaryAnnoTexts.push({language: otherText.language, annoTexts: otherChunkTexts});
            }
          }

          const latestHighlightTimestamp = Math.max(...getKind(chunk.annoText, 'highlight').map(a => a.data.timeCreated));

          contexts.push({
            primaryAnnoText: chunk.annoText, // this one has highlights
            primaryLanguage: text.language,
            secondaryAnnoTexts: secondaryAnnoTexts, // list of {language, annoTexts: [annoText...]}
            chunkUID: chunk.uid, // added this for export to Anki
            latestHighlightTimestamp,
          });
        }
      }
    }

    return contexts;
  };

  _getHighlightSetContexts = (sources, highlightSetId) => {
    const contexts = [].concat(...sources.toArray().map(source =>
      this._getSourceHighlightSetContexts(source, highlightSetId)
    ));

    contexts.sort((a, b) => a.latestHighlightTimestamp - b.latestHighlightTimestamp);

    return contexts;
  };

  // NOTE: This returns an OrderedMap
  getExpandedHighlightSets = () => {
    const state = this.state.get();
    return state.highlightSets.map(set => ({
      id: set.id,
      name: set.name,
      contexts: this._getHighlightSetContexts(state.sources, set.id),
    }));
  };
};
