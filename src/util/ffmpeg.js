import path from 'path';
import { getBinariesPath } from '../util/appPaths';

const tmp = window.require('tmp-promise');
const { spawn } = window.require('child_process');
const fs = window.require('fs-extra');

const getBinaryFilename = () => {
  const ffmpegDir = path.join(getBinariesPath(), 'ffmpeg');
  let result = path.join(ffmpegDir, 'ffmpeg');
  if (process.platform === 'win32') {
    result += '.exe';
  }
  return result;
};

export const extractAudio = async (vidfn, startTime, endTime) => {
  const tmpfile = await tmp.file({keep: true, postfix: '.mp3'});

  await new Promise((resolve, reject) => {
    const subp = spawn(getBinaryFilename(), ['-i', vidfn, '-ss', startTime.toString(), '-t', (endTime-startTime).toString(), '-map', 'a', '-ab', '192k', '-f', 'mp3', '-y', tmpfile.path], {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});

    subp.on('error', (error) => {
      reject(error);
    });

    subp.on('exit', (code) => {
      if (code) {
        reject(new Error('ffmpeg exit code ' + code));
      }
      resolve();
    });
  });

  const data = await fs.readFile(tmpfile.path);

  tmpfile.cleanup();

  return data;
};
