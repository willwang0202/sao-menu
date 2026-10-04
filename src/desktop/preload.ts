import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { DesktopAPI, HandCursor, Position } from '../shared/contracts';
import type { SocialAPI } from '../shared/social';

// Every operation has its own channel. The renderer never receives ipcRenderer,
// filesystem access, process access, or an unrestricted shell command bridge.
const api: DesktopAPI = {
  getRuntime: () => ipcRenderer.invoke('sao:runtime'),
  getGestureStatus: () => ipcRenderer.invoke('sao:gesture:status'),
  requestGesturePermission: () => ipcRenderer.invoke('sao:gesture:request'),
  getMenuAnchor: () => ipcRenderer.invoke('sao:menu:anchor'),
  setPointerPassthrough: enabled => ipcRenderer.invoke('sao:pointer:passthrough', enabled),
  getSettings: () => ipcRenderer.invoke('sao:settings:get'),
  saveSettings: settings => ipcRenderer.invoke('sao:settings:save', settings),
  getSystemStats: () => ipcRenderer.invoke('sao:system'),
  listApplications: () => ipcRenderer.invoke('sao:applications'),
  listDirectory: target => ipcRenderer.invoke('sao:directory', target),
  launch: item => ipcRenderer.invoke('sao:launch', item),
  pickLauncher: kind => ipcRenderer.invoke('sao:launcher:pick', kind),
  importConfiguration: () => ipcRenderer.invoke('sao:configuration:import'),
  exportConfiguration: () => ipcRenderer.invoke('sao:configuration:export'),
  hide: () => ipcRenderer.invoke('sao:hide'),
  quit: () => ipcRenderer.invoke('sao:quit'),
  completeStartup: () => ipcRenderer.invoke('sao:startup:complete'),
  onStartupComplete: callback => {
    const listener = () => callback(); ipcRenderer.on('sao:startup:done', listener);
    return () => ipcRenderer.removeListener('sao:startup:done', listener);
  },
  openBrowser: () => ipcRenderer.invoke('sao:browser:open'),
  openMedia: () => ipcRenderer.invoke('sao:media:open'),
  openGallery: () => ipcRenderer.invoke('sao:gallery:open'),
  dropFiles: files => ipcRenderer.invoke('sao:media:drop', files.map(file => webUtils.getPathForFile(file))),
  onDismissMenu: callback => {
    const listener = () => callback();
    ipcRenderer.on('sao:menu:dismiss', listener);
    return () => ipcRenderer.removeListener('sao:menu:dismiss', listener);
  },
  onGlobalPointerDown: callback => {
    const listener = (_event: Electron.IpcRendererEvent, point: Position) => callback(point);
    ipcRenderer.on('sao:pointer:down', listener);
    return () => ipcRenderer.removeListener('sao:pointer:down', listener);
  },
  onPointerMove: callback => {
    const listener = (_event: Electron.IpcRendererEvent, point: Position) => callback(point);
    ipcRenderer.on('sao:pointer:move', listener);
    return () => ipcRenderer.removeListener('sao:pointer:move', listener);
  },
  getHandTrackingStatus: () => ipcRenderer.invoke('sao:hand:status'),
  onHandCursor: callback => {
    const listener = (_event: Electron.IpcRendererEvent, cursor: HandCursor) => callback(cursor);
    ipcRenderer.on('sao:hand:cursor', listener);
    return () => ipcRenderer.removeListener('sao:hand:cursor', listener);
  },
  onHandClick: callback => {
    const listener = (_event: Electron.IpcRendererEvent, point: Position) => callback(point);
    ipcRenderer.on('sao:hand:click', listener);
    return () => ipcRenderer.removeListener('sao:hand:click', listener);
  },
  onToggleMenu: callback => {
    const listener = (_event: Electron.IpcRendererEvent, open?: boolean, anchor?: Position) => callback(open, anchor);
    ipcRenderer.on('sao:menu:toggle', listener);
    return () => ipcRenderer.removeListener('sao:menu:toggle', listener);
  },
};

contextBridge.exposeInMainWorld('sao', Object.freeze(api));
const social: SocialAPI = {
  getState: () => ipcRenderer.invoke('sao:social:state'),
  authenticate: input => ipcRenderer.invoke('sao:social:authenticate', input),
  logout: () => ipcRenderer.invoke('sao:social:logout'),
  requestFriend: username => ipcRenderer.invoke('sao:social:request', username),
  resolveRequest: (id, action) => ipcRenderer.invoke('sao:social:resolve', id, action),
  removeFriend: id => ipcRenderer.invoke('sao:social:remove', id),
  inviteParty: peer => ipcRenderer.invoke('sao:social:party:invite', peer),
  resolveParty: (id, action) => ipcRenderer.invoke('sao:social:party:resolve', id, action),
  leaveParty: () => ipcRenderer.invoke('sao:social:party:leave'),
  getMessages: peer => ipcRenderer.invoke('sao:social:messages', peer),
  sendMessage: (peer, text) => ipcRenderer.invoke('sao:social:send', peer, text),
  markRead: peer => ipcRenderer.invoke('sao:social:read', peer),
  onState: callback => {
    const listener = (_event: Electron.IpcRendererEvent, state: Parameters<Parameters<SocialAPI['onState']>[0]>[0]) => callback(state);
    ipcRenderer.on('sao:social:state', listener); return () => ipcRenderer.removeListener('sao:social:state', listener);
  },
};
contextBridge.exposeInMainWorld('saoSocial', Object.freeze(social));
