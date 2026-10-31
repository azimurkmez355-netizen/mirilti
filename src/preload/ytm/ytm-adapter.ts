/**
 * ytm-adapter.ts — YouTube Music'e bağımlı TÜM kod bu dosyadadır.
 * ==================================================================
 *
 * Bu betik music.youtube.com sayfasının KENDİ dünyasında (main world) çalışır; böylece
 * YouTube'un oynatıcı nesnesine (`#movie_player`), `ytcfg` ayarlarına ve iç API'ye erişebilir.
 * Ana süreç onu her sayfa yüklemesinde `executeJavaScript` ile enjekte eder.
 *
 * Dış dünyayla tek bağlantısı preload/ytm/index.ts'in sağladığı `window.__mirilti` köprüsüdür.
 *
 * ÖNEMLİ: Bu dosya içe aktarma (import) yapamaz (yalnızca `import type` serbest), çünkü tek
 * parça bir betik olarak sayfaya enjekte edilir.
 *
 * Site değişip bir şey bozulursa:
 *   1. Aşağıdaki SEL nesnesindeki seçicileri güncelle (DevTools'ta öğeyi incele).
 *   2. İç API yanıtının yapısı değiştiyse "İç API ayrıştırma" bölümündeki fonksiyonlara bak.
 *   3. `npm run dev` ile dene; tepsiden "YouTube Music penceresini aç" ile sayfayı görüp
 *      Ctrl+Shift+I ile konsolu açabilirsin. Adaptör günlükleri "[mirilti]" ile başlar.
 */
import type {
  LibraryPlaylist,
  LikeStatus,
  PlayerState,
  PlayTarget,
  QueueItem,
  RepeatMode,
  SearchItem,
  SearchItemType,
  SearchSection,
  TrackInfo
} from '../../shared/types'
import type { PlayerCommand, Result } from '../../shared/ipc'

/** preload/ytm/index.ts'in sağladığı köprü */
interface Bridge {
  emitState(state: Partial<PlayerState>): void
  emitQueue(queue: QueueItem[]): void
  onCommand(cb: (id: number, cmd: PlayerCommand) => void): void
  result(id: number, res: Result<unknown>): void
}

/** YouTube'un oynatıcı nesnesinin kullandığımız yöntemleri */
interface YtPlayer extends HTMLElement {
  playVideo?(): void
  pauseVideo?(): void
  nextVideo?(): void
  previousVideo?(): void
  seekTo?(seconds: number, allowSeekAhead: boolean): void
  getVolume?(): number
  setVolume?(v: number): void
  isMuted?(): boolean
  mute?(): void
  unMute?(): void
  getDuration?(): number
  getVideoData?(): { video_id?: string; title?: string; author?: string }
}

