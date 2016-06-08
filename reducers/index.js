import {Record, Map, List, fromJS} from 'immutable';
import {indexChunks, chunksAtTime} from '../util/subtitles';

const genId = (() => {
  let nextId = 0;
  return () => {
    return 'id' + (nextId++);
  }
})();

const StateRecord = new Record({
  doc: null,
});

const DocRecord = new Record({
  kind: null,
  media: new Map(),
  texts: new Map(),
  position: 0,
});

const VideoMediaRecord = new Record({
  videoFile: null,
  videoURL: null,
});

const TextRecord = new Record({
  chunks: null,
  index: null,
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
      const newMediaId = genId();
      return state.setIn(['doc', 'media', newMediaId], new VideoMediaRecord({
        videoFile: action.file,
        videoURL: URL.createObjectURL(action.file),
      }));
      // TODO: Need to consider if we want to zero position.
      //  If yes, then should update texts currentChunks.
      //  If not, then should seek video to current position?
    }

    case 'importSubsParsed': {
      const newTextId = genId();
      return state.setIn(['doc', 'texts', newTextId], new TextRecord({
        chunks: fromJS(action.subChunks),
        index: fromJS(indexChunks(action.subChunks)),
        currentChunks: new List(), // TODO: Should initialize this based on current position
      }));
    }

    case 'videoTimeUpdate': {
      return state
        .updateIn(['doc', 'texts'], texts => texts.map(textRecord => textRecord.set('currentChunks', fromJS(chunksAtTime(textRecord.index, action.time)))))
        .setIn(['doc', 'position'], action.time);
    }

    default:
      return state;
  }
}

 export default reduce;
