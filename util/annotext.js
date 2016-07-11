import { Record, Map, List } from 'immutable';
import { canAnalyzeLanguage, analyzeText } from './analysis';

const AnnotatedTextRecord = new Record({
  text: null,
  ruby: null, // List of RubyRecord
  words: null, // List of WordRecord
});

export const autoAnnotateText = (text, language) => {
  if (canAnalyzeLanguage(language)) {
    const analysis = analyzeText(text, language);

    return new AnnotatedTextRecord({
      text,
      ruby: analysis.ruby,
      words: analysis.words,
    });
  } else {
    return new AnnotatedTextRecord({
      text,
      ruby: List(),
      words: List(),
    });
  }
}

export const renderAnnoTextToHTML = (annoText) => {
  const textArr = [...annoText.text.trim()]; // split up by unicode chars
  const rubyArr = annoText.ruby.toArray();

  rubyArr.sort((a, b) => a.cpBegin - b.cpBegin);

  let idx = 0;
  const pieces = [];
  for (const r of rubyArr) {
    if (r.cpBegin < idx) {
      throw new Error('Overlapping ruby');
    }

    if (r.cpBegin > idx) {
      pieces.push(escape(textArr.slice(idx, r.cpBegin).join('')));
    }

    pieces.push('<ruby>' + escape(textArr.slice(r.cpBegin, r.cpEnd).join('')) + '<rp>(</rp><rt>' + escape(r.rubyText) + '</rt><rp>)</rp></ruby>');

    idx = r.cpEnd;
  }

  // Handle remaining text
  if (idx < textArr.length) {
    pieces.push(escape(textArr.slice(idx, textArr.length).join('')));
  }

  // Join pieces
  const html = pieces.join('');

  // Convert newlines to breaks
  const brHtml = html.replace(/\n/g, '<br/>');

  return brHtml;
};
