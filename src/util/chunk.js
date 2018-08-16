import {Record, Map as IMap, List} from 'immutable';
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
  chunkMap: null, // IMap uid -> chunk
  sortedChunks: null, // List of chunks
});

export const createTimeRangeChunk = (begin, end, annoText) => (new Chunk({uid: genUID(), position: new RangePosition({begin, end}), annoText}));

const sortTimeRangeChunks = (chunks) => {
  return new List(chunks).sortBy(chunk => chunk.position.begin);
};

export const createTimeRangeChunkSet = (chunks) => {
  const uidChunks = [];
  for (const c of chunks) {
    uidChunks.push([c.uid, c]);
  }
  const immutChunkMap = new IMap(uidChunks);

  return new ChunkSet({
    chunkMap: immutChunkMap,
    sortedChunks: sortTimeRangeChunks(chunks),
  });
};

export const getLastStartingBeforeTime = (chunkSet, time) => {
  const sorted = chunkSet.sortedChunks;
  let l = 0, r = sorted.size - 1;
  let closestIdx = null;
  while (l <= r) {
    const m = Math.floor(0.5*(l+r));
    const ct = sorted.get(m).position.begin;
    if (ct <= time) {
      closestIdx = m;
      l = m+1;
    } else {
      r = m - 1;
    }
  }
  return {
    chunk: sorted.get(closestIdx),
    index: closestIdx,
  };
};

export const getFirstStartingAfterTime = (chunkSet, time) => {
  const sorted = chunkSet.sortedChunks;
  let l = 0, r = sorted.size - 1;
  let closestIdx = null;
  while (l <= r) {
    const m = Math.floor(0.5*(l+r));
    const ct = sorted.get(m).position.begin;
    if (ct <= time) {
      l = m+1;
    } else {
      closestIdx = m;
      r = m - 1;
    }
  }
  return {
    chunk: sorted.get(closestIdx),
    index: closestIdx,
  };
};

export const getChunkAndIndexAtTime = (chunkSet, time) => {
  const { chunk, index } = getLastStartingBeforeTime(chunkSet, time);

  if (!chunk) {
    return null;
  }

  if (time < chunk.position.begin) {
    throw new Error('internal error');
  }
  if (time >= chunk.position.end) {
    return null;
  }

  return {chunk, index};
};

export const getChunkAtTime = (chunkSet, time) => {
  const hit = getChunkAndIndexAtTime(chunkSet, time);
  if (!hit) {
    return null;
  }
  return hit.chunk;
};

export const getPrevChunkAtTime = (chunkSet, time) => {
  const current = getChunkAndIndexAtTime(chunkSet, time);
  if (current) {
    if (current.index === 0) {
      return null;
    } else {
      return chunkSet.sortedChunks.get(current.index-1);
    }
  } else {
    return getLastStartingBeforeTime(chunkSet, time).chunk;
  }
}

export const getNextChunkAtTime = (chunkSet, time) => {
  return getFirstStartingAfterTime(chunkSet, time).chunk;
}

export const setChunkAnnoText = (chunkSet, chunkId, newAnnoText) => {
  return chunkSet.setIn(['chunkMap', chunkId, 'annoText'], newAnnoText);
};
