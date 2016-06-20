import {Record, Map, List, fromJS} from 'immutable';
import genUID from './uid';
import escape from 'escape-html';

const RangePosition = new Record({
  begin: null,
  end: null,
});

const Chunk = new Record({
  uid: null,
  position: null,
  annoText: null,
});

const ChunkSet = new Record({
  chunkMap: null, // uid -> chunk
  index: null,
});

export const createTimeRangeChunk = (begin, end, annoText) => (new Chunk({uid: genUID(), position: new RangePosition({begin, end}), annoText}));

const indexTimeRangeChunks = (chunks) => {
  // Build a map from integer-seconds to lists of references to all chunks that overlap that full integer-second
  let index = new Map();
  for (const c of chunks) {
    for (let t = Math.floor(c.position.begin); t <= Math.floor(c.position.end); t++) {
      if (!index.has(t)) {
        index = index.set(t, List());
      }
      index = index.updateIn([t], v => v.push(c.uid));
    }
  }

  return index;
};

export const createTimeRangeChunkSet = (chunks) => {
  const uidChunks = [];
  for (const c of chunks) {
    uidChunks.push([c.uid, c]);
  }
  const immutChunkMap = new Map(uidChunks);

  return new ChunkSet({
    chunkMap: immutChunkMap,
    index: indexTimeRangeChunks(chunks),
  });
};

export const getChunksAtTime = (chunkSet, time) => {
  const it = Math.floor(time);
  const index = chunkSet.index;

  if (!index.has(it)) {
    return List();
  }

  const result = [];
  for (const cid of index.get(it)) {
    const c = chunkSet.chunkMap.get(cid);
    if ((time >= c.position.begin) && (time <= c.position.end)) {
      result.push(c);
    }
  }

  return List(result);
};

export const renderChunkHTML = (chunk) => {
  const textArr = [...chunk.annoText.text.trim()]; // split up by unicode chars
  const rubyArr = chunk.annoText.ruby.toArray();

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
