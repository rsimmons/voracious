import { Record, List } from 'immutable';
import { hiraToKata, kataToHira, anyCharIsKana } from '../util/japanese';
import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

let kuromojiTokenizer = null;

export const loadKuromoji = () => {
  console.log('Loading Kuromoji ...');
  kuromoji.builder({ dicPath: "/kuromoji/dict/" }).build(function (err, tokenizer) {
    console.log('Kuromoji loaded');
    kuromojiTokenizer = tokenizer;
  });
};

const RubyRecord = new Record({
  cpBegin: null,
  cpEnd: null,
  rubyText: null,
});

const WordRecord = new Record({
  cpBegin: null,
  cpEnd: null,
  lemma: null,
});

const analyzeJAKuromoji = (text) => {
  if (!kuromojiTokenizer) {
    throw new Error('Kuromoji has not been loaded');
  }

  const tokens = kuromojiTokenizer.tokenize(text);
  const mutRuby = [];
  const mutWords = [];

  for (const t of tokens) {
    // NOTE: cpBegin and cpEnd are code point indexes, not byte indexes
    const cpBegin = t.word_position - 1; // WTF 1-based indexing?
    const cpEnd = cpBegin + t.surface_form.length;

    // sanity checks
    if ([...text].slice(cpBegin, cpEnd).join('') !== t.surface_form) {
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

    mutWords.push(WordRecord({
      cpBegin,
      cpEnd,
      lemma: t.basic_form,
    }));

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
              mutRuby.push(RubyRecord({
                cpBegin: cpBegin + beginOff,
                cpEnd: cpBegin + endOff,
                rubyText: s,
              }));
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
          mutRuby.push(RubyRecord({
            cpBegin,
            cpEnd,
            rubyText: hiraReading,
          }));
        }
      }
    }
  }

  return {
    ruby: List(mutRuby),
    words: List(mutWords),
  }
};

const languageAnalyzerFunc = {
  'ja': analyzeJAKuromoji,
}

export const canAnalyzeLanguage = (language) => languageAnalyzerFunc.hasOwnProperty(language);

export const analyzeText = (text, language) => {
  if (!canAnalyzeLanguage(language)) {
    throw new Error('Cannot analyze ' + language);
  }

  return languageAnalyzerFunc[language](text);
};
