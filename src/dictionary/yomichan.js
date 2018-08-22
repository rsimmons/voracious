import JSZip from 'jszip';

const fs = window.require('fs-extra');

const loadBank = async (zip, bankName, dictName, reportProgress) => {
  let num = 1;
  const parts = [];

  while (true) {
    const fn = `${bankName}_bank_${num}.json`;
    if (!zip.files[fn]) {
      break;
    }

    if (reportProgress) {
      reportProgress('Loading ' + dictName + ' ' + fn + '...');
    }
    parts.push(JSON.parse(await zip.files[fn].async('string')));

    num++;
  }

  const entries = parts.reduce((acc, val) => acc.concat(val), []);

  return entries;
};

export const loadYomichanZip = async (fn, reportProgress) => {
  if (reportProgress) {
    reportProgress('Opening ' + fn + '...');
  }
  console.time('load yomichan zip ' + fn);
  const data = await fs.readFile(fn);
  const zip = await JSZip.loadAsync(data);
  const keys = Object.keys(zip.files);
  keys.sort();

  const indexObj = JSON.parse(await zip.files['index.json'].async('string'));
  if (indexObj.format !== 3) {
    throw new Error('wrong format');
  }
  if (!indexObj.sequenced) {
    throw new Error('not sequenced?');
  }

  const termEntries = await loadBank(zip, 'term', indexObj.title, reportProgress);
  console.timeEnd('load yomichan zip ' + fn);
  return {
    name: indexObj.title,
    termEntries,
  };
};
