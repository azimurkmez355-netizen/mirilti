/**
 * Sistem tepsisi simgesi ve menüsü.
 * Menü, çalma durumu değiştikçe (Oynat ↔ Duraklat, şarkı adı) yeniden kurulur.
 */
import { Menu, Tray, nativeImage } from 'electron'
import type { PlayerState } from '../shared/types'
import { resourcePath } from './paths'

export interface TrayActions {
  togglePlay(): void
  next(): void
  previous(): void
  toggleWidget(): void
  isWidgetVisible(): boolean
  openSettings(): void
  openPlayer(): void
  openLogin(): void
  quit(): void
}

let tray: Tray | null = null
let actions: TrayActions
let lastKey = ''
let lastState: PlayerState | null = null

export function createTray(a: TrayActions): Tray {
  actions = a
  // tray.png + tray@2x.png: Electron ekran ölçeğine göre uygun olanı seçer
  const icon = nativeImage.createFromPath(resourcePath('tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('Mırıltı')
  // Sol tık: widget'ı göster/gizle
  tray.on('click', () => actions.toggleWidget())
  rebuildMenu(null)
  return tray
}

/** Oynatıcı durumu değişince çağrılır; yalnızca menüyü etkileyen alanlar değişirse menüyü yeniler */
export function updateTray(state: PlayerState): void {
  if (!tray) return
  lastState = state
  const key = `${state.isPlaying}|${state.track?.videoId}|${state.loggedIn}`
  if (key === lastKey) return
  lastKey = key
  const title = state.track ? `${state.track.title} — ${state.track.artist}` : 'Mırıltı'
  // Windows araç ipucu en fazla 127 karakter
  tray.setToolTip(title.length > 120 ? `${title.slice(0, 117)}…` : title)
  rebuildMenu(state)
}

/** Widget görünürlüğü değişince menüdeki etiketi tazele */
export function refreshTrayMenu(): void {
  rebuildMenu(lastState)
}

function rebuildMenu(state: PlayerState | null): void {
  if (!tray) return
  const playing = state?.isPlaying ?? false
  const menu = Menu.buildFromTemplate([
    ...(state?.track
      ? [{ label: truncate(`${state.track.title} — ${state.track.artist}`, 48), enabled: false }, { type: 'separator' as const }]
      : []),
    { label: playing ? 'Duraklat' : 'Oynat', click: () => actions.togglePlay() },
    { label: 'Sonraki', click: () => actions.next() },
    { label: 'Önceki', click: () => actions.previous() },
    { type: 'separator' },
    {
      label: "Widget'ı göster",
      type: 'checkbox',
      checked: actions.isWidgetVisible(),
      click: () => actions.toggleWidget()
    },
    { label: 'Ayarlar', click: () => actions.openSettings() },
    { label: 'YouTube Music penceresini aç', click: () => actions.openPlayer() },
    ...(state?.loggedIn === false ? [{ label: 'Google ile giriş yap', click: () => actions.openLogin() }] : []),
    { type: 'separator' },
    { label: 'Çıkış', click: () => actions.quit() }
  ])
  tray.setContextMenu(menu)
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
