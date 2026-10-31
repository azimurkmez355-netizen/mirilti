/**
 * Widget penceresi (Aşama 2: basit sürüm — sağ kenarda sabit küçük pencere).
 */
import { BrowserWindow, screen } from 'electron'
import { loadRenderer, preloadPath } from '../paths'

let win: BrowserWindow | null = null

export function getWidgetWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

export function createWidgetWindow(): BrowserWindow {
  const area = screen.getPrimaryDisplay().workArea
  const width = 340
  const height = 132
  win = new BrowserWindow({
    width,
    height,
    x: area.x + area.width - width - 12,
    y: area.y + Math.round((area.height - height) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: preloadPath.app,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.once('ready-to-show', () => win?.showInactive())
  void loadRenderer(win, 'widget')
  return win
}
