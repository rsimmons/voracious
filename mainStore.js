import { Record, Map, List } from 'immutable';

import { createStoreClass } from './ruxx';
import genUID from './util/uid';
import { parseSRT } from './util/subtitles';
import { createAutoAnnotatedText } from './util/analysis';
import { createTimeRangeChunk, createTimeRangeChunkSet } from './util/chunk';

const MainStateRecord = new Record({
  sources: new Map(), // uid -> SourceRecord
  decks: new Map(), // uid -> DeckRecord
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
  snips: new List(), // List of SnipRecord
});

const SnipRecord = new Record({
  id: undefined,
  texts: new List(), // List of SnipTextRecord
});

const SnipTextRecord = new Record({
  annoText: undefined,
  language: undefined,
});

const initialState = new MainStateRecord();

const actions = {
  createSource: function(kind) {
    const sourceId = genUID();
    this.setState(this.getState().setIn(['sources', sourceId], new SourceRecord({
      id: sourceId,
      kind,
    })));
  },

  sourceAddVideoFile: function(sourceId, file, language) {
    this.setState(this.getState().updateIn(['sources', sourceId, 'media'], media => media.push(new VideoMediaRecord({
      language,
      // videoFile: file,
      videoURL: URL.createObjectURL(file),
    }))));
  },

  sourceAddSubsFile: function(sourceId, file, language) {
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

      this.setState(this.getState().updateIn(['sources', sourceId, 'texts'], texts => texts.push(new SourceTextRecord({
        language: language,
        chunkSet,
      }))));
      // TODO: previously we revealed all texts when new sub track was added, to reduce confusion
    };
    reader.readAsText(file);
  },

  setSourceViewPosition: function(sourceId, position) {
    this.setState(this.getState().setIn(['sources', sourceId, 'viewPosition'], position));
  },

  createDeck: function() {
    const deckId = genUID();
    this.setState(this.getState().setIn(['decks', deckId], new DeckRecord({
      id: deckId,
    })));

    if (!this.getState().snipDeckId) {
      this.setState(this.getState().set('snipDeckId', deckId));
    }
  },

  setSnipDeckId: function(deckId) {
    // TODO: verify deckId exists
    this.setState(this.getState().set('snipDeckId', deckId));
  },

  addSnip: function(deckId, texts) {
    const snipId = genUID();
    const snipTexts = new List(texts.map(t => new SnipTextRecord({annoText: t.annoText, language: t.language})));

    this.setState(this.getState().updateIn(['decks', deckId, 'snips'], snips => snips.push(new SnipRecord({
      id: snipId,
      texts: snipTexts,
    }))));
  },
};

export default createStoreClass(initialState, actions);
