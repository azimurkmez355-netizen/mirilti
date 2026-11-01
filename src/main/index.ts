/**
 * Mırıltı — ana süreç giriş noktası.
 * Uygulamanın yaşam döngüsü: tek örnek kilidi, pencerelerin oluşturulması, modüllerin bağlanması.
 */
import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import { IPC } from '../shared/ipc'
import type { CoverPalette } from '../shared/types'
import { extractPalette } from './colors'
import { initLyrics } from './lyrics'
import { bridgeEvents, broadcast, getPlayerState, initPlayerBridge, sendCommand } from './player-bridge'
import { initFullscreenWatcher } from './fullscreen'
import { initSettingsIpc } from './settings-ipc'
import { initShortcuts } from './shortcuts'
import { initSystemIntegration } from './system'
import { flushSettings } from './store'
import { runSmokeTest, smokeSeconds } from './smoke'
import { createTray, updateTray } from './tray'
import { openLoginWindow } from './windows/login'
import { createPlayerWindow, hasGoogleSession, markQuitting, reloadPlayer, showPlayerWindow } from './windows/player'
import { openSettingsWindow } from './windows/settings'
import { createWidgetWindow, initWidgetIpc, isWidgetVisible, pinWidgetOpen, toggleWidgetVisible } from './windows/widget'

// Smoke testi ayrı bir veri klasörü kullanır: çalışan Mırıltı'ya, ayarlara ve Google oturumuna dokunmaz.
// (Tek örnek kilidi de veri klasörüne bağlı olduğu için kurulu sürüm açıkken test çalışabilir.)
if (smokeSeconds()) app.setPath('userData', join(app.getPath('temp'), 'mirilti-smoke'))

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
  initLyrics()

  ipcMain.on(IPC.appOpenLogin, () => openLoginWindow())
  ipcMain.on(IPC.appOpenPlayer, () => showPlayerWindow())
  ipcMain.on(IPC.appReloadPlayer, () => reloadPlayer())
  ipcMain.on(IPC.appOpenSettings, () => openSettingsWindow())
  ipcMain.on(IPC.appPreviewWidget, (_e, pinned: unknown) => pinWidgetOpen(pinned === true))

  createPlayerWindow()
  createWidgetWindow()
  initShortcuts()
  initFullscreenWatcher()
  initSystemIntegration()

  createTray({
    togglePlay: () => void sendCommand({ type: 'togglePlay' }),
    next: () => void sendCommand({ type: 'next' }),
    previous: () => void sendCommand({ type: 'previous' }),
    toggleWidget: toggleWidgetVisible,
    isWidgetVisible,
    openSettings: openSettingsWindow,
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

app.on('before-quit', () => {
  markQuitting()
  flushSettings()
})
