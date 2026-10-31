/**
 * Widget ve ayarlar pencerelerinin preload betiği.
 * Arayüz Node.js'e erişemez; yalnızca burada tanımlanan `window.mirilti` API'sini kullanır.
 * Her işlev tek bir IPC kanalına karşılık gelir (kanal adları shared/ipc.ts'de).
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type MiriltiApi } from '../shared/ipc'

/** Bir kanala abone ol; aboneliği iptal eden fonksiyonu döndür (React useEffect temizliği için) */
function subscribe<T>(channel: string, cb: (value: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, value: T): void => cb(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: MiriltiApi = {
  command: (cmd) => ipcRenderer.invoke(IPC.playerCommand, cmd),
  getState: () => ipcRenderer.invoke(IPC.playerGetState),
  onState: (cb) => subscribe(IPC.playerState, cb),
  onQueue: (cb) => subscribe(IPC.playerQueue, cb),
  onPalette: (cb) => subscribe(IPC.playerPalette, cb),
  getLyrics: (track) => ipcRenderer.invoke(IPC.lyricsGet, track),

  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSettings: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
  resetSettings: () => ipcRenderer.invoke(IPC.settingsReset),
  exportSettings: () => ipcRenderer.invoke(IPC.settingsExport),
  importSettings: () => ipcRenderer.invoke(IPC.settingsImport),
  onSettings: (cb) => subscribe(IPC.settingsChanged, cb),
  getSystemInfo: () => ipcRenderer.invoke(IPC.systemInfo),

  getLayout: () => ipcRenderer.invoke(IPC.widgetGetLayout),
  onLayout: (cb) => subscribe(IPC.widgetLayout, cb),
  setIgnoreMouse: (ignore) => ipcRenderer.send(IPC.widgetSetIgnoreMouse, ignore),
  setView: (view) => ipcRenderer.send(IPC.widgetSetView, view),
  onToggle: (cb) => subscribe(IPC.widgetToggle, () => cb()),
  onPinOpen: (cb) => subscribe(IPC.widgetPinOpen, cb),
  dragStart: () => ipcRenderer.send(IPC.widgetDragStart),
  dragMove: () => ipcRenderer.send(IPC.widgetDragMove),
  dragEnd: () => ipcRenderer.send(IPC.widgetDragEnd),

  openSettings: () => ipcRenderer.send(IPC.appOpenSettings),
  openLogin: () => ipcRenderer.send(IPC.appOpenLogin),
  openPlayer: () => ipcRenderer.send(IPC.appOpenPlayer),
  reloadPlayer: () => ipcRenderer.send(IPC.appReloadPlayer)
}

contextBridge.exposeInMainWorld('mirilti', api)
