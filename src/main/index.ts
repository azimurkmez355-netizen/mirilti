/**
 * Mırıltı — ana süreç giriş noktası.
 * Uygulamanın yaşam döngüsü: tek örnek kilidi, pencerelerin oluşturulması, tepsi.
 */
import { app, ipcMain } from 'electron'
import { IPC } from '../shared/ipc'
import { createTray, updateTray } from './tray'
import { bridgeEvents, initPlayerBridge, sendCommand } from './player-bridge'
import { createPlayerWindow, hasGoogleSession, markQuitting, reloadPlayer, showPlayerWindow } from './windows/player'
import { openLoginWindow } from './windows/login'
import { createWidgetWindow, getWidgetWindow } from './windows/widget'
import { runSmokeTest, smokeSeconds } from './smoke'

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
  initPlayerBridge()
  createPlayerWindow()
  createWidgetWindow()

  ipcMain.on(IPC.appOpenLogin, () => openLoginWindow())
  ipcMain.on(IPC.appOpenPlayer, () => showPlayerWindow())
  ipcMain.on(IPC.appReloadPlayer, () => reloadPlayer())

  createTray({
    togglePlay: () => void sendCommand({ type: 'togglePlay' }),
    next: () => void sendCommand({ type: 'next' }),
    previous: () => void sendCommand({ type: 'previous' }),
    toggleWidget: () => {
      const w = getWidgetWindow()
      if (w?.isVisible()) w.hide()
      else w?.showInactive()
    },
    isWidgetVisible: () => !!getWidgetWindow()?.isVisible(),
    openSettings: () => {},
    openPlayer: showPlayerWindow,
    openLogin: openLoginWindow,
    quit: () => app.quit()
  })
  bridgeEvents.on('state', updateTray)

  const loggedIn = await hasGoogleSession()
  if (smokeSeconds()) {
    runSmokeTest(loggedIn)
    return
  }
  // İlk açılışta (veya oturum yoksa) giriş penceresini aç
  if (!loggedIn) openLoginWindow()
}

// Pencereler kapansa da uygulama tepside çalışmaya devam eder.
app.on('window-all-closed', () => {
  /* bilerek boş: çıkış yalnızca tepsi menüsünden */
})

app.on('before-quit', () => markQuitting())
