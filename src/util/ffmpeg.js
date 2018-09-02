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
    const subp = spawn(getBinaryFilename(), ['-ss', startTime.toString(), '-i', vidfn, '-t', (endTime-startTime).toString(), '-map', 'a', '-ab', '192k', '-f', 'mp3', '-y', tmpfile.path], {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});

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

export const extractFrameImage = async (vidfn, time) => {
  const tmpfile = await tmp.file({keep: true, postfix: '.jpg'});

  await new Promise((resolve, reject) => {
    // TODO: we can add something like "-vf scale='min(854,iw)':'min(480,ih):force_original_aspect_ratio=decrease" to scale the image to fit inside certain dimensions
    const subp = spawn(getBinaryFilename(), ['-ss', time.toString(), '-i', vidfn, '-frames:v', '1', '-y', tmpfile.path], {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});

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
