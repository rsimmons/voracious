export function downloadFile(content, filename, contentType) {
  const a = document.createElement('a');
  const blob = new Blob([content], {'type': contentType});
  a.href = window.URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
