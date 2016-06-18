import {Record, Map, List, fromJS} from 'immutable';
import genUID from './uid';

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
