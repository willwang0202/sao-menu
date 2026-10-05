import { contextBridge, ipcRenderer } from 'electron';
import type { WidgetAPI, WidgetState } from '../shared/widgets';
const api: WidgetAPI = {
  getState: () => ipcRenderer.invoke('sao:widget:state'),
  openMessages: () => ipcRenderer.invoke('sao:widget:messages'),
  answerInvitation: (id, answer) => ipcRenderer.invoke('sao:widget:answer', id, answer),
  onState: callback => {
    const listener = (_event: Electron.IpcRendererEvent, state: WidgetState) => callback(state);
    ipcRenderer.on('sao:widget:update', listener);
    return () => ipcRenderer.removeListener('sao:widget:update', listener);
  },
};
contextBridge.exposeInMainWorld('saoWidget', Object.freeze(api));
