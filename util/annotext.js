import { Record, Map, List } from 'immutable';
import { analyzeText } from './analysis';

const AnnotatedTextRecord = new Record({
  text: null,
  ruby: null, // List of RubyRecord
});

export const autoAnnotateText = (text, language) => {
  const analysis = analyzeText(text, language);

  return new AnnotatedTextRecord({
    text,
    ruby: analysis.ruby,
  });
}
