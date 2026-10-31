/**
 * Ayarların kalıcı deposu (electron-store) ve değişiklik yayını.
 * Diğer modüller `onSettingsChange` ile abone olur; böylece ayar ekranındaki
 * her değişiklik anında (canlı önizleme) uygulanır.
 */
import { EventEmitter } from 'node:events'
import Store from 'electron-store'
import { defaultSettings, mergeSettings, type Settings, type SettingsPatch } from '../shared/settings'

const store = new Store<{ settings: Settings }>({
  name: 'config',
  defaults: { settings: defaultSettings }
})

const events = new EventEmitter()

// Eski sürümden kalan / eksik anahtarlar varsayılanlarla tamamlanır.
let current: Settings = mergeSettings(defaultSettings, store.get('settings'))

export function getSettings(): Settings {
  return current
}

/** Kısmi değişikliği uygular, diske yazar ve abonelere (önceki değerle) bildirir */
export function updateSettings(patch: SettingsPatch): Settings {
  const previous = current
  current = mergeSettings(current, patch)
  scheduleSave()
  events.emit('change', current, previous)
  return current
}

// Kaydırıcı sürüklenirken her adımda diske yazmamak için kısa gecikmeli kayıt
let saveTimer: NodeJS.Timeout | null = null
function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(flushSettings, 400)
}

/** Bekleyen kaydı hemen yaz (uygulama kapanırken çağrılır) */
export function flushSettings(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  store.set('settings', current)
}

/** Tüm ayarları değiştirir (sıfırlama / içe aktarma) */
export function replaceSettings(next: unknown): Settings {
  const previous = current
  current = mergeSettings(defaultSettings, next)
  flushSettings()
  events.emit('change', current, previous)
  return current
}

export function onSettingsChange(cb: (next: Settings, previous: Settings) => void): void {
  events.on('change', cb)
}

/** Ayarlar dışında küçük uygulama durumları (ör. ilk açılış yapıldı mı) */
const stateStore = new Store<{ hasLoggedInOnce: boolean }>({
  name: 'state',
  defaults: { hasLoggedInOnce: false }
})

export const appState = {
  get hasLoggedInOnce(): boolean {
    return stateStore.get('hasLoggedInOnce')
  },
  set hasLoggedInOnce(value: boolean) {
    stateStore.set('hasLoggedInOnce', value)
  }
}
