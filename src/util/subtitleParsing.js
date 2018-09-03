import { WebVTTParser } from 'webvtt-parser';

const cleanText = (s) => {
  const BREAK_RE = /(<br>)/ig; // sub files shouldn't have these, but some do
  const NL_RE = /(\\n|\\N)/ig;
  const TAG_RE = /(<([^>]+)>)/ig;
  const ASS_STYLE_RE = /(\{\\[^}]*\})/ig;
  return s.trim().replace(BREAK_RE, '\n').replace(NL_RE, '\n').replace(TAG_RE, '').replace(ASS_STYLE_RE, '');
};

const parseSRTTime = (s) => {
  const re = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/;
  const [, hours, mins, seconds, ms] = re.exec(s);
  return 3600*(+hours) + 60*(+mins) + (+seconds) + 0.001*(+ms);
};

export const parseSRT = (text) => {
  const normText = text.replace(/\r\n/g, '\n'); // normalize newlines

  const re = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\s*\n((?:.+\n)+)/g;
  const subs = [];
  let found;

  while (true) {
    found = re.exec(normText);
    if (!found) {
      break;
    }
    const [full, , beginStr, endStr, lines] = found;
    const begin = parseSRTTime(beginStr);
    const end = parseSRTTime(endStr);
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

export const parseVTT = (text) => {
  const parser = new WebVTTParser();

  const tree = parser.parse(text, 'metadata');

  return tree.cues.map(cue => ({
    begin: cue.startTime,
    end: cue.endTime,
    lines: cleanText(cue.text),
  }));
};

const parseASSTime = (s) => {
  const re = /(\d):(\d{2}):(\d{2})\.(\d{2})/;
  const [, hours, mins, seconds, cs] = re.exec(s);
  return 3600*(+hours) + 60*(+mins) + (+seconds) + 0.01*(+cs);
};

export const parseASS = (text) => {
  const EVENTS_SECTION_RE = /^\[Events\]\s+Format:(.*)\s*([^]*)/mg;
  const EVENT_LINE_RE = /([^:]+):\s*(.*)/;

  const result = [];

  const eventsSectionMatch = EVENTS_SECTION_RE.exec(text);
  if (eventsSectionMatch) {
    const fieldNames = eventsSectionMatch[1].split(',').map(s => s.trim());
    if (fieldNames[fieldNames.length-1] !== 'Text') {
      throw new Error('Last field of ASS events must be Text');
    }

    const startFieldIdx = fieldNames.indexOf('Start');
    if (startFieldIdx < 0) {
      throw new Error('Start field not found in ASS events format');
    }
    const endFieldIdx = fieldNames.indexOf('End');
    if (endFieldIdx < 0) {
      throw new Error('End field not found in ASS events format');
    }

    const eventLines = eventsSectionMatch[2].trim().split('\n').map(s => s.trim());

    for (const eventLine of eventLines) {
      const lineMatch = EVENT_LINE_RE.exec(eventLine);
      if (lineMatch) {
        const eventType = lineMatch[1];
        if (eventType === 'Dialogue') {
          const fields = lineMatch[2].split(',');
          const text = fields.slice(fieldNames.length-1).join(',').trim();
          const start = parseASSTime(fields[startFieldIdx]);
          const end = parseASSTime(fields[endFieldIdx]);
          if (text) {
            result.push({
              begin: start,
              end,
              lines: cleanText(text),
            });
          }
        }
      }
    }
  }

  return result;
};
