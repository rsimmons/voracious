import { parseSRT } from '../util/subtitles';

export const incrementCount = () => ({
  type: 'incrementCount',
});

export const newDoc = (kind, language) => ({
  type: 'newDoc',
  kind,
  language,
});

export const importVideoFile = (file) => ({
  type: 'importVideoFile',
  file,
});

export const importSubsParsed = (subChunks, language) => ({
  type: 'importSubsParsed',
  subChunks,
  language,
});

export const importSubsFile = (file, language) => (
  (dispatch) => { // return thunk
    // Start async file load and parse
    const reader = new FileReader();
    reader.onload = (e) => {
      // Parse loaded file data and dispatch action for result
      dispatch(importSubsParsed(parseSRT(e.target.result), language));
    };
    reader.readAsText(file);
  }
);

export const videoTimeUpdate = (time) => ({
  type: 'videoTimeUpdate',
  time,
});
