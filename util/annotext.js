import { Record, Map, List } from 'immutable';

export const Annotation = new Record({
  cpBegin: null, // integer
  cpEnd: null, // integer
  kind: null, // string
  data: null, // this should be immutable, usually a string
});

const AnnotatedText = new Record({
  text: null,
  annotations: null,
  // TODO: denormalized forms for acceleration. update toJS if we do
});

export const create = (text, annotations) => {
  // TODO: validate annotations
  return new AnnotatedText({text: text, annotations: List(annotations)});
};

export const addAnnotation = (annoText, cpBegin, cpEnd, kind, data) => {
  // TODO: validate annotation?
  return new AnnotatedText({text: annoText.text, annotations: annoText.annotations.push(new Annotation({cpBegin, cpEnd, kind, data}))});
};

export const getKindAtIndex = (annoText, kind, cpIndex) => {
  const annos = [];

  annoText.annotations.forEach((anno) => {
    if ((anno.kind === kind) && (cpIndex >= anno.cpBegin) && (cpIndex < anno.cpEnd)) {
      annos.push(anno);
    }
  });

  return annos;
};

export const getKindSorted = (annoText, kind) => {
  const annos = [];

  annoText.annotations.forEach((anno) => {
    if (anno.kind === kind) {
      annos.push(anno);
    }
  });

  // TODO: maybe sort by ends also so that result is 'nested'
  annos.sort((a, b) => a.cpBegin - b.cpBegin);

  return annos;
};

export const concat = (annoTexts) => {
  let newText = '';
  const newAnnos = [];
  let cpOffset = 0;

  for (const at of annoTexts) {
    newText += at.text;
    for (const a of at.annotations) {
      newAnnos.push(new Annotation({
        cpBegin: a.cpBegin + cpOffset,
        cpEnd: a.cpEnd + cpOffset,
        kind: a.kind,
        data: a.data,
      }));
    }
    cpOffset += [...at.text].length;
  }

  return new AnnotatedText({text: newText, annotations: newAnnos});
};

export const toJS = (annoText) => {
  return annoText.toJS();
};

export const fromJS = (obj) => {
  return new AnnotatedText({text: obj.text, annotations: obj.annotations.map(a => new Annotation(a))});
};

export const customRender = (annoText, wrapRuby, xformChar) => {
  // Determine what code point indexes are covered by 'selection' annotations
  const selectedIndexes = new Set();
  getKindSorted(annoText, 'selection').forEach(a => {
    for (let i = a.cpBegin; i < a.cpEnd; i++) {
      selectedIndexes.add(i);
    }
  });

  const pieces = [];
  const textArr = [...annoText.text.trim()]; // split up by unicode chars
  const sortedRubyAnnos = getKindSorted(annoText, 'ruby');

  const textRangeToPieces = (cpBegin, cpEnd) => {
    const result = [];
    for (let i = cpBegin; i < cpEnd; i++) {
      const c = textArr[i];
      result.push(xformChar(c, i, selectedIndexes.has(i)));
    }
    return result;
  };

  let idx = 0;
  for (const ra of sortedRubyAnnos) {
    if (ra.cpBegin < idx) {
      throw new Error('Overlapping ruby');
    }

    if (ra.cpBegin > idx) {
      pieces.push(...textRangeToPieces(idx, ra.cpBegin));
    }

    pieces.push(wrapRuby(ra, textRangeToPieces(ra.cpBegin, ra.cpEnd)));

    idx = ra.cpEnd;
  }

  // Handle remaining text
  if (idx < textArr.length) {
    pieces.push(...textRangeToPieces(idx, textArr.length));
  }

  return pieces;
};
