/**
 * IPC kanal adları ve mesaj tipleri — tek kaynak.
 * Kanal adını değiştirmek gerekirse yalnızca burayı düzenlemek yeterli.
 */
import type {
  CoverPalette,
  LibraryPlaylist,
  Lyrics,
  PlayerState,
  PlayTarget,
  QueueItem,
  SearchSection,
  WidgetLayout,
  WidgetView
} from './types'
import type { Settings, SettingsPatch } from './settings'

export const IPC = {
  // --- YouTube Music sayfası <-> ana süreç ---
  /** Sayfa -> ana: oynatıcı durumunun değişen kısmı */
  ytmState: 'ytm:state',
  /** Sayfa -> ana: sıra listesi değişti */
  ytmQueue: 'ytm:queue',
  /** Ana -> sayfa: komut çalıştır */
  ytmCommand: 'ytm:command',
  /** Sayfa -> ana: komut sonucu */
  ytmResult: 'ytm:result',

  // --- Arayüz pencereleri <-> ana süreç ---
  /** invoke: komut gönder, sonucu bekle */
  playerCommand: 'player:command',
  /** invoke: önbellekteki son durum */
  playerGetState: 'player:get-state',
  /** ana -> arayüz */
  playerState: 'player:state',
  playerQueue: 'player:queue',
  playerPalette: 'player:palette',

  lyricsGet: 'lyrics:get',

  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  settingsReset: 'settings:reset',
  settingsExport: 'settings:export',
  settingsImport: 'settings:import',
  settingsChanged: 'settings:changed',
  /** Ayarlar ekranı için: monitör listesi ve kısayol hataları */
  systemInfo: 'system:info',

  widgetLayout: 'widget:layout',
  widgetGetLayout: 'widget:get-layout',
  /** arayüz -> ana: tıklamalar arkaya geçsin mi */
  widgetSetIgnoreMouse: 'widget:set-ignore-mouse',
  /** arayüz -> ana: görünüm değişti (yerel malzeme modunda pencere boyutu için) */
  widgetSetView: 'widget:set-view',
  /** ana -> arayüz: kısayol / tepsi ile aç-kapa */
  widgetToggle: 'widget:toggle',
  /** ana -> arayüz: önizleme için açık tut */
  widgetPinOpen: 'widget:pin-open',
  widgetDragStart: 'widget:drag-start',
  widgetDragMove: 'widget:drag-move',
  widgetDragEnd: 'widget:drag-end',

  appOpenSettings: 'app:open-settings',
  /** ayarlar -> ana: widget'ı önizleme için açık tut */
  appPreviewWidget: 'app:preview-widget',
  appOpenLogin: 'app:open-login',
  appOpenPlayer: 'app:open-player',
  appReloadPlayer: 'app:reload-player'
} as const

/** Arayüzün oynatıcıya gönderebileceği komutlar */
export type PlayerCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'togglePlay' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'seek'; seconds: number }
  | { type: 'setVolume'; volume: number }
  | { type: 'toggleMute' }
  | { type: 'like' }
  | { type: 'dislike' }
  | { type: 'shuffle' }
  | { type: 'cycleRepeat' }
  | { type: 'getQueue' }
  | { type: 'playQueueIndex'; index: number }
  | { type: 'search'; query: string }
  | { type: 'playTarget'; target: PlayTarget }
  | { type: 'addToQueue'; target: PlayTarget }
  | { type: 'getLibrary' }
  | { type: 'getLyrics'; videoId: string }

export type PlayerCommandType = PlayerCommand['type']

/** Komutların dönüş tipleri */
export interface CommandResults {
  getQueue: QueueItem[]
  search: SearchSection[]
  getLibrary: LibraryPlaylist[]
  getLyrics: string | null
}

export type CommandResult<T extends PlayerCommandType> = T extends keyof CommandResults
  ? CommandResults[T]
  : void

/** IPC üzerinden dönen sonuç zarfı: hata durumunda uygulama çökmez, mesaj gösterilir */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export interface SystemInfo {
  displays: { id: number; label: string; primary: boolean }[]
  shortcutErrors: string[]
  /** Windows 11 22H2+ yerel Acrylic destekliyor mu */
  supportsNativeMaterial: boolean
  isPackaged: boolean
  version: string
}

/**
 * Widget ve ayarlar pencerelerinde `window.mirilti` olarak erişilen API.
 * preload/app.ts bunu uygular.
 */
export interface MiriltiApi {
  command<T extends PlayerCommandType>(
    cmd: Extract<PlayerCommand, { type: T }>
  ): Promise<Result<CommandResult<T>>>
  getState(): Promise<PlayerState>
  onState(cb: (state: PlayerState) => void): () => void
  onQueue(cb: (queue: QueueItem[]) => void): () => void
  onPalette(cb: (palette: CoverPalette | null) => void): () => void
  getLyrics(track: { videoId: string; title: string; artist: string; album: string; duration: number }): Promise<Result<Lyrics>>

  getSettings(): Promise<Settings>
  setSettings(patch: SettingsPatch): Promise<Settings>
  resetSettings(): Promise<Settings>
  exportSettings(): Promise<Result<string | null>>
  importSettings(): Promise<Result<Settings | null>>
  onSettings(cb: (settings: Settings) => void): () => void
  getSystemInfo(): Promise<SystemInfo>

  getLayout(): Promise<WidgetLayout>
  onLayout(cb: (layout: WidgetLayout) => void): () => void
  setIgnoreMouse(ignore: boolean): void
  setView(view: WidgetView): void
  onToggle(cb: () => void): () => void
  onPinOpen(cb: (pinned: boolean) => void): () => void
  dragStart(): void
  dragMove(): void
  dragEnd(): void

  openSettings(): void
  previewWidget(pinned: boolean): void
  openLogin(): void
  openPlayer(): void
  reloadPlayer(): void
}
