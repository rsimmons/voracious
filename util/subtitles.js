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

export const indexChunks = (chunks) => {
  // Build a map from integer-seconds to lists of references to all chunks that overlap that full integer-second
  const index = new Map();
  for (const c of chunks) {
    for (let t = Math.floor(c.begin); t <= Math.floor(c.end); t++) {
      if (!index.has(t)) {
        index.set(t, []);
      }
      index.get(t).push(c);
    }
  }

  return index;
};

export const chunksAtTime = (index, time) => {
  const it = Math.floor(time);

  if (!index.has(it)) {
    return [];
  }

  const result = [];
  for (const c of index.get(it)) {
    if ((time >= c.begin) && (time <= c.end)) {
      result.push(c);
    }
  }

  return result;
};
