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