/** Redux benzeri sıra deposu (YouTube Music'in iç yapısı) */
interface QueueStore {
  getState(): { queue?: { items?: unknown[]; nextQueueItemId?: number; repeatMode?: string } }
  dispatch(action: { type: string; payload?: unknown }): void
  subscribe?(cb: () => void): () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

;(() => {
  const w = window as unknown as Record<string, unknown>
  if (w['__miriltiAdapterLoaded']) return
  w['__miriltiAdapterLoaded'] = true

  const bridge = w['__mirilti'] as Bridge | undefined
  if (!bridge) {
    console.warn('[mirilti] köprü bulunamadı; adaptör çalışmayacak')
    return
  }

  // ===========================================================================
  // 1. SEÇİCİLER — site arayüzü değişirse önce burayı güncelle
  // ===========================================================================
  const SEL = {
    player: '#movie_player',
    playerBar: 'ytmusic-player-bar',
    /** Reklam oynarken oynatıcıya eklenen sınıf */
    adShowingClass: 'ad-showing',
    playPauseButton: 'ytmusic-player-bar #play-pause-button',
    nextButton: 'ytmusic-player-bar .next-button',
    previousButton: 'ytmusic-player-bar .previous-button',
    shuffleButton: 'ytmusic-player-bar .shuffle',
    repeatButton: 'ytmusic-player-bar .repeat',
    likeRenderer: 'ytmusic-player-bar ytmusic-like-button-renderer',
    likeButton: '#button-shape-like button, .like',
    dislikeButton: '#button-shape-dislike button, .dislike',
    volumeSlider: 'ytmusic-player-bar #volume-slider',
    queue: 'ytmusic-player-queue',
    queueItem: 'ytmusic-player-queue-item',
    queueItemTitle: '.song-title',
    queueItemByline: '.byline',
    queueItemDuration: '.duration',
    queueItemThumb: 'img',
    app: 'ytmusic-app',
    /** "Hâlâ dinliyor musun?" penceresi */
    youThere: 'ytmusic-you-there-renderer',
    youThereButton: 'ytmusic-you-there-renderer button, ytmusic-you-there-renderer #button'
  } as const

  const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
    root.querySelector<T>(sel)

  const getPlayer = (): YtPlayer | null => $<YtPlayer>(SEL.player)
  const getVideo = (): HTMLVideoElement | null => $<HTMLVideoElement>(`${SEL.player} video`) ?? $('video')

  const log = (...args: unknown[]): void => console.debug('[mirilti]', ...args)
  const loadedAt = Date.now()

  // ===========================================================================
  // 2. DURUM OKUMA
  // ===========================================================================

  function isAdPlaying(): boolean {
    return !!getPlayer()?.classList.contains(SEL.adShowingClass)
  }

  function readTrack(): TrackInfo | null {
    const player = getPlayer()
    const data = safe(() => player?.getVideoData?.())
    const videoId = data?.video_id ?? ''
    // Reklam sırasında mediaSession reklamı anlatır; şarkı bilgisini sıradan al.
    if (isAdPlaying()) return readTrackDuringAd()
    const meta = navigator.mediaSession?.metadata ?? null
    const title = meta?.title || data?.title || ''
    if (!title) return null

    const video = getVideo()
    let duration = video && Number.isFinite(video.duration) ? video.duration : 0
    if (!duration) duration = safe(() => player?.getDuration?.()) ?? 0

    lastRealTrack = {
      videoId,
      title,
      artist: meta?.artist || data?.author || '',
      album: meta?.album || '',
      coverUrl: pickArtwork(meta?.artwork) || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
      duration: Math.round(duration)
    }
    return lastRealTrack
  }

  /**
   * Reklam sırasında hem mediaSession hem oynatıcı çubuğu reklamı gösterir.
   * Asıl şarkıyı sıra listesindeki "şu an çalan" öğeden al; o da yoksa son bilinen şarkıda kal.
   */
  let lastRealTrack: TrackInfo | null = null
  function readTrackDuringAd(): TrackInfo | null {
    const current = safe(readQueue)?.find((q) => q.isCurrent)
    if (!current) return lastRealTrack
    return {
      videoId: current.videoId,
      title: current.title,
      artist: current.artist,
      album: lastRealTrack?.videoId === current.videoId ? lastRealTrack.album : '',
      // Küçük resmi büyük boyutla iste
      coverUrl: current.thumbnail.replace(/=w\d+-h\d+/, '=w544-h544'),
      duration: parseDuration(current.durationText)
    }
  }

  function parseDuration(text: string): number {
    return text.split(':').reduce((acc, part) => acc * 60 + (Number(part) || 0), 0)
  }

  /** mediaSession kapak listesinden en büyüğünü seçer */
  function pickArtwork(artwork: readonly MediaImage[] | undefined): string {
    if (!artwork?.length) return ''
    let best = artwork[0]
    let bestSize = 0
    for (const img of artwork) {
      const size = Number(img.sizes?.split('x')[0]) || 0
      if (size >= bestSize) {
        best = img
        bestSize = size
      }
    }
    return best.src
  }

  function readLikeStatus(): LikeStatus {
    const status = $(SEL.likeRenderer)?.getAttribute('like-status')
    return status === 'LIKE' || status === 'DISLIKE' ? status : 'INDIFFERENT'
  }

  function readRepeatMode(): RepeatMode {
    // 1) İç depo  2) player-bar özelliği / niteliği
    const fromStore = safe(() => queueStore()?.getState().queue?.repeatMode)
    const bar = $(SEL.playerBar) as (HTMLElement & { repeatMode_?: string; repeatMode?: string }) | null
    const raw = fromStore ?? bar?.repeatMode_ ?? bar?.repeatMode ?? bar?.getAttribute('repeat-mode_') ?? bar?.getAttribute('repeat-mode')
    return raw === 'ALL' || raw === 'ONE' ? raw : 'NONE'
  }

  function readLoggedIn(): boolean | null {
    const cfg = w['ytcfg'] as { get?(key: string): unknown } | undefined
    const v = safe(() => cfg?.get?.('LOGGED_IN'))
    return typeof v === 'boolean' ? v : null
  }

  /** Bulunamayan kritik öğeler: widget'ta "arayüz değişmiş olabilir" uyarısı için */
  function readIssues(track: TrackInfo | null): string[] {
    // Sayfa yeni yüklendiyse öğeler henüz oluşmamış olabilir
    if (Date.now() - loadedAt < 8000) return []
    const issues: string[] = []
    if (!getPlayer()) issues.push(`Oynatıcı bulunamadı (${SEL.player})`)
    if (!$(SEL.playerBar)) issues.push(`Oynatıcı çubuğu bulunamadı (${SEL.playerBar})`)
    if (track && !$(SEL.likeRenderer)) issues.push(`Beğen düğmesi bulunamadı (${SEL.likeRenderer})`)
    return issues
  }

  function snapshot(): Partial<PlayerState> {
    const video = getVideo()
    const player = getPlayer()
    const track = readTrack()
    return {
      connection: navigator.onLine ? 'ready' : 'offline',
      loggedIn: readLoggedIn(),
      track,
      isPlaying: !!video && !video.paused && !video.ended,
      adPlaying: isAdPlaying(),
      position: video?.currentTime ?? 0,
      positionAt: Date.now(),
      playbackRate: video?.playbackRate ?? 1,
      volume: Math.round(safe(() => player?.getVolume?.()) ?? (video ? video.volume * 100 : 100)),
      muted: safe(() => player?.isMuted?.()) ?? video?.muted ?? false,
      likeStatus: readLikeStatus(),
      repeat: readRepeatMode(),
      adapterIssues: readIssues(track)
    }
  }

  // Değişiklikleri kısa bir gecikmeyle topla: aynı anda gelen birçok olay tek mesaj olsun.
  let emitTimer: number | undefined
  function scheduleEmit(delay = 60): void {
    if (emitTimer !== undefined) return
    emitTimer = window.setTimeout(() => {
      emitTimer = undefined
      try {
        bridge!.emitState(snapshot())
      } catch (err) {
        console.warn('[mirilti] durum okunamadı', err)
      }
    }, delay)
  }

  // ===========================================================================
  // 3. OLAY DİNLEYİCİLERİ (yoklama yok — sayfa olaylarına abone olunur)
  // ===========================================================================

  // Medya olayları kabarcıklanmaz ama "capture" aşamasında document'a ulaşır;
  // böylece <video> öğesi sonradan oluşsa ya da değişse bile yakalanır.
  const MEDIA_EVENTS = ['play', 'playing', 'pause', 'ended', 'seeked', 'durationchange', 'loadedmetadata', 'volumechange', 'ratechange', 'emptied']
  for (const type of MEDIA_EVENTS) {
    document.addEventListener(type, (e) => {
      if (e.target instanceof HTMLMediaElement) {
        scheduleEmit()
        if (type === 'pause') dismissYouThere()
      }
    }, true)
  }

  // Konum kayması olmasın diye çalarken seyrek (15 sn) eşitleme. timeupdate zaten sayfada
  // tetikleniyor; biz yalnızca arada bir dinliyoruz, ek zamanlayıcı yok.
  let lastSync = 0
  document.addEventListener('timeupdate', (e) => {
    if (!(e.target instanceof HTMLMediaElement)) return
    const now = Date.now()
    if (now - lastSync > 15000) {
      lastSync = now
      scheduleEmit()
    }
  }, true)

  window.addEventListener('online', () => scheduleEmit())
  window.addEventListener('offline', () => scheduleEmit())

  // Şarkı bilgisi değişince YouTube Music mediaSession.metadata'yı atar: bu atamayı yakala.
  try {
    const desc = Object.getOwnPropertyDescriptor(MediaSession.prototype, 'metadata')
    if (desc?.get && desc.set) {
      Object.defineProperty(navigator.mediaSession, 'metadata', {
        configurable: true,
        get() {
          return desc.get!.call(this)
        },
        set(value) {
          desc.set!.call(this, value)
          scheduleEmit(120)
        }
      })
    }
  } catch (err) {
    console.warn('[mirilti] mediaSession izlenemiyor', err)
  }

  // Beğeni / tekrar durumu oynatıcı çubuğundaki niteliklerde tutulur.
  function observePlayerBar(): boolean {
    const bar = $(SEL.playerBar)
    if (!bar) return false
    new MutationObserver(() => scheduleEmit(100)).observe(bar, {
      subtree: true,
      attributes: true,
      attributeFilter: ['like-status', 'repeat-mode_', 'repeat-mode', 'aria-pressed']
    })
    return true
  }

  // ===========================================================================
  // 4. SIRA (Sıradaki listesi)
  // ===========================================================================

  /** YouTube Music'in iç sıra deposu (bulunamazsa null; DOM'a geri dönülür) */
  function queueStore(): QueueStore | null {
    const el = $(SEL.queue) as (HTMLElement & Json) | null
    const candidates = [el?.queue?.store?.store, el?.queue?.store, el?.store]
    for (const c of candidates) {
      if (c && typeof c.getState === 'function' && typeof c.dispatch === 'function') return c as QueueStore
    }
    return null
  }

  /** Depodaki bir öğeyi (sarmalayıcıları açarak) playlistPanelVideoRenderer'a indirger */
  function unwrapQueueItem(item: Json): Json {
    return (
      item?.playlistPanelVideoRenderer ??
      item?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer ??
      null
    )
  }

  function readQueue(): QueueItem[] {
    const store = queueStore()
    const items = safe(() => store?.getState().queue?.items)
    if (Array.isArray(items) && items.length) {
      return items.map((raw, index) => {
        const r = unwrapQueueItem(raw) ?? {}
        return {
          index,
          videoId: r.videoId ?? '',
          title: text(r.title),
          artist: text(r.shortBylineText ?? r.longBylineText),
          durationText: text(r.lengthText),
          thumbnail: bestThumb(r.thumbnail?.thumbnails),
          isCurrent: !!r.selected
        }
      })
    }
    // Yedek yol: DOM'dan oku
    const nodes = document.querySelectorAll<HTMLElement>(`${SEL.queue} ${SEL.queueItem}`)
    return Array.from(nodes).map((el, index) => {
      const data = (el as HTMLElement & Json).data ?? {}
      return {
        index,
        videoId: data.videoId ?? '',
        title: $(SEL.queueItemTitle, el)?.textContent?.trim() ?? text(data.title),
        artist: $(SEL.queueItemByline, el)?.textContent?.trim() ?? '',
        durationText: $(SEL.queueItemDuration, el)?.textContent?.trim() ?? '',
        thumbnail: $<HTMLImageElement>(SEL.queueItemThumb, el)?.src ?? '',
        isCurrent: el.hasAttribute('selected') || !!data.selected
      }
    })
  }

  let lastQueueKey = ''
  let queueTimer: number | undefined
  function scheduleQueueEmit(): void {
    if (queueTimer !== undefined) return
    queueTimer = window.setTimeout(() => {
      queueTimer = undefined
      const queue = safe(readQueue) ?? []
      // Değişmediyse gönderme
      const key = queue.map((q) => `${q.videoId}:${q.isCurrent ? 1 : 0}`).join('|')
      if (key === lastQueueKey) return
      lastQueueKey = key
      bridge!.emitQueue(queue)
    }, 300)
  }

  function observeQueue(): boolean {
    const store = queueStore()
    if (store?.subscribe) {
      store.subscribe(scheduleQueueEmit)
      scheduleQueueEmit()
      return true
    }
    const el = $(SEL.queue)
    if (!el) return false
    new MutationObserver(scheduleQueueEmit).observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['selected']
    })
    scheduleQueueEmit()
    return true
  }

