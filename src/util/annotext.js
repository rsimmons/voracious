import { Record, List, OrderedMap } from 'immutable';

// in order of priority
const validKinds = new OrderedMap({
  'ruby': {priority: 0},
  'highlight': {priority: 1},
  'word': {priority: 2},
});

const Annotation = new Record({
  cpBegin: null, // integer
  cpEnd: null, // integer
  kind: null, // string
  data: null, // this should be immutable
});

const AnnotatedText = new Record({
  text: null,
  annotations: null,
  // TODO: denormalized forms for acceleration. update toJS if we do
});

export const create = (text, annotations) => {
  let result = new AnnotatedText({text: text, annotations: new List()});

  if (annotations) {
    for (const a of annotations) {
      result = addAnnotation(result, a.cpBegin, a.cpEnd, a.kind, a.data);
    }
  }

  return result;
};

export const addAnnotation = (annoText, cpBegin, cpEnd, kind, data) => {
  // TODO: validate annotation
  if (!validKinds.has(kind)) {
    throw new Error('invalid kind ' + kind);
  }

  const newAnnoText = new AnnotatedText({
    text: annoText.text,
    annotations: annoText.annotations.push(new Annotation({
      cpBegin,
      cpEnd,
      kind,
      data,
    })),
  });

  // TODO: Handle this better
  // If the new annotation has caused nesting to fail, we don't add it.
  if (!annotationsNest(newAnnoText)) {
    console.warn('New annotation failed to nest, not adding');
    return annoText;
  }

  return newAnnoText;
};

export const addRubyAnnotation = (annoText, cpBegin, cpEnd, rubyText) => {
  const clearedAnnoText = clearKindInRange(annoText, cpBegin, cpEnd, 'ruby');
  if (rubyText) {
    return addAnnotation(clearedAnnoText, cpBegin, cpEnd, 'ruby', rubyText);
  } else {
    return clearedAnnoText;
  }
};

export const addHighlightAnnotation = (annoText, cpBegin, cpEnd, setId) => {
  const clearedAnnoText = removeHighlightAnnotations(annoText, cpBegin, cpEnd, setId);
  // TODO: data should be an Immutable record
  return addAnnotation(clearedAnnoText, cpBegin, cpEnd, 'highlight', {timeCreated: Date.now(), setId});
};

export const removeHighlightAnnotations = (annoText, cpBegin, cpEnd, setId) => {
  let newAnnoText = annoText;
  for (const anno of getKindInRange(annoText, 'highlight', cpBegin, cpEnd)) {
    if (anno.data.setId === setId) {
      newAnnoText = deleteAnnotation(newAnnoText, anno);
    }
  }
  return newAnnoText;
};

export const addWordAnnotation = (annoText, cpBegin, cpEnd, lemma) => {
  const data = lemma ? {lemma} : {};
  return addAnnotation(annoText, cpBegin, cpEnd, 'word', data);
};

export const clearKindInRange = (annoText, cpBegin, cpEnd, kind) => {
  return annoText.update('annotations', annotations => annotations.filter(anno => ((anno.kind !== kind) || (anno.cpEnd <= cpBegin) || (anno.cpBegin >= cpEnd))));
};

export const deleteAnnotation = (annoText, anno) => {
  return annoText.update('annotations', annotations => annotations.filter(a => (a !== anno)));
};

export const getKindAtIndex = (annoText, kind, cpIndex) => {
  const annos = [];

  annoText.annotations.forEach((anno) => {
    if ((anno.kind === kind) && (cpIndex >= anno.cpBegin) && (cpIndex < anno.cpEnd)) {
      annos.push(anno);
    }
  });

  annos.sort(nestingAnnoSortFunc);

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

export const getInRange = (annoText, cpBegin, cpEnd) => {
  const annos = [];

  annoText.annotations.forEach((anno, i) => {
    if ((cpEnd > anno.cpBegin) && (cpBegin < anno.cpEnd)) {
      annos.push(anno);
    }
  });

  annos.sort(nestingAnnoSortFunc);

  return annos;
};

export const getKindInRange = (annoText, kind, cpBegin, cpEnd) => {
  const annos = [];

  annoText.annotations.forEach((anno, i) => {
    if ((anno.kind === kind) && (cpEnd > anno.cpBegin) && (cpBegin < anno.cpEnd)) {
      annos.push(anno);
    }
  });

  annos.sort(nestingAnnoSortFunc);

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
  return new AnnotatedText({text: obj.text, annotations: new List(obj.annotations.map(a => new Annotation(a)))});
};

// Determine whether the given annotations nest properly without splitting.
const annotationsNest = (annoText) => {
  const sortedAnnos = annoText.annotations.toArray();
  sortedAnnos.sort(nestingAnnoSortFunc);

  const annoStack = [];
  let idx = 0;

  for (const a of sortedAnnos) {
    // Sanity check
    if (a.cpBegin < idx) {
      throw new Error('Internal error');
    }

    // Pop any annotations that we exit before this next annotation begins
    while (annoStack.length && (annoStack[annoStack.length-1].cpEnd <= a.cpBegin)) {
      annoStack.pop();
    }

    // Advance index to the beginning of this next annotation
    idx = a.cpBegin;

    // The anno we're about to push onto the stack should be fully
    //  contained within anno at current top of stack. Otherwise that
    //  means we fail to nest.
    if (annoStack.length) {
      const topAnno = annoStack[annoStack.length-1];
      if ((a.cpBegin < topAnno.cpBegin) || (a.cpEnd > topAnno.cpEnd)) {
        return false;
      }
    }

    annoStack.push(a);
  }

  // NOTE: Stack is not supposed to end empty, and we don't care about
  //  end state of stack.

  return true;
};

// wrap takes an anno and list of pieces, and must return a list of pieces
// xformChar takes a char and index, and must return a single piece
export const customRender = (annoText, wrap, xformChar) => {
  const sortedAnnos = annoText.annotations.toArray();
  sortedAnnos.sort(nestingAnnoSortFunc);

  const textArr = [...annoText.text]; // split up by unicode chars
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

  for (const a of sortedAnnos) {
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
