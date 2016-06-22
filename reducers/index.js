import { Record, Map, List, fromJS } from 'immutable';
import { createTimeRangeChunk, createTimeRangeChunkSet, getChunksAtTime } from '../util/chunk';
import { autoAnnotateText } from '../util/annotext';

const StateRecord = new Record({
  doc: null,
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
  currentChunks: null,
});

function reduce(state = new StateRecord(), action) {
  switch (action.type) {
    case 'newDoc': {
      return state.set('doc', new DocRecord({
        kind: action.kind,
      }));
    }

    case 'importVideoFile': {
      // TODO: Need to consider if we want to zero position.
      //  If yes, then should update texts currentChunks.
      //  If not, then should seek video to current position?
      return state.updateIn(['doc', 'media'], media => media.push(new VideoMediaRecord({
        language: action.language,
        videoFile: action.file,
        videoURL: URL.createObjectURL(action.file),
      })));
    }

    case 'importSubsParsed': {
      const chunks = [];
      for (const sub of action.subs) {
        const annoText = autoAnnotateText(sub.lines, action.language);
        chunks.push(createTimeRangeChunk(sub.begin, sub.end, annoText));
      }
      const chunkSet = createTimeRangeChunkSet(chunks);

      return state
        .updateIn(['doc', 'texts'], texts => texts.push(new TextRecord({
          language: action.language,
          chunkSet,
          currentChunks: new List(), // TODO: Should initialize this based on current position
        })))
        .setIn(['doc', 'textRevelation'], state.doc.texts.size+1); // Reveal all texts
    }

    case 'videoTimeUpdate': {
      return state
        .updateIn(['doc', 'texts'], texts => texts.map(textRecord => textRecord.set('currentChunks', getChunksAtTime(textRecord.chunkSet, action.time))))
        .setIn(['doc', 'position'], action.time);
    }

    case 'hideText': {
      return state.setIn(['doc', 'textRevelation'], 0);
    }

    case 'revealMoreText': {
      return state.setIn(['doc', 'textRevelation'], Math.min(state.doc.textRevelation + 1, state.doc.texts.size));
    }

    default:
      return state;
  }
}

 export default reduce;
