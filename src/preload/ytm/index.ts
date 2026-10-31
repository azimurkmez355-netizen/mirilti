/**
 * YouTube Music sayfasının preload betiği (izole dünya).
 *
 * contextIsolation açık olduğu için bu betik sayfanın JS nesnelerine erişemez; sadece
 * `window.__mirilti` adında küçük bir köprü açar. Sayfanın kendi dünyasında çalışan
 * ytm-adapter.ts bu köprüyü kullanarak durumu gönderir ve komut alır.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type PlayerCommand, type Result } from '../../shared/ipc'
import type { PlayerState, QueueItem } from '../../shared/types'

contextBridge.exposeInMainWorld('__mirilti', {
  emitState(state: Partial<PlayerState>): void {
    ipcRenderer.send(IPC.ytmState, state)
  },
  emitQueue(queue: QueueItem[]): void {
    ipcRenderer.send(IPC.ytmQueue, queue)
  },
  onCommand(cb: (id: number, cmd: PlayerCommand) => void): void {
    // Adaptör yalnızca bir kez abone olur; yine de eski dinleyicileri temizle.
    ipcRenderer.removeAllListeners(IPC.ytmCommand)
    ipcRenderer.on(IPC.ytmCommand, (_e, id: number, cmd: PlayerCommand) => cb(id, cmd))
  },
  result(id: number, res: Result<unknown>): void {
    ipcRenderer.send(IPC.ytmResult, id, res)
  }
})
