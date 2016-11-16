import { Record, Map, List, OrderedMap } from 'immutable';

// in order of priority
const validKinds = new OrderedMap({
  'ruby': {priority: 0},
  'selection': {priority: 1},
  'lemma': {priority: 2},
});

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
  // TODO: validate annotation
  if (!validKinds.has(kind)) {
    throw new Error('invalid kind ' + kind);
  }

  return new AnnotatedText({text: annoText.text, annotations: annoText.annotations.push(new Annotation({cpBegin, cpEnd, kind, data}))});
};

export const clearKindInRange = (annoText, kind, cpBegin, cpEnd) => {
  return annoText.update('annotations', annotations => annotations.filter(anno => ((anno.cpEnd <= cpBegin) || (anno.cpBegin >= cpEnd))));
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

export const getKind = (annoText, kind) => {
  const annos = [];

  annoText.annotations.forEach((anno) => {
    if (anno.kind === kind) {
      annos.push(anno);
    }
  });

  return annos;
};

const nestingAnnoSortFunc = (a, b) => {
  if (a.cpBegin < b.cpBegin) {
    return -1;
  }
  if (a.cpBegin > b.cpBegin) {
    return 1;
  }
  if (a.cpEnd < b.cpEnd) {
    return 1;
  }
  if (a.cpEnd > b.cpEnd) {
    return -1;
  }
  if (validKinds.get(a.kind).priority < validKinds.get(b.kind).priority) {
    return -1;
  }
  if (validKinds.get(a.kind).priority > validKinds.get(b.kind).priority) {
    return 1;
  }
  return 0;
}

export const getKindSorted = (annoText, kind) => {
  const annos = getKind(annoText, kind);

  annos.sort(nestingAnnoSortFunc);

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

// wrap takes an anno and list of pieces, and must return a list of pieces
// xformChar takes a char and index, and must return a single piece
export const customRender = (annoText, wrap, xformChar) => {
  const splitPoints = new Set(); // mutable Set
  const splitAnnos = [];

  for (const kind of validKinds.keys()) {
    for (const a of getKind(annoText, kind)) {
      let beg = a.cpBegin;
      for (let i = a.cpBegin+1; i < a.cpEnd; i++) {
        if (splitPoints.has(i)) {
          splitAnnos.push({cpBegin: beg, cpEnd: i, kind: a.kind, data: a.data});
          beg = i;
        }
      }
      splitAnnos.push({cpBegin: beg, cpEnd: a.cpEnd, kind: a.kind, data: a.data});
      splitPoints.add(a.cpBegin);
      splitPoints.add(a.cpEnd);
    }
  }

  splitAnnos.sort(nestingAnnoSortFunc);

  let pieces = [];
  const textArr = [...annoText.text.trim()]; // split up by unicode chars
  let idx = 0;

  // Advance idx up to cpEnd, pushing pieces onto top of pieces stack
  const advanceToIndex = (cpEnd) => {
    const topPieces = piecesStack[piecesStack.length-1];
    for (; idx < cpEnd; idx++) {
      const c = textArr[idx];
      topPieces.push(xformChar(c, idx));
    }
  }

  const annoStack = [];
  const piecesStack = [[]];

  // Unwind stack as long as topmost anno ends by given index
  const unwindToIndex = (idx) => {
    while (annoStack.length && (annoStack[annoStack.length-1].cpEnd <= idx)) {
      const topAnno = annoStack.pop();

      advanceToIndex(topAnno.cpEnd);

      const topPieces = piecesStack.pop();

      piecesStack[piecesStack.length-1].push(...wrap(topAnno, topPieces));
    }
  }

  for (const a of splitAnnos) {
    // Sanity check
    if (a.cpBegin < idx) {
      throw new Error('Internal error');
    }

    unwindToIndex(a.cpBegin);
    advanceToIndex(a.cpBegin);

    // Sanity check: a should be fully contained within anno at top of stack
    if (annoStack.length) {
      const topAnno = annoStack[annoStack.length-1];
      if ((a.cpBegin < topAnno.cpBegin) || (a.cpEnd > topAnno.cpEnd)) {
        throw new Error('Internal error');
      }
    }

    annoStack.push(a);
    piecesStack.push([]);
  }

  // Handle remaining text
  unwindToIndex(textArr.length);
  advanceToIndex(textArr.length);

  if (piecesStack.length !== 1) {
    throw new Error('Internal error');
  }

  return piecesStack[0];
};
