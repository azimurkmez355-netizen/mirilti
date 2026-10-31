/**
 * Mırıltı — ana süreç giriş noktası.
 * Uygulamanın yaşam döngüsü: tek örnek kilidi, pencerelerin oluşturulması, tepsi.
 */
import { app } from 'electron'
import { createTray } from './tray'
import { createPlayerWindow, hasGoogleSession, markQuitting, playerEvents, showPlayerWindow } from './windows/player'
import { openLoginWindow } from './windows/login'

// Oynat komutları kullanıcı tıklaması olmadan da çalışabilsin (sayfa gizli pencerede).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
// Windows bildirimleri ve görev çubuğu gruplaması için kimlik
app.setAppUserModelId('com.mirilti.app')

// Aynı anda yalnızca bir Mırıltı çalışsın.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showPlayerWindow())
  app.whenReady().then(start).catch((err) => console.error('[main] başlatılamadı:', err))
}

async function start(): Promise<void> {
  createPlayerWindow()

  createTray({
    togglePlay: () => {},
    next: () => {},
    previous: () => {},
    toggleWidget: () => {},
    isWidgetVisible: () => false,
    openSettings: () => {},
    openPlayer: showPlayerWindow,
    openLogin: openLoginWindow,
    quit: () => app.quit()
  })

  const loggedIn = await hasGoogleSession()
  if (SMOKE_SECONDS) {
    runSmokeTest(loggedIn)
    return
  }
  // İlk açılışta (veya oturum yoksa) giriş penceresini aç
  if (!loggedIn) openLoginWindow()
}

/**
 * Geliştirici testi: MIRILTI_SMOKE=20 ile başlatılırsa giriş penceresi açılmaz,
 * birkaç saniye sonra durum konsola yazılır ve uygulama kapanır.
 */
const SMOKE_SECONDS = Number(process.env['MIRILTI_SMOKE'] ?? 0)

function runSmokeTest(loggedIn: boolean): void {
  console.log(`[smoke] google oturumu: ${loggedIn}`)
  playerEvents.on('loaded', () => console.log('[smoke] YouTube Music yüklendi'))
  playerEvents.on('offline', () => console.log('[smoke] çevrimdışı'))
  setTimeout(() => app.quit(), SMOKE_SECONDS * 1000)
}

// Pencereler kapansa da uygulama tepside çalışmaya devam eder.
app.on('window-all-closed', () => {
  /* bilerek boş: çıkış yalnızca tepsi menüsünden */
})

app.on('before-quit', () => markQuitting())
