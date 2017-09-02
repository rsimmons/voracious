import {Record, Map, List} from 'immutable';
import genUID from './uid';
import {toJS as annoTextToJS, fromJS as annoTextFromJS} from './annotext';

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

export const chunkSetIterableChunks = (chunkSet) => {
  return chunkSet.chunkMap.values();
};

export const chunkSetIterableChunkIds = (chunkSet) => {
  return chunkSet.chunkMap.keys();
};

export const chunkSetChunkIdsArray = (chunkSet) => {
  const chunkIds = [];
  for (const cid of chunkSet.chunkMap.keys()) {
    chunkIds.push(cid);
  }
  return chunkIds;
};

export const getChunkById = (chunkSet, chunkId) => {
  return chunkSet.chunkMap.get(chunkId);
};

export const getChunksAtTime = (chunkSet, time) => {
  const it = Math.floor(time);
  const index = chunkSet.index;

  if (!index.has(it)) {
    return [];
  }

  const result = [];
  for (const cid of index.get(it)) {
    const c = chunkSet.chunkMap.get(cid);
    if ((time >= c.position.begin) && (time < c.position.end)) {
      result.push(c);
    }
  }

  return result;
};

export const getLastChunkAtTime = (chunkSet, time) => {
  const chunks = getChunksAtTime(chunkSet, time);
  if (chunks.length === 0) {
    return null;
  } else {
    return chunks[chunks.length-1];
  }
};

export const getChunksInRange = (chunkSet, begin, end) => {
  const iBegin = Math.floor(begin);
  const iEnd = Math.floor(end);
  const index = chunkSet.index;
  const resultCids = {}; // NOTE: this is hacky, should use Set or something

  for (let i = iBegin; i <= iEnd; i++) {
    if (index.has(i)) {
      for (const cid of index.get(i)) {
        const c = chunkSet.chunkMap.get(cid);
        if ((end > c.position.begin) && (begin < c.position.end)) {
          resultCids[cid] = null;
        }
      }
    }
  }

  const result = [];
  for (const cid in resultCids) {
    result.push(chunkSet.chunkMap.get(cid));
  }
  return List(result);
};

export const setChunkAnnoText = (chunkSet, chunkId, newAnnoText) => {
  return chunkSet.setIn(['chunkMap', chunkId, 'annoText'], newAnnoText);
};

export const chunkToJSNoID = (chunk) => {
  return {
    position: chunk.position.toJS(),
    annoText: annoTextToJS(chunk.annoText),
  };
};

export const chunkFromIdJS = (chunkId, chunkJS) => {
  return new Chunk({
    uid: chunkId,
    position: new RangePosition(chunkJS.position),
    annoText: annoTextFromJS(chunkJS.annoText),
  });
};
