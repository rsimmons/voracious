import { hiraToKata, kataToHira, anyCharIsKana } from '../util/japanese';
import DiffMatchPatch from 'diff-match-patch';
import { create as createAnnoText } from './annotext';
import { cpSlice } from '../util/string';
const kuromoji = window.kuromoji; // loaded by script tag in index.html, we do this to avoid lint warning

const dmp = new DiffMatchPatch();

let kuromojiTokenizer = null;

export const loadKuromoji = () => {
  console.log('Loading Kuromoji ...');
  kuromoji.builder({ dicPath: "./kuromoji/dict/" }).build(function (err, tokenizer) {
    console.log('Kuromoji loaded');
    kuromojiTokenizer = tokenizer;
  });
};

const analyzeJAKuromoji = (text) => {
  if (!kuromojiTokenizer) {
    throw new Error('Kuromoji has not been loaded');
  }

  const tokens = kuromojiTokenizer.tokenize(text);
  const annotations = [];

  // code point indexes, not byte indexes
  let cpBegin;
  let cpEnd = 0;

  for (const t of tokens) {
    cpBegin = cpEnd;
    cpEnd = cpBegin + [...t.surface_form].length;

    const textSlice = cpSlice(text, cpBegin, cpEnd);

    // sanity checks
    if (textSlice !== t.surface_form) {
      throw new Error('Input text token does not match surface_form');
    }

    if ((!t.basic_form) || (t.basic_form === '')) {
      throw new Error('Unexpected');
    }

    // skip some stuff
    if (t.pos === '記号') {
      continue;
    }

    // skip ones without basic_form properly set, for now
    if (t.basic_form === '*') {
      continue;
    }

    annotations.push({
      cpBegin,
      cpEnd,
      kind: 'word',
      data: (t.basic_form === textSlice) ? {} : {lemma: t.basic_form},
    });

    if (t.reading !== '*') {
      const kataReading = hiraToKata(t.reading);
      const kataSurfaceForm = hiraToKata(t.surface_form);

      if (kataReading !== kataSurfaceForm) {
        const hiraReading = kataToHira(t.reading);

        if (anyCharIsKana(t.surface_form)) {
          const diffs = dmp.diff_main(kataToHira(t.surface_form), hiraReading);
          let beginOff = 0;
          let endOff = 0;
          for (const [action, s] of diffs) {
            if (action === -1) {
              // Deletion
              endOff = beginOff + [...s].length;
            } else if (action === 1) {
              // Insertion
              if (endOff <= beginOff) {
                throw new Error('Unexpected');
              }
              annotations.push({
                cpBegin: cpBegin + beginOff,
                cpEnd: cpBegin + endOff,
                kind: 'ruby',
                data: s,
              });
              beginOff = endOff;
            } else {
              if (action !== 0) {
                throw new Error('Unexpected');
              }
              beginOff += [...s].length;
              endOff = beginOff;
            }
          }
          if (beginOff !== endOff) {
            throw new Error('Unexpected');
          }
        } else {
          // Simple case
          annotations.push({
            cpBegin,
            cpEnd,
            kind: 'ruby',
            data: hiraReading,
          });
        }
      }
    }
  }

  return annotations;
};

const languageAnalyzerFunc = {
  'ja': analyzeJAKuromoji,
}

const canAnalyzeLanguage = (language) => languageAnalyzerFunc.hasOwnProperty(language);

const analyzeText = (text, language) => {
  if (!canAnalyzeLanguage(language)) {
    throw new Error('Cannot analyze ' + language);
  }

  return languageAnalyzerFunc[language](text);
};

export const createAutoAnnotatedText = (text, language) => {
  if (canAnalyzeLanguage(language)) {
    return createAnnoText(text, analyzeText(text, language));
  } else {
    return createAnnoText(text);
  }
}
