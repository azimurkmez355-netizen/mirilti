/**
 * Ayarlar penceresi: normal, çerçeveli pencere. Aynı anda yalnızca bir tane açılır.
 * Kapatılınca widget'ın "önizleme için açık tut" durumu da kaldırılır.
 */
import { BrowserWindow, shell } from 'electron'
import { appIcon, loadRenderer, preloadPath } from '../paths'
import { pinWidgetOpen } from './widget'

let win: BrowserWindow | null = null

export function getSettingsWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

export function openSettingsWindow(): void {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    return
  }

  win = new BrowserWindow({
    width: 860,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    title: 'Mırıltı – Ayarlar',
    icon: appIcon(),
    autoHideMenuBar: true,
    backgroundColor: '#111116',
    show: false,
    webPreferences: {
      preload: preloadPath.app,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win?.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.on('closed', () => {
    win = null
    pinWidgetOpen(false)
  })
  void loadRenderer(win, 'settings')
}
