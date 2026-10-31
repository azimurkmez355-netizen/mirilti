/**
 * Küçük sistem entegrasyonları: şarkı değişince bildirim, Windows açılışında başlatma.
 */
import { app, nativeImage, net, Notification } from 'electron'
import type { PlayerState } from '../shared/types'
import { bridgeEvents } from './player-bridge'
import { getSettings, onSettingsChange } from './store'

// --- Bildirimler ---

let lastNotified = ''

/** Her durum güncellemesinde çağrılır: yeni bir şarkı gerçekten çalmaya başlayınca bir kez bildirir */
async function maybeNotify(state: PlayerState): Promise<void> {
  const track = state.track
  if (!track?.videoId || track.videoId === lastNotified || !state.isPlaying || state.adPlaying) return
  lastNotified = track.videoId
  if (!getSettings().behavior.notifications || !Notification.isSupported()) return

  let icon: Electron.NativeImage | undefined
  try {
    const res = await net.fetch(track.coverUrl.replace(/=w\d+-h\d+[^/]*$/, '=w120-h120-l90-rj'), {
      signal: AbortSignal.timeout(4000)
    })
    if (res.ok) icon = nativeImage.createFromBuffer(Buffer.from(await res.arrayBuffer()))
  } catch {
    /* kapaksız bildirim de olur */
  }
  new Notification({
    title: track.title,
    body: [track.artist, track.album].filter(Boolean).join(' — '),
    icon,
    silent: true
  }).show()
}

// --- Otomatik başlatma ---

function applyAutoStart(enabled: boolean): void {
  // Geliştirme modunda electron.exe'yi başlangıca eklememek için yalnızca kurulu sürümde
  if (!app.isPackaged) return
  app.setLoginItemSettings({ openAtLogin: enabled })
}

export function initSystemIntegration(): void {
  bridgeEvents.on('state', (state: PlayerState) => void maybeNotify(state))
  applyAutoStart(getSettings().behavior.autoStart)
  onSettingsChange((next, prev) => {
    if (next.behavior.autoStart !== prev.behavior.autoStart) applyAutoStart(next.behavior.autoStart)
  })
}
