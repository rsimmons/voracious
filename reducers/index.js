import {indexChunks, chunksAtTime} from '../util/subtitles'

function reduce(state = {count: 0, doc: null}, action) {
  switch (action.type) {
    case 'incrementCount':
      return {...state, count: state.count + 1};

    case 'newDoc':
      return {
        ...state,
        doc: {
          kind: action.kind,
          language: action.language,
          media: null,
          textChunks: {},
          currentTextChunks: {},
        },
      };

    case 'importVideoFile':
      return {
        ...state,
        doc: {
          ...state.doc,
          media: {
            videoFile: action.file,
            videoURL: URL.createObjectURL(action.file),
            currentTime: 0,
          },
        },
      };

    case 'importSubsParsed':
      return {
        ...state,
        doc: {
          ...state.doc,
          textChunks: {
            ...state.doc.textChunks,
            [action.language]: {
              chunks: action.subChunks,
              index: indexChunks(action.subChunks),
            },
          },
          // TODO: should update currentTextChunks if media is present
        },
      };

    case 'videoTimeUpdate': {
      const currentTextChunks = {};
      if (state.doc.kind === 'video') {
        for (let language in state.doc.textChunks) {
          currentTextChunks[language] = chunksAtTime(state.doc.textChunks[language].index, action.time);
        }
      }

      return {
        ...state,
        doc: {
          ...state.doc,
          media: {
            ...state.doc.media,
            currentTime: action.time,
          },
          currentTextChunks,
        }
      };
    }

    default:
      return state;
  }
}

 export default reduce;
