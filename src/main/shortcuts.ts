/**
 * Global kısayollar (her uygulamanın içindeyken çalışır).
 * Ayarlar değişince hepsi kaldırılıp yeniden kaydedilir; kaydedilemeyenler (başka bir
 * uygulama kullanıyorsa) ayarlar ekranında uyarı olarak gösterilir.
 *
 * Medya tuşları (⏯ ⏭ ⏮) varsayılan olarak burada KAYDEDİLMEZ: gizli oynatıcıdaki Chromium,
 * Windows medya kontrolleri (SMTC) üzerinden bu tuşları zaten alır. İkisini birden açmak
 * bir tuşa basınca iki kez tetiklenmeye yol açar. Bu yüzden ayrı bir ayar.
 */
import { app, globalShortcut } from 'electron'
import type { Settings } from '../shared/settings'
import { getPlayerState, sendCommand } from './player-bridge'
import { setShortcutErrors } from './settings-ipc'
import { getSettings, onSettingsChange } from './store'
import { toggleWidgetOpen } from './windows/widget'

const VOLUME_STEP = 5

function changeVolume(delta: number): void {
  const v = Math.max(0, Math.min(100, getPlayerState().volume + delta))
  void sendCommand({ type: 'setVolume', volume: v })
}

function register(settings: Settings): void {
  globalShortcut.unregisterAll()
  const s = settings.shortcuts
  const bindings: [string, () => void][] = [
    [settings.trigger.hotkey ? s.toggleWidget : '', toggleWidgetOpen],
    [s.playPause, () => void sendCommand({ type: 'togglePlay' })],
    [s.next, () => void sendCommand({ type: 'next' })],
    [s.previous, () => void sendCommand({ type: 'previous' })],
    [s.like, () => void sendCommand({ type: 'like' })],
    [s.volumeUp, () => changeVolume(VOLUME_STEP)],
    [s.volumeDown, () => changeVolume(-VOLUME_STEP)]
  ]
  if (settings.behavior.captureMediaKeys) {
    bindings.push(
      ['MediaPlayPause', () => void sendCommand({ type: 'togglePlay' })],
      ['MediaNextTrack', () => void sendCommand({ type: 'next' })],
      ['MediaPreviousTrack', () => void sendCommand({ type: 'previous' })]
    )
  }

  const errors: string[] = []
  const used = new Set<string>()
  for (const [accel, fn] of bindings) {
    if (!accel) continue
    if (used.has(accel)) {
      errors.push(`${accel} (iki kez atanmış)`)
      continue
    }
    used.add(accel)
    try {
      if (!globalShortcut.register(accel, fn)) errors.push(accel)
    } catch {
      // Geçersiz tuş adı
      errors.push(accel)
    }
  }
  setShortcutErrors(errors)
  if (errors.length) console.warn('[shortcuts] kaydedilemedi:', errors.join(', '))
}

export function initShortcuts(): void {
  register(getSettings())
  onSettingsChange((next, prev) => {
    if (
      JSON.stringify(next.shortcuts) !== JSON.stringify(prev.shortcuts) ||
      next.trigger.hotkey !== prev.trigger.hotkey ||
      next.behavior.captureMediaKeys !== prev.behavior.captureMediaKeys
    ) {
      register(next)
    }
  })
  app.on('will-quit', () => globalShortcut.unregisterAll())
}
