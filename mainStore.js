import { Record, Map, List } from 'immutable';

import { createStoreClass } from './ruxx';
import genUID from './util/uid';
import { parseSRT } from './util/subtitles';
import { createAutoAnnotatedText } from './util/analysis';
import { createTimeRangeChunk, createTimeRangeChunkSet } from './util/chunk';

const MainStateRecord = new Record({
  sources: new Map(),
});

const SourceRecord = new Record({
  id: undefined,
  kind: undefined,
  media: new List(),
  texts: new List(),
});

const DocRecord = new Record({
  kind: null,
  media: new List(),
  texts: new List(),
  position: 0,
  textRevelation: 0,
});

const VideoMediaRecord = new Record({
  language: null,
  videoFile: null,
  videoURL: null,
});

const TextRecord = new Record({
  language: null,
  chunkSet: null,
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

      this.setState(this.getState().updateIn(['sources', sourceId, 'texts'], texts => texts.push(new TextRecord({
        language: language,
        chunkSet,
      }))));
      // TODO: previously we revealed all texts when new sub track was added, to reduce confusion
    };
    reader.readAsText(file);
  },
};

export default createStoreClass(initialState, actions);
