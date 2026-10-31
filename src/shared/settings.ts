/**
 * Ayar şeması ve varsayılan değerler.
 * electron-store bu nesneyi diske (%APPDATA%/Mırıltı/config.json) yazar.
 */

export type DockMode =
  | 'edge-right'
  | 'edge-left'
  | 'edge-top'
  | 'edge-bottom'
  | 'corner-top-left'
  | 'corner-top-right'
  | 'corner-bottom-left'
  | 'corner-bottom-right'
  | 'floating'

export type SizePreset = 'small' | 'medium' | 'large'
export type AccentMode = 'cover' | 'fixed'
export type ColorScheme = 'dark' | 'light'
export type LoginAgent = 'chrome' | 'firefox'

export interface ShortcutSettings {
  toggleWidget: string
  playPause: string
  next: string
  previous: string
  like: string
  volumeUp: string
  volumeDown: string
}

export interface Settings {
  position: {
    mode: DockMode
    /** Kenar boyunca konum, 0 (baş) – 1 (son) */
    edgeOffset: number
    /** Yüzen modda konum, çalışma alanına oranla (0-1). Çözünürlük değişse de bozulmaz. */
    floatX: number
    floatY: number
    /** Hangi monitör (Electron display id). null = birincil ekran */
    displayId: number | null
  }
  trigger: {
    hover: boolean
    click: boolean
    hotkey: boolean
    /** ms */
    openDelay: number
    closeDelay: number
  }
  behavior: {
    autoHideFullscreen: boolean
    notifications: boolean
    autoStart: boolean
    /** Medya tuşlarını ayrıca global kısayol olarak yakala (normalde Windows zaten iletir) */
    captureMediaKeys: boolean
    loginAgent: LoginAgent
  }
  appearance: {
    size: SizePreset
    /** Ek ölçek çarpanı (0.7 – 1.6) */
    scale: number
    /** px */
    radius: number
    /** Arka plan opaklığı 0.3 – 1 */
    opacity: number
    /** Bulanıklık px */
    blur: number
    accentMode: AccentMode
    fixedAccent: string
    colorScheme: ColorScheme
    /** Windows 11 yerel Acrylic malzemesi */
    nativeMaterial: boolean
    /** 0 = animasyon yok, 1 = normal, 2 = iki kat hızlı */
    animationSpeed: number
  }
  sections: {
    album: boolean
    like: boolean
    shuffleRepeat: boolean
    volume: boolean
    lyrics: boolean
    queue: boolean
    search: boolean
    library: boolean
  }
  shortcuts: ShortcutSettings
}

export const defaultSettings: Settings = {
  position: {
    mode: 'edge-right',
    edgeOffset: 0.5,
    floatX: 0.85,
    floatY: 0.2,
    displayId: null
  },
  trigger: {
    hover: true,
    click: true,
    hotkey: true,
    openDelay: 120,
    closeDelay: 450
  },
  behavior: {
    autoHideFullscreen: true,
    notifications: false,
    autoStart: false,
    captureMediaKeys: false,
    loginAgent: 'chrome'
  },
  appearance: {
    size: 'medium',
    scale: 1,
    radius: 18,
    opacity: 0.82,
    blur: 28,
    accentMode: 'cover',
    fixedAccent: '#8b5cf6',
    colorScheme: 'dark',
    nativeMaterial: false,
    animationSpeed: 1
  },
  sections: {
    album: true,
    like: true,
    shuffleRepeat: true,
    volume: true,
    lyrics: true,
    queue: true,
    search: true,
    library: true
  },
  shortcuts: {
    toggleWidget: 'Alt+Shift+M',
    playPause: 'Alt+Shift+P',
    next: 'Alt+Shift+Right',
    previous: 'Alt+Shift+Left',
    like: 'Alt+Shift+L',
    volumeUp: 'Alt+Shift+Up',
    volumeDown: 'Alt+Shift+Down'
  }
}

/** Boyut önayarlarının ölçek karşılıkları */
export const sizeScale: Record<SizePreset, number> = {
  small: 0.85,
  medium: 1,
  large: 1.2
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }
export type SettingsPatch = DeepPartial<Settings>

/**
 * Dışarıdan gelen (içe aktarılan / eski sürüm) ayarları varsayılanlarla birleştirir.
 * Bilinmeyen anahtarlar atılır, tipi yanlış olan değerler varsayılana döner.
 */
export function mergeSettings(base: Settings, patch: unknown): Settings {
  return mergeInto(base, patch) as Settings
}

/** null değer alabilen (sayı | null) alanlar */
const NULLABLE_NUMBER_KEYS = new Set(['displayId'])

function mergeInto(base: unknown, patch: unknown, key = ''): unknown {
  if (patch === undefined) return base
  if (NULLABLE_NUMBER_KEYS.has(key)) {
    return patch === null || (typeof patch === 'number' && Number.isFinite(patch)) ? patch : base
  }
  if (base !== null && typeof base === 'object' && !Array.isArray(base)) {
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return base
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(base)) {
      out[k] = mergeInto((base as Record<string, unknown>)[k], (patch as Record<string, unknown>)[k], k)
    }
    return out
  }
  if (typeof base === 'number') return typeof patch === 'number' && Number.isFinite(patch) ? patch : base
  return typeof patch === typeof base ? patch : base
}