  function playQueueIndex(index: number): void {
    const store = queueStore()
    const host = $(SEL.queue) as (HTMLElement & Json) | null
    if (typeof host?.dispatch === 'function') {
      host.dispatch({ type: 'SET_INDEX', payload: index })
      return
    }
    if (store) {
      store.dispatch({ type: 'SET_INDEX', payload: index })
      return
    }
    const el = document.querySelectorAll<HTMLElement>(`${SEL.queue} ${SEL.queueItem}`)[index]
    if (!el) throw new Error('Sıradaki şarkı bulunamadı')
    ;($('.song-info', el) ?? el).click()
  }

  async function addToQueue(target: PlayTarget): Promise<void> {
    const store = queueStore()
    if (!store) throw new Error('Sıra deposu bulunamadı (arayüz değişmiş olabilir)')
    const body: Json = target.videoId ? { videoIds: [target.videoId] } : { playlistId: target.playlistId }
    const res = await innertube('music/get_queue', body)
    const items = (res?.queueDatas ?? []).map((d: Json) => d?.content).filter(Boolean)
    if (!items.length) throw new Error('Sıraya eklenecek şarkı bulunamadı')
    const q = store.getState().queue ?? {}
    store.dispatch({
      type: 'ADD_ITEMS',
      payload: {
        nextQueueItemId: q.nextQueueItemId ?? 0,
        index: q.items?.length ?? 0,
        items,
        shuffleEnabled: false,
        shouldAssignIds: true
      }
    })
  }

