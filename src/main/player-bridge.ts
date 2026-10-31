/**
 * Oynatıcı köprüsü: YouTube Music sayfası ile arayüz pencereleri arasındaki santral.
 *
 *  - Sayfadan gelen durum parçalarını birleştirip önbellekte tutar (yeni açılan pencere
 *    hemen son durumu alır).
 *  - Arayüzden gelen komutları doğrular, sayfaya iletir ve yanıtı bekler (zaman aşımıyla).
 *  - Şarkı değişimi gibi olayları diğer modüllere (renk, bildirim, tepsi) duyurur.
 */
import { EventEmitter } from 'node:events'
import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { IPC, type PlayerCommand, type Result } from '../shared/ipc'
import { initialPlayerState, type PlayerState, type QueueItem, type TrackInfo } from '../shared/types'
import { getPlayerWindow, playerEvents } from './windows/player'

let state: PlayerState = { ...initialPlayerState }
let queue: QueueItem[] = []

/** 'state' (PlayerState), 'track' (TrackInfo | null, önceki) olayları */
export const bridgeEvents = new EventEmitter()

interface Pending {
  resolve(res: Result<unknown>): void
  timer: NodeJS.Timeout
}
const pending = new Map<number, Pending>()
let seq = 0

export function getPlayerState(): PlayerState {
  return state
}

/** Oynatıcı penceresi hariç tüm pencerelere (widget, ayarlar) mesaj gönder */
export function broadcast(channel: string, ...args: unknown[]): void {
  const player = getPlayerWindow()
  for (const win of BrowserWindow.getAllWindows()) {
    if (win !== player && !win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

function applyState(partial: Partial<PlayerState>): void {
  const prevTrack = state.track
  state = { ...state, ...partial }
  broadcast(IPC.playerState, state)
  bridgeEvents.emit('state', state)
  if (prevTrack?.videoId !== state.track?.videoId || prevTrack?.coverUrl !== state.track?.coverUrl) {
    bridgeEvents.emit('track', state.track, prevTrack)
  }
}

/** Mesaj gerçekten gizli YouTube Music penceresinden mi geldi? */
function fromPlayer(e: IpcMainEvent): boolean {
  const player = getPlayerWindow()
  return !!player && e.sender === player.webContents
}

export function initPlayerBridge(): void {
  ipcMain.on(IPC.ytmState, (e, partial: unknown) => {
    if (!fromPlayer(e) || !partial || typeof partial !== 'object') return
    applyState(sanitizeState(partial as Partial<PlayerState>))
  })

  ipcMain.on(IPC.ytmQueue, (e, q: unknown) => {
    if (!fromPlayer(e) || !Array.isArray(q)) return
    queue = q as QueueItem[]
    broadcast(IPC.playerQueue, queue)
  })

  ipcMain.on(IPC.ytmResult, (e, id: number, res: Result<unknown>) => {
    if (!fromPlayer(e)) return
    const p = pending.get(id)
    if (!p) return
    clearTimeout(p.timer)
    pending.delete(id)
    p.resolve(res)
  })

  ipcMain.handle(IPC.playerGetState, () => state)

  ipcMain.handle(IPC.playerCommand, (_e: IpcMainInvokeEvent, raw: unknown) => {
    const cmd = validateCommand(raw)
    if (!cmd) return { ok: false, error: 'Geçersiz komut' } satisfies Result<never>
    return sendCommand(cmd)
  })

  // Sayfa yükleme / bağlantı olayları
  playerEvents.on('loading', () => {
    if (state.connection !== 'offline') applyState({ connection: 'loading' })
  })
  playerEvents.on('offline', () => applyState({ connection: 'offline', isPlaying: false }))
}

/** Komutu sayfaya gönder ve sonucu bekle. Hiçbir durumda reddetmez; hata Result olarak döner. */
export function sendCommand(cmd: PlayerCommand): Promise<Result<unknown>> {
  const win = getPlayerWindow()
  if (!win) return Promise.resolve({ ok: false, error: 'Oynatıcı hazır değil' })
  const id = ++seq
  // Ağ isteği yapan komutlara daha uzun süre tanı
  const slow = cmd.type === 'search' || cmd.type === 'getLibrary' || cmd.type === 'getLyrics' || cmd.type === 'addToQueue'
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      resolve({
        ok: false,
        error: state.connection === 'offline' ? 'İnternet bağlantısı yok' : 'Oynatıcı yanıt vermedi'
      })
    }, slow ? 15000 : 5000)
    pending.set(id, { resolve, timer })
    win.webContents.send(IPC.ytmCommand, id, cmd)
  })
}

