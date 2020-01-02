import assert from 'assert';

export const startsWith = (s, prefix) => (s.substr(0, prefix.length) === prefix);

export const removePrefix = (s, prefix) => {
  assert(startsWith(s, prefix));
  return s.substr(prefix.length);
}

export const cpSlice = (s, cpBegin, cpEnd) => [...s].slice(cpBegin, cpEnd).join('');

// Converts from seconds (float) to a nicely formatted timestamp (string).
//
// The timestamp will look like this: "hh:mm:ss", but will omit unneeded digits.
// For example, if the input is 61 second, the timestamp will be "1:01".
export const secondsToTimestamp = (seconds) => {
  const hrs = Math.floor(seconds / (60*60));
  seconds -= hrs * 60 * 60;
  const mnts = Math.floor(seconds / 60);
  seconds -= mnts * 60;
  const secs = Math.floor(seconds);

  var time_stamp = "";
  if (hrs > 0) {
    time_stamp += hrs + ":";
    time_stamp += ("00" + mnts).slice(-2) + ":";
  } else {
    time_stamp += mnts + ":";
  }
  time_stamp += ("00" + secs).slice(-2);

  return time_stamp;
}