  // ===========================================================================
  // 5. KONTROLLER
  // ===========================================================================

  function clickEl(sel: string, root: ParentNode = document): boolean {
    const el = $(sel, root)
    if (!el) return false
    el.click()
    return true
  }

  function togglePlay(): void {
    const video = getVideo()
    if (video && !video.paused) pause()
    else play()
  }

  function play(): void {
    const player = getPlayer()
    if (player?.playVideo) player.playVideo()
    else if (!clickEl(SEL.playPauseButton)) void getVideo()?.play()
  }

  function pause(): void {
    const player = getPlayer()
    if (player?.pauseVideo) player.pauseVideo()
    else if (!clickEl(SEL.playPauseButton)) getVideo()?.pause()
  }

  function next(): void {
    // Oynatıcı çubuğundaki düğme, YouTube Music'in kendi sırasını doğru izler
    if (!clickEl(SEL.nextButton)) getPlayer()?.nextVideo?.()
  }

  function previous(): void {
    if (!clickEl(SEL.previousButton)) getPlayer()?.previousVideo?.()
  }

  function seek(seconds: number): void {
    const player = getPlayer()
    if (player?.seekTo) player.seekTo(seconds, true)
    else {
      const video = getVideo()
      if (video) video.currentTime = seconds
    }
  }

