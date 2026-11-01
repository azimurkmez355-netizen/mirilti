/**
 * Gizli YouTube Music penceresi.
 *
 * music.youtube.com görünmez bir pencerede açılır ve müziği bu pencere çalar.
 * `persist:ytmusic` oturum bölümü sayesinde Google girişi diske kaydedilir ve hatırlanır.
 * Sayfaya iki betik girer:
 *   1. preload/ytm.js        → izole dünyada çalışan IPC köprüsü (preload olarak)
 *   2. preload/ytm-adapter.js → sayfanın kendi dünyasında çalışan adaptör (dom-ready'de enjekte)
 */
import { readFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import { BrowserWindow, net, session, shell } from 'electron'
import { appIcon, preloadPath } from '../paths'
import { chromeUserAgent } from '../user-agent'

export const YTM_URL = 'https://music.youtube.com/'
export const YTM_PARTITION = 'persist:ytmusic'

/** Ana süreçteki diğer modüllerin dinlediği olaylar: 'offline' | 'loading' | 'loaded' */
export const playerEvents = new EventEmitter()

let win: BrowserWindow | null = null
let adapterCode: string | null = null
let retryTimer: NodeJS.Timeout | null = null
let retryDelay = 5000
let quitting = false

export function ytmSession(): Electron.Session {
  return session.fromPartition(YTM_PARTITION)
}

export function getPlayerWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

export function markQuitting(): void {
  quitting = true
}

export function createPlayerWindow(): BrowserWindow {
  const ses = ytmSession()
  ses.setUserAgent(chromeUserAgent())

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'Mırıltı – YouTube Music',
    icon: appIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      partition: YTM_PARTITION,
      preload: preloadPath.ytm,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Pencere gizliyken zamanlayıcılar/ses yavaşlamasın
      backgroundThrottling: false
    }
  })

  const contents = win.webContents

  // Adaptörü her tam sayfa yüklemesinde sayfanın kendi dünyasına enjekte et.
  contents.on('dom-ready', () => {
    injectAdapter(contents)
  })

  contents.on('did-start-loading', () => playerEvents.emit('loading'))
  contents.on('did-finish-load', () => {
    retryDelay = 5000
    playerEvents.emit('loaded')
  })

  // İnternet yoksa sayfa yüklenemez: çökme yerine durum bildir ve artan aralıklarla yeniden dene.
  contents.on('did-fail-load', (_e, errorCode, errorDescription, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 /* ERR_ABORTED: normal yönlendirme */) return
    console.warn(`[player] yükleme başarısız (${errorCode}): ${errorDescription}`)
    playerEvents.emit('offline')
    scheduleRetry()
  })

  // YouTube Music, müzik çalarken "sayfadan ayrılmak istiyor musun?" (beforeunload) ile kapanmayı
  // engeller. Gizli pencerede bu soru görünmez ve uygulama hiç kapanamaz; engeli yok say.
  contents.on('will-prevent-unload', (e) => e.preventDefault())

  // Sayfa çökerse yeniden yükle
  contents.on('render-process-gone', (_e, details) => {
    console.warn('[player] sayfa süreci kapandı:', details.reason)
    if (!quitting) scheduleRetry(1000)
  })

  // Yeni pencere açma isteklerini (ör. "Paylaş" bağlantıları) varsayılan tarayıcıya gönder
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Kullanıcı "YouTube Music penceresini aç" ile gösterip kapatırsa: kapatma, gizle.
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win?.hide()
    }
  })

  void contents.loadURL(YTM_URL)
  return win
}

function injectAdapter(contents: Electron.WebContents): void {
  try {
    adapterCode ??= readFileSync(preloadPath.ytmAdapter, 'utf8')
    // executeJavaScript sayfanın ana dünyasında çalışır: YouTube'un oynatıcı nesnesine erişebilir.
    contents.executeJavaScript(adapterCode, true).catch((err: unknown) => {
      console.error('[player] adaptör çalıştırılamadı:', err)
    })
  } catch (err) {
    console.error('[player] adaptör dosyası okunamadı:', err)
  }
}

function scheduleRetry(delay = retryDelay): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(() => {
    retryTimer = null
    const w = getPlayerWindow()
    if (!w) return
    if (!net.isOnline()) {
      // Hâlâ bağlantı yok: beklemeyi uzat (en fazla 1 dk)
      retryDelay = Math.min(retryDelay * 2, 60_000)
      scheduleRetry()
      return
    }
    void w.webContents.loadURL(YTM_URL)
  }, delay)
}

export function reloadPlayer(): void {
  const w = getPlayerWindow()
  if (w) void w.webContents.loadURL(YTM_URL)
}

export function showPlayerWindow(): void {
  const w = getPlayerWindow()
  if (!w) return
  w.show()
  w.focus()
}

/**
 * Google oturum çerezine bakarak giriş yapılıp yapılmadığını anlar.
 * Sayfa yüklenmeden de çalışır (ilk açılışta giriş penceresini açıp açmamaya karar vermek için).
 */
export async function hasGoogleSession(): Promise<boolean> {
  const cookies = await ytmSession().cookies.get({ domain: '.youtube.com' })
  return cookies.some((c) => c.name === 'SAPISID' || c.name === '__Secure-3PAPISID')
}
