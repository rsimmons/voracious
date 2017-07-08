const KATA_BEGIN = 0x30A1;
const KATA_END = 0x30FA;
const KATA_HIRACOMPAT_END = 0x30F6;

const HIRA_BEGIN = 0x3041;
const HIRA_END = 0x3096;

const shiftRange = (text, begin, end, offset) => {
  const result = [];
  for (const c of text) {
    const code = c.charCodeAt(0);
    if ((code >= begin) && (code <= end)) {
      result.push(String.fromCharCode(code+offset));
    } else {
      result.push(c);
    }
  }

  return result.join('');
};

export const hiraToKata = (text) => shiftRange(text, HIRA_BEGIN, HIRA_END, KATA_BEGIN-HIRA_BEGIN);
export const kataToHira = (text) => shiftRange(text, KATA_BEGIN, KATA_HIRACOMPAT_END, HIRA_BEGIN-KATA_BEGIN);

export const charIsKana = (c) => {
  const code = c.charCodeAt(0);
  return (((code >= KATA_BEGIN) && (code <= KATA_END)) || ((code >= HIRA_BEGIN) && (code <= HIRA_END)));
}

const anyChar = (s, pred) => {
  for (const c of s) {
    if (pred(c)) {
      return true;
    }
  }
  return false;
}

export const anyCharIsKana = (s) => anyChar(s, charIsKana);
