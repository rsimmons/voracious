import { Record, Map, List } from 'immutable';

export const Annotation = new Record({
  cpBegin: null,
  cpEnd: null,
  kind: null,
  data: null,
});

const AnnotatedText = new Record({
  text: null,
  annotations: null,
  // TODO: denormalized forms for acceleration
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