/** Arayüzden gelen komutu doğrula: bilinmeyen tür ya da hatalı argüman → null */
function validateCommand(raw: unknown): PlayerCommand | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
  const target = (v: unknown): boolean => {
    if (!v || typeof v !== 'object') return false
    const t = v as Record<string, unknown>
    return (t.videoId === undefined || str(t.videoId, 64)) && (t.playlistId === undefined || str(t.playlistId, 128)) && !!(t.videoId || t.playlistId)
  }
  switch (c.type) {
    case 'play': case 'pause': case 'togglePlay': case 'next': case 'previous':
    case 'toggleMute': case 'like': case 'dislike': case 'shuffle': case 'cycleRepeat':
    case 'getQueue': case 'getLibrary':
      return { type: c.type }
    case 'seek':
      return num(c.seconds) ? { type: 'seek', seconds: Math.max(0, c.seconds) } : null
    case 'setVolume':
      return num(c.volume) ? { type: 'setVolume', volume: c.volume } : null
    case 'playQueueIndex':
      return num(c.index) ? { type: 'playQueueIndex', index: Math.floor(c.index) } : null
    case 'search':
      return str(c.query, 200) ? { type: 'search', query: c.query } : null
    case 'getLyrics':
      return str(c.videoId, 64) ? { type: 'getLyrics', videoId: c.videoId } : null
    case 'playTarget':
    case 'addToQueue':
      return target(c.target) ? { type: c.type, target: c.target as { videoId?: string; playlistId?: string } } : null
    default:
      return null
  }
}

/** Sayfadan gelen veriye körü körüne güvenme: yalnızca bilinen alanları al */
function sanitizeState(p: Partial<PlayerState>): Partial<PlayerState> {
  const out: Partial<PlayerState> = {}
  if (p.connection === 'ready' || p.connection === 'offline' || p.connection === 'loading') out.connection = p.connection
  if (typeof p.loggedIn === 'boolean' || p.loggedIn === null) out.loggedIn = p.loggedIn
  if (p.track === null || isTrack(p.track)) out.track = p.track ?? null
  if (typeof p.isPlaying === 'boolean') out.isPlaying = p.isPlaying
  if (typeof p.adPlaying === 'boolean') out.adPlaying = p.adPlaying
  if (typeof p.position === 'number') out.position = p.position
  if (typeof p.positionAt === 'number') out.positionAt = p.positionAt
  if (typeof p.playbackRate === 'number') out.playbackRate = p.playbackRate
  if (typeof p.volume === 'number') out.volume = p.volume
  if (typeof p.muted === 'boolean') out.muted = p.muted
  if (p.likeStatus === 'LIKE' || p.likeStatus === 'DISLIKE' || p.likeStatus === 'INDIFFERENT') out.likeStatus = p.likeStatus
  if (p.repeat === 'NONE' || p.repeat === 'ALL' || p.repeat === 'ONE') out.repeat = p.repeat
  if (Array.isArray(p.adapterIssues)) out.adapterIssues = p.adapterIssues.filter((s) => typeof s === 'string')
  return out
}

function isTrack(t: unknown): t is TrackInfo {
  if (!t || typeof t !== 'object') return false
  const x = t as Record<string, unknown>
  return typeof x.title === 'string' && typeof x.artist === 'string' && typeof x.coverUrl === 'string'
}
