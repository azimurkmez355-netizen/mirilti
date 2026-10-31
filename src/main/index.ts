/**
 * Mırıltı — ana süreç giriş noktası.
 * Uygulamanın yaşam döngüsü: tek örnek kilidi, pencerelerin oluşturulması, modüllerin bağlanması.
 */
import { app, ipcMain } from 'electron'
import { IPC } from '../shared/ipc'
import type { CoverPalette } from '../shared/types'
import { extractPalette } from './colors'
import { bridgeEvents, broadcast, getPlayerState, initPlayerBridge, sendCommand } from './player-bridge'
import { initSettingsIpc } from './settings-ipc'
import { runSmokeTest, smokeSeconds } from './smoke'
import { createTray, updateTray } from './tray'
import { openLoginWindow } from './windows/login'
import { createPlayerWindow, hasGoogleSession, markQuitting, reloadPlayer, showPlayerWindow } from './windows/player'
import { createWidgetWindow, initWidgetIpc, isWidgetVisible, toggleWidgetVisible } from './windows/widget'

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
  initSettingsIpc()
  initWidgetIpc()
  initPalette()

  ipcMain.on(IPC.appOpenLogin, () => openLoginWindow())
  ipcMain.on(IPC.appOpenPlayer, () => showPlayerWindow())
  ipcMain.on(IPC.appReloadPlayer, () => reloadPlayer())

  createPlayerWindow()
  createWidgetWindow()

  createTray({
    togglePlay: () => void sendCommand({ type: 'togglePlay' }),
    next: () => void sendCommand({ type: 'next' }),
    previous: () => void sendCommand({ type: 'previous' }),
    toggleWidget: toggleWidgetVisible,
    isWidgetVisible,
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

/** Şarkı değişince kapaktan renk paletini çıkar ve arayüzlere gönder */
function initPalette(): void {
  let last: CoverPalette | null = null
  bridgeEvents.on('track', async (track: { coverUrl: string } | null) => {
    const palette = track ? await extractPalette(track.coverUrl) : null
    // Bu arada şarkı yine değiştiyse eski sonucu gönderme
    if (getPlayerState().track?.coverUrl !== track?.coverUrl) return
    last = palette
    broadcast(IPC.playerPalette, palette)
  })
  // Yeni açılan pencere son paleti hemen alsın
  app.on('browser-window-created', (_e, win) => {
    win.webContents.on('did-finish-load', () => win.webContents.send(IPC.playerPalette, last))
  })
}

// Pencereler kapansa da uygulama tepside çalışmaya devam eder.
app.on('window-all-closed', () => {
  /* bilerek boş: çıkış yalnızca tepsi menüsünden */
})

app.on('before-quit', () => markQuitting())
