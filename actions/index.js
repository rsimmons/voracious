import { parseSRT } from '../util/subtitles';

export const newDoc = (kind) => ({
  type: 'newDoc',
  kind,
});

export const importVideoFile = (file, language) => ({
  type: 'importVideoFile',
  file,
  language,
});

export const importSubsParsed = (subs, language) => ({
  type: 'importSubsParsed',
  subs,
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
