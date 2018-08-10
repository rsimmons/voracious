const parseTime = (s) => {
  const re = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/;
  const [, hours, mins, seconds, ms] = re.exec(s);
  return 3600*(+hours) + 60*(+mins) + (+seconds) + 0.001*(+ms);
};

const cleanText = (s) => {
  const BREAK_RE = /(<br>)/ig; // SRT files shouldn't have these, but some do
  const TAG_RE = /(<([^>]+)>)/ig;
  return s.trim().replace(BREAK_RE, '\n').replace(TAG_RE, '');
};

export const parseSRT = (text) => {
  const normText = text.replace(/\r\n/g, '\n'); // normalize newlines

  const re = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n((?:.+\n)+)/g;
  const subs = [];
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
    subs.push({
      begin,
      end,
      lines: cleanText(lines),
    });
    re.lastIndex = found.index + full.length;
  }

  return subs;
};