  function setVolume(volume: number): void {
    const v = Math.max(0, Math.min(100, Math.round(volume)))
    const player = getPlayer()
    if (!player?.setVolume) throw new Error('Ses ayarı bulunamadı')
    player.setVolume(v)
    if (v > 0 && player.isMuted?.()) player.unMute?.()
    // Sayfadaki kaydırıcı da güncel görünsün (YouTube Music sesi buradan kaydeder)
    const slider = $(SEL.volumeSlider) as (HTMLElement & { value?: number }) | null
    if (slider) slider.value = v
    scheduleEmit()
  }

  function toggleMute(): void {
    const player = getPlayer()
    if (player?.isMuted?.()) player.unMute?.()
    else player?.mute?.()
    scheduleEmit()
  }

  function rate(kind: 'like' | 'dislike'): void {
    const renderer = $(SEL.likeRenderer)
    if (!renderer) throw new Error('Beğen düğmesi bulunamadı')
    if (!clickEl(kind === 'like' ? SEL.likeButton : SEL.dislikeButton, renderer)) {
      throw new Error('Beğen düğmesi bulunamadı')
    }
  }

  function shuffle(): void {
    const el = $(SEL.shuffleButton)
    if (!el) throw new Error('Karıştır düğmesi bulunamadı')
    ;($('button', el) ?? el).click()
  }

  function cycleRepeat(): void {
    const el = $(SEL.repeatButton)
    if (!el) throw new Error('Tekrar düğmesi bulunamadı')
    ;($('button', el) ?? el).click()
    scheduleEmit(150)
  }

  /** "Hâlâ dinliyor musun?" sorusu müziği durdurduysa onaylayıp devam et */
  function dismissYouThere(): void {
    const dialog = $(SEL.youThere)
    if (!dialog || dialog.offsetParent === null) return
    if (clickEl(SEL.youThereButton)) {
      log('"Hâlâ dinliyor musun?" onaylandı')
      window.setTimeout(play, 300)
    }
  }

  /**
   * Bir şarkıyı ya da listeyi çal. YouTube Music'in kendi yönlendirme olayını kullanır;
   * böylece sayfa yenilenmez ve sıra doğru kurulur. Olmazsa sayfayı o adrese götürür.
   */
  async function playTarget(target: PlayTarget): Promise<void> {
    const before = safe(() => getPlayer()?.getVideoData?.()?.video_id)
    const endpoint: Json = target.videoId
      ? { watchEndpoint: { videoId: target.videoId, playlistId: target.playlistId } }
      : { watchPlaylistEndpoint: { playlistId: target.playlistId } }
    const app = $(SEL.app)
    app?.dispatchEvent(new CustomEvent('yt-navigate', { bubbles: true, composed: true, detail: { endpoint } }))

    // Yönlendirme işe yaradı mı? Çalan şarkı değişmediyse tam sayfa yönlendirmeye düş.
    await sleep(2500)
    const after = safe(() => getPlayer()?.getVideoData?.()?.video_id)
    const changed = target.videoId ? after === target.videoId : after !== before
    if (!changed) {
      log('yt-navigate işe yaramadı, sayfa yönlendiriliyor')
      const params = new URLSearchParams()
      if (target.videoId) params.set('v', target.videoId)
      if (target.playlistId) params.set('list', target.playlistId)
      location.assign(target.videoId ? `/watch?${params}` : `/playlist?${params}`)
    }
  }

