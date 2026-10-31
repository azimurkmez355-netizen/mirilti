/**
 * Süreçler arası paylaşılan veri tipleri.
 * Ana süreç, preload'lar ve React arayüzleri bu dosyadaki tipleri kullanır.
 */

/** Çalan şarkının bilgileri */
export interface TrackInfo {
  videoId: string
  title: string
  artist: string
  album: string
  /** Albüm kapağı URL'si (mümkün olan en büyük boyut) */
  coverUrl: string
  /** Saniye cinsinden süre (bilinmiyorsa 0) */
  duration: number
}

export type LikeStatus = 'LIKE' | 'DISLIKE' | 'INDIFFERENT'
export type RepeatMode = 'NONE' | 'ALL' | 'ONE'

/** Gizli oynatıcı sayfasının bağlantı durumu */
export type ConnectionStatus = 'loading' | 'ready' | 'offline' | 'error'

/** Widget'ın gösterdiği tüm oynatıcı durumu. Ana süreç bunu önbellekte tutar. */
export interface PlayerState {
  connection: ConnectionStatus
  /** null: henüz bilinmiyor */
  loggedIn: boolean | null
  track: TrackInfo | null
  isPlaying: boolean
  /** Şu an reklam oynuyor mu (yalnızca bilgi amaçlı gösterilir; engellenmez) */
  adPlaying: boolean
  /** Son ölçülen konum (sn) ve ölçüm anı (Date.now()). Arayüz aradaki süreyi kendisi hesaplar. */
  position: number
  positionAt: number
  playbackRate: number
  /** 0-100 */
  volume: number
  muted: boolean
  likeStatus: LikeStatus
  repeat: RepeatMode
  /** Bulunamayan seçiciler / bozulan özellikler (site değişince dolar) */
  adapterIssues: string[]
}

export const initialPlayerState: PlayerState = {
  connection: 'loading',
  loggedIn: null,
  track: null,
  isPlaying: false,
  adPlaying: false,
  position: 0,
  positionAt: 0,
  playbackRate: 1,
  volume: 100,
  muted: false,
  likeStatus: 'INDIFFERENT',
  repeat: 'NONE',
  adapterIssues: []
}

/** "Sıradaki" listesindeki bir öğe */
export interface QueueItem {
  index: number
  videoId: string
  title: string
  artist: string
  /** "3:45" gibi metin */
  durationText: string
  thumbnail: string
  isCurrent: boolean
}

/** Çalınabilecek bir hedef: tek şarkı ya da çalma listesi/albüm */
export interface PlayTarget {
  videoId?: string
  playlistId?: string
}

export type SearchItemType = 'song' | 'video' | 'album' | 'artist' | 'playlist' | 'other'

export interface SearchItem {
  type: SearchItemType
  title: string
  subtitle: string
  thumbnail: string
  /** Çalmak için hedef (yoksa çalınamaz) */
  play: PlayTarget | null
  /** Sıraya eklenebilir mi */
  canQueue: boolean
}

export interface SearchSection {
  title: string
  items: SearchItem[]
}

/** Kitaplıktaki bir çalma listesi */
export interface LibraryPlaylist {
  playlistId: string
  title: string
  subtitle: string
  thumbnail: string
}

/** Senkron şarkı sözü satırı */
export interface LyricLine {
  /** Saniye */
  time: number
  text: string
}

export interface Lyrics {
  synced: LyricLine[] | null
  plain: string | null
  source: 'lrclib' | 'youtube-music' | null
}

/** Kapaktan çıkarılan renkler (CSS renk metinleri) */
export interface CoverPalette {
  accent: string
  /** Vurgu renginin üzerinde okunaklı yazı rengi */
  onAccent: string
  bgFrom: string
  bgTo: string
}

/**
 * Widget'ın ekrandaki yerleşimi. Ana süreç hesaplar, arayüz uygular.
 * Tüm dikdörtgenler pencere içi koordinatlardadır (DIP, ölçek dahil).
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type DockSide = 'left' | 'right' | 'top' | 'bottom' | 'none'

export interface WidgetLayout {
  /** Daraltılmış hâlin (kapak + dalga) yeri */
  pill: Rect
  /** Açık hâl: yalnız oynatıcı */
  compact: Rect
  /** Açık hâl: oynatıcı + sekmeler (sözler, sıra, arama…) */
  full: Rect
  /** Hangi ekran kenarına yapışık (köşe yuvarlatma ve animasyon yönü için) */
  side: DockSide
  /** Pill'in yönü: kenarlarda dikey/yatay ince şerit, köşe/yüzende yuvarlak balon */
  pillShape: 'vertical' | 'horizontal' | 'bubble'
  /** Ölçek (widget içeriği bu oranla büyütülür) */
  scale: number
  /** Yerel Acrylic modu: pencere görünen şekle göre yeniden boyutlanır */
  fitted: boolean
}

export type WidgetView = 'collapsed' | 'compact' | 'full'
