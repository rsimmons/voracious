let kuromojiTokenizer = null;

export const loadKuromoji = () => {
  console.log('Loading Kuromoji ...');
  kuromoji.builder({ dicPath: "/kuromoji/dict/" }).build(function (err, tokenizer) {
    console.log('Kuromoji loaded');
    kuromojiTokenizer = tokenizer;
  });
}

export const analyzeText = (text, language) => {
  if (language !== 'ja') {
    throw new Error('Can only analyze Japanese for now');
  }
}