  // ===========================================================================
  // 6. İÇ API (Innertube) — arama, kitaplık, şarkı sözleri
  // ===========================================================================

  type YtCfg = { get(key: string): Json }

  async function innertube(endpoint: string, body: Json): Promise<Json> {
    const cfg = w['ytcfg'] as YtCfg | undefined
    if (!cfg?.get) throw new Error('ytcfg bulunamadı')
    const context = cfg.get('INNERTUBE_CONTEXT')
    const key = cfg.get('INNERTUBE_API_KEY')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Origin': location.origin,
      'X-Youtube-Client-Name': String(cfg.get('INNERTUBE_CONTEXT_CLIENT_NAME') ?? 67),
      'X-Youtube-Client-Version': String(cfg.get('INNERTUBE_CLIENT_VERSION') ?? '')
    }
    const visitor = context?.client?.visitorData
    if (visitor) headers['X-Goog-Visitor-Id'] = visitor
    const auth = await sapisidHash()
    if (auth) {
      headers['Authorization'] = auth
      headers['X-Goog-AuthUser'] = String(cfg.get('SESSION_INDEX') ?? 0)
    }
    const url = `/youtubei/v1/${endpoint}?prettyPrint=false${key ? `&key=${key}` : ''}`
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ context, ...body })
    })
    if (!res.ok) throw new Error(`İç API hatası: ${endpoint} (${res.status})`)
    return res.json()
  }

  /** Oturum açık isteklerde gereken yetki başlığı (SAPISID çerezinin SHA-1 özeti) */
  async function sapisidHash(): Promise<string | null> {
    const m = document.cookie.match(/(?:^|;\s*)(?:SAPISID|__Secure-3PAPISID)=([^;]+)/)
    if (!m) return null
    const ts = Math.floor(Date.now() / 1000)
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${ts} ${m[1]} ${location.origin}`))
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
    return `SAPISIDHASH ${ts}_${hex}`
  }

  // --- İç API ayrıştırma ---

  async function search(query: string): Promise<SearchSection[]> {
    const res = await innertube('search', { query })
    const contents: Json[] =
      res?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ?? []
    const sections: SearchSection[] = []
    // Başlıksız gelen sonuçlar (2026 düzeni: her sonuç ayrı bir itemSectionRenderer) türe göre gruplanır
    const loose: SearchItem[] = []
    const listItems = (arr: Json[]): SearchItem[] =>
      (arr ?? []).map((x: Json) => x.musicResponsiveListItemRenderer).filter(Boolean).map(parseListItem)

    for (const c of contents) {
      if (c.musicCardShelfRenderer) {
        const card = c.musicCardShelfRenderer
        const items = [parseCard(card), ...listItems(card.contents)]
        sections.push({ title: text(card.header?.musicCardShelfHeaderBasicRenderer?.title) || 'En iyi sonuç', items })
      } else if (c.musicShelfRenderer) {
        // Eski düzen: başlıklı raflar ("Şarkılar", "Albümler"…)
        const shelf = c.musicShelfRenderer
        const items = listItems(shelf.contents)
        if (items.length) sections.push({ title: text(shelf.title), items })
      } else if (c.itemSectionRenderer) {
        loose.push(...listItems(c.itemSectionRenderer.contents))
      }
    }

    const groupTitles: Record<SearchItemType, string> = {
      song: 'Şarkılar',
      video: 'Videolar',
      album: 'Albümler',
      artist: 'Sanatçılar',
      playlist: 'Çalma listeleri',
      other: 'Diğer'
    }
    const groups = new Map<SearchItemType, SearchItem[]>()
    for (const item of loose) {
      if (!groups.has(item.type)) groups.set(item.type, [])
      groups.get(item.type)!.push(item)
    }
    for (const [type, items] of groups) sections.push({ title: groupTitles[type], items })
    return sections
  }

  function classify(pageType: string | undefined, musicVideoType: string | undefined, hasVideo: boolean): SearchItemType {
    switch (pageType) {
      case 'MUSIC_PAGE_TYPE_ARTIST':
      case 'MUSIC_PAGE_TYPE_USER_CHANNEL':
        return 'artist'
      case 'MUSIC_PAGE_TYPE_ALBUM':
        return 'album'
      case 'MUSIC_PAGE_TYPE_PLAYLIST':
        return 'playlist'
    }
    if (hasVideo) return musicVideoType === 'MUSIC_VIDEO_TYPE_ATV' ? 'song' : 'video'
    return 'other'
  }

  function parseListItem(r: Json): SearchItem {
    const cols: Json[] = (r.flexColumns ?? []).map((c: Json) => c.musicResponsiveListItemFlexColumnRenderer?.text)
    const pageType = r.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType
    const watch = findKey(r.overlay, 'watchEndpoint') ?? findKey(cols[0], 'watchEndpoint')
    const videoId: string | undefined = r.playlistItemData?.videoId ?? watch?.videoId
    const watchPlaylist = findKey(r.overlay, 'watchPlaylistEndpoint') ?? findKey(r.menu, 'watchPlaylistEndpoint')
    const type = classify(pageType, watch?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType, !!videoId)
    return toItem(type, text(cols[0]), cols.slice(1).map(text).filter(Boolean).join(' • '), r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails, videoId, watchPlaylist?.playlistId)
  }

  function parseCard(card: Json): SearchItem {
    const pageType = findKey(card.title, 'browseEndpoint')?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType
    const watch = findKey(card.title, 'watchEndpoint') ?? findKey(card.thumbnailOverlay, 'watchEndpoint') ?? findKey(card.buttons, 'watchEndpoint')
    const watchPlaylist = findKey(card.buttons, 'watchPlaylistEndpoint') ?? findKey(card.menu, 'watchPlaylistEndpoint')
    const type = classify(pageType, watch?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType, !!watch?.videoId)
    return toItem(type, text(card.title), text(card.subtitle), card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails, watch?.videoId, watchPlaylist?.playlistId)
  }

  function toItem(type: SearchItemType, title: string, subtitle: string, thumbs: Json, videoId?: string, playlistId?: string): SearchItem {
    const play: PlayTarget | null = videoId ? { videoId } : playlistId ? { playlistId } : null
    return {
      type,
      title,
      subtitle,
      thumbnail: bestThumb(thumbs),
      play,
      // Sanatçının "karıştır" listesi sıraya eklenmez; şarkı ve albüm/listeler eklenebilir
      canQueue: !!play && type !== 'artist'
    }
  }

  async function getLibrary(): Promise<LibraryPlaylist[]> {
    if (readLoggedIn() === false) throw new Error('Kitaplık için Google ile giriş yapmalısın')
    const res = await innertube('browse', { browseId: 'FEmusic_liked_playlists' })
    const out: LibraryPlaylist[] = []
    const seen = new Set<string>()
    const push = (browseId: string | undefined, title: string, subtitle: string, thumbs: Json): void => {
      if (!browseId?.startsWith('VL')) return // "Yeni çalma listesi" gibi düğmeleri atla
      const playlistId = browseId.slice(2)
      if (seen.has(playlistId)) return
      seen.add(playlistId)
      out.push({ playlistId, title, subtitle, thumbnail: bestThumb(thumbs) })
    }
    for (const r of findAll(res, 'musicTwoRowItemRenderer')) {
      push(r.navigationEndpoint?.browseEndpoint?.browseId, text(r.title), text(r.subtitle), r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails)
    }
    for (const r of findAll(res, 'musicResponsiveListItemRenderer')) {
      const cols: Json[] = (r.flexColumns ?? []).map((c: Json) => c.musicResponsiveListItemFlexColumnRenderer?.text)
      push(r.navigationEndpoint?.browseEndpoint?.browseId, text(cols[0]), text(cols[1]), r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails)
    }
    // "Beğenilen müzikler" (LM) her zaman başta olsun
    const liked = out.findIndex((p) => p.playlistId === 'LM')
    if (liked > 0) out.unshift(...out.splice(liked, 1))
    if (liked === -1) out.unshift({ playlistId: 'LM', title: 'Beğenilen müzikler', subtitle: 'Otomatik çalma listesi', thumbnail: '' })
    return out
  }

  /** YouTube Music'in kendi şarkı sözleri (düz metin). Yoksa null. */
  async function getLyrics(videoId: string): Promise<string | null> {
    const next = await innertube('next', { videoId, isAudioOnly: true })
    const tab = findAll(next, 'tabRenderer').find((t: Json) =>
      String(t?.endpoint?.browseEndpoint?.browseId ?? '').startsWith('MPLY')
    )
    const browseId = tab?.endpoint?.browseEndpoint?.browseId
    if (!browseId) return null
    const res = await innertube('browse', { browseId })
    const shelf = findKey(res, 'musicDescriptionShelfRenderer')
    const lyrics = text(shelf?.description)
    return lyrics || null
  }

  // ===========================================================================
  // 7. KOMUT YÖNLENDİRİCİ
  // ===========================================================================

  async function handle(cmd: PlayerCommand): Promise<unknown> {
    switch (cmd.type) {
      case 'play': return play()
      case 'pause': return pause()
      case 'togglePlay': return togglePlay()
      case 'next': return next()
      case 'previous': return previous()
      case 'seek': return seek(cmd.seconds)
      case 'setVolume': return setVolume(cmd.volume)
      case 'toggleMute': return toggleMute()
      case 'like': return rate('like')
      case 'dislike': return rate('dislike')
      case 'shuffle': return shuffle()
      case 'cycleRepeat': return cycleRepeat()
      case 'getQueue': return readQueue()
      case 'playQueueIndex': return playQueueIndex(cmd.index)
      case 'search': return search(cmd.query)
      case 'playTarget': return playTarget(cmd.target)
      case 'addToQueue': return addToQueue(cmd.target)
      case 'getLibrary': return getLibrary()
      case 'getLyrics': return getLyrics(cmd.videoId)
      default: throw new Error('Bilinmeyen komut')
    }
  }

  bridge.onCommand((id, cmd) => {
    Promise.resolve()
      .then(() => handle(cmd))
      .then((data) => bridge.result(id, { ok: true, data: data ?? null }))
      .catch((err: unknown) => {
        console.warn('[mirilti] komut başarısız', cmd.type, err)
        bridge.result(id, { ok: false, error: err instanceof Error ? err.message : String(err) })
      })
  })

  // ===========================================================================
  // 8. YARDIMCILAR
  // ===========================================================================

  function safe<T>(fn: () => T): T | undefined {
    try {
      return fn()
    } catch {
      return undefined
    }
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((r) => window.setTimeout(r, ms))
  }

  /** YouTube metin nesnesi ({runs:[{text}]} ya da {simpleText}) → düz metin */
  function text(t: Json): string {
    if (!t) return ''
    if (typeof t === 'string') return t
    if (t.simpleText) return t.simpleText
    if (Array.isArray(t.runs)) return t.runs.map((r: Json) => r.text ?? '').join('')
    return ''
  }

  function bestThumb(thumbs: Json): string {
    if (!Array.isArray(thumbs) || !thumbs.length) return ''
    // Liste küçükten büyüğe; widget'ta küçük gösterildiği için orta boy yeterli
    const pick = thumbs.find((t: Json) => (t.width ?? 0) >= 120) ?? thumbs[thumbs.length - 1]
    return pick?.url ?? ''
  }

  /** Nesne ağacında verilen anahtarın ilk değerini bulur (derinlik sınırlı) */
  function findKey(obj: Json, key: string, depth = 10): Json {
    if (!obj || typeof obj !== 'object' || depth < 0) return undefined
    if (key in obj) return obj[key]
    for (const v of Object.values(obj)) {
      const found = findKey(v, key, depth - 1)
      if (found !== undefined) return found
    }
    return undefined
  }

  /** Nesne ağacında verilen anahtarın tüm değerlerini toplar */
  function findAll(obj: Json, key: string, out: Json[] = [], depth = 20): Json[] {
    if (!obj || typeof obj !== 'object' || depth < 0) return out
    for (const [k, v] of Object.entries(obj)) {
      if (k === key) out.push(v)
      else findAll(v, key, out, depth - 1)
    }
    return out
  }

  // ===========================================================================
  // 9. BAŞLAT
  // ===========================================================================

  /** Öğeler henüz yoksa oluşana kadar (en fazla ~30 sn) DOM değişikliklerini bekle */
  function whenReady(tryAttach: () => boolean, name: string): void {
    if (tryAttach()) return
    const obs = new MutationObserver(() => {
      if (tryAttach()) {
        obs.disconnect()
        window.clearTimeout(timeout)
      }
    })
    obs.observe(document.documentElement, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => {
      obs.disconnect()
      log(`${name} bulunamadı`)
      scheduleEmit()
    }, 30000)
  }

  whenReady(observePlayerBar, 'oynatıcı çubuğu')
  whenReady(observeQueue, 'sıra listesi')
  scheduleEmit(0)
  // Sorun tespiti için yükleme sonrası bir kez daha
  window.setTimeout(() => scheduleEmit(0), 9000)
  log('adaptör hazır')
})()
