import { contextBridge, ipcRenderer } from 'electron';
import type { TrackerAPI, TrackerConfig } from '../shared/hand/protocol';

// The tracker page can only report gesture events and receive its frame-rate
// configuration. It has no other channel into the main process.
const api: TrackerAPI = {
  emit: event => ipcRenderer.send('sao:tracker:event', event),
  onConfig: callback => {
    const listener = (_event: Electron.IpcRendererEvent, config: TrackerConfig) => callback(config);
    ipcRenderer.on('sao:tracker:config', listener);
    return () => ipcRenderer.removeListener('sao:tracker:config', listener);
  },
};
contextBridge.exposeInMainWorld('saoTracker', Object.freeze(api));
