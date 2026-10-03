import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { SurfaceAPI } from '../shared/surfaces';
const observe = (channel: string, callback: (value: any) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, value: unknown) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
const api: SurfaceAPI = {
  getState: () => ipcRenderer.invoke('sao:surface:state'),
  navigate: url => ipcRenderer.invoke('sao:surface:navigate', url),
  command: command => ipcRenderer.invoke('sao:surface:command', command),
  dropFiles: files => ipcRenderer.invoke('sao:surface:drop', files.map(file => webUtils.getPathForFile(file))),
  setPresentation: presentation => ipcRenderer.invoke('sao:surface:presentation', presentation),
  setGallery: settings => ipcRenderer.invoke('sao:surface:gallery', settings),
  input: input => ipcRenderer.invoke('sao:surface:input', input),
  resize: (width, height) => ipcRenderer.invoke('sao:surface:resize', width, height),
  move: (dx, dy) => ipcRenderer.invoke('sao:surface:move', dx, dy),
  onState: callback => observe('sao:surface:state', callback),
  onFrame: callback => observe('sao:surface:frame', callback),
  onPointer: callback => observe('sao:surface:pointer', callback),
};
contextBridge.exposeInMainWorld('saoSurface', Object.freeze(api));
