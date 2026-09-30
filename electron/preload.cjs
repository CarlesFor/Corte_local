const { contextBridge, ipcRenderer, webUtils } = require('electron');
const invoke = (name, ...args) => ipcRenderer.invoke(`corte:${name}`, ...args);
contextBridge.exposeInMainWorld('corte', {
  status: () => invoke('status'), importMedia: paths => invoke('importMedia', paths), pathForFile: file => webUtils.getPathForFile(file),
  openProject: path => invoke('openProject', path), saveProject: (p, path, portable) => invoke('saveProject', p, path, portable),
  autosave: p => invoke('autosave', p), clearRecovery: () => invoke('clearRecovery'),
  exportVideo: (p, options) => invoke('exportVideo', p, options), renderPreview: (p, start, end) => invoke('renderPreview', p, start, end),
  transcribe: (p, model, tracks, start, end) => invoke('transcribe', p, model, tracks, start, end),
  installWhisper: () => invoke('installWhisper'), downloadModel: model => invoke('downloadModel', model), cancelJob: id => invoke('cancelJob', id),
  onJob: callback => { const handler = (_event, job) => callback(job); ipcRenderer.on('corte:job', handler); return () => ipcRenderer.removeListener('corte:job', handler); },
  importCaptions: () => invoke('importCaptions'), exportCaptions: (p, format) => invoke('exportCaptions', p, format),
  addFont: () => invoke('addFont'), savePreset: (name, style) => invoke('savePreset', name, style),
  relink: (p, id) => invoke('relink', p, id), reveal: path => invoke('reveal', path), clearCache: () => invoke('clearCache')
});
