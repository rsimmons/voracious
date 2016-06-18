import {Record, Map, List, fromJS} from 'immutable';
import {createTimeRangeChunk, createTimeRangeChunkSet, getChunksAtTime} from '../util/chunk';

const StateRecord = new Record({
  doc: null,
});

const DocRecord = new Record({
  kind: null,
  media: new List(),
  texts: new List(),
  position: 0,
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
        chunks.push(createTimeRangeChunk(sub.begin, sub.end, sub.lines));
      }
      const chunkSet = createTimeRangeChunkSet(chunks);

      return state.updateIn(['doc', 'texts'], texts => texts.push(new TextRecord({
        language: action.language,
        chunkSet,
        currentChunks: new List(), // TODO: Should initialize this based on current position
      })));
    }

    case 'videoTimeUpdate': {
      return state
        .updateIn(['doc', 'texts'], texts => texts.map(textRecord => textRecord.set('currentChunks', getChunksAtTime(textRecord.chunkSet, action.time))))
        .setIn(['doc', 'position'], action.time);
    }

    default:
      return state;
  }
}

 export default reduce;
