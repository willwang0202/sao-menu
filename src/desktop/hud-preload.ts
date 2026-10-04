import { contextBridge, ipcRenderer } from 'electron';
import type { HpAPI, HpState } from '../shared/hud';
const api: HpAPI = {
  setWidth: width => ipcRenderer.invoke('sao:hp:width', width),
  getState: () => ipcRenderer.invoke('sao:hp:state'),
  onState: callback => {
    const listener = (_event: Electron.IpcRendererEvent, state: HpState) => callback(state);
    ipcRenderer.on('sao:hp:update', listener);
    return () => ipcRenderer.removeListener('sao:hp:update', listener);
  },
};
contextBridge.exposeInMainWorld('saoHP', Object.freeze(api));
