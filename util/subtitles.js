const parseTime = (s) => {
  const re = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/;
  const [, hours, mins, seconds, ms] = re.exec(s);
  return 3600*(+hours) + 60*(+mins) + (+seconds) + 0.001*(+ms);
};

export const parseSRT = (text) => {
  const normText = text.replace(/\r\n/g, '\n'); // normalize newlines

  const re = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n((?:.+\n)+)/g;
  const chunks = [];
  let found;

  while (true) {
    found = re.exec(normText);
    if (!found) {
      break;
    }
    const [full, , beginStr, endStr, lines] = found;
    const begin = parseTime(beginStr);
    const end = parseTime(endStr);
    // TODO: Should verify that end time is >= begin time
    // NOTE: We could check that indexes and/or time are in order, but don't really care
    chunks.push({
      begin,
      end,
      lines,
    });
    re.lastIndex = found.index + full.length;
  }

  return chunks;
};

const indexSortedChunks = (chunks) => {
  // Determine a "center" time to partition on. Goal is just to balance tree.
  const centerIdx = Math.floor(0.5*chunks.length);
  const centerChunk = chunks[centerIdx];
  const centerTime = 0.5*(centerChunk.begin + centerChunk.end);

  // Partition on center time, into chunks that are fully-left, overlapping, and fully-right
  const left = [];
  const overlap = [];
  const right = [];
  for (const c of chunks) {
    if (c.end < centerTime) {
      left.push(c);
    } else if (c.begin > centerTime) {
      right.push(c);
    } else {
      overlap.push(c);
    }
  }

  if ((left.length === 0) || (right.length === 0)) {
    // Not enough useful partitioning was done, make this a leaf node
    return {
      leaf: true,
      chunks: left.concat(overlap, right),
    };
  }

  // Partitioning was done, return a non-leaf node.
  // Note that we duplicate the overlap into left and right, which makes things simpler.
  return {
    leaf: false,
    splitTime: centerTime,
    left: indexSortedChunks(left.concat(overlap)),
    right: indexSortedChunks(right.concat(overlap)),
  };
};

export const indexChunks = (chunks) => {
  // Build something like an Interval Tree.
  // This differs from wikipedia but I think mine is correct and simpler.
  const sortedChunks = [...chunks];

   // Roughly sort chunks. It doesn't need to be "perfect", will just help balance tree.
  sortedChunks.sort((a, b) => (a.begin - b.begin));
  return indexSortedChunks(sortedChunks);
};

export const chunksAtTime = (index, time) => {
  if (index.leaf) {
    const result = [];
    for (const c of index.chunks) {
      if ((time >= c.begin) && (time <= c.end)) {
        result.push(c);
      }
    }
    return result;
  }

  // Not a leaf
  if (time < index.splitTime) {
    return chunksAtTime(index.left, time);
  }
  return chunksAtTime(index.right, time);
};
