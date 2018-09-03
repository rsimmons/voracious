import { hiraToKata, kataToHira, anyCharIsKana } from '../util/japanese';
import DiffMatchPatch from 'diff-match-patch';
import { create as createAnnoText } from './annotext';
import { cpSlice } from '../util/string';
const kuromoji = window.kuromoji; // loaded by script tag in index.html, we do this to avoid lint warning

const dmp = new DiffMatchPatch();

let kuromojiTokenizer = null;
let kuromojiLoadPromise = null;

export const startLoadingKuromoji = () => {
  console.log('Loading Kuromoji ...');
  const dicPath = window.location.href.startsWith('file:') ? './kuromoji/dict/' : '/kuromoji/dict/';
  kuromojiLoadPromise = new Promise(resolve =>
    kuromoji.builder({ dicPath }).build(function (err, tokenizer) {
      console.log('Kuromoji loaded');
      kuromojiTokenizer = tokenizer;
      resolve();
    })
  );
};

export const ensureKuromojiLoaded = async () => {
  if (!kuromojiLoadPromise) {
    startLoadingKuromoji();
  }
  await kuromojiLoadPromise;
};

const analyzeJAKuromoji = async (text) => {
  await ensureKuromojiLoaded();

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
                console.warn('diff matching furigana, endOff <= beginOff', t.surface_form, hiraReading);
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
                throw new Error('diff should only return [-1,0,1]');
              }
              beginOff += [...s].length;
              endOff = beginOff;
            }
          }
          if (beginOff !== endOff) {
            console.warn('diff matching furigana, beginOff !== endOff', t.surface_form, hiraReading);
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
  'jpn': analyzeJAKuromoji,
}

const canAnalyzeLanguage = (language) => languageAnalyzerFunc.hasOwnProperty(language);

const analyzeText = async (text, language) => {
  if (!canAnalyzeLanguage(language)) {
    throw new Error('Cannot analyze ' + language);
  }

  return await languageAnalyzerFunc[language](text);
};

// expects ISO 639-3
export const createAutoAnnotatedText = async (text, language) => {
  if (canAnalyzeLanguage(language)) {
    return createAnnoText(text, await analyzeText(text, language));
  } else {
    return createAnnoText(text);
  }
}
