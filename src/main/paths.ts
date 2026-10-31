/**
 * Derlenmiş dosyaların yolları. Geliştirme modunda arayüz Vite sunucusundan,
 * paketlenmiş uygulamada diskteki HTML dosyalarından yüklenir.
 */
import { join } from 'node:path'
import { app, nativeImage, type BrowserWindow } from 'electron'

/** out/main klasörü (bu dosyanın derlendiği yer) */
const mainDir = __dirname

export const preloadPath = {
  ytm: join(mainDir, '../preload/ytm.js'),
  ytmAdapter: join(mainDir, '../preload/ytm-adapter.js'),
  app: join(mainDir, '../preload/app.js')
}

/** Arayüz sayfasını yükler: 'widget' | 'settings' */
export function loadRenderer(win: BrowserWindow, page: 'widget' | 'settings'): Promise<void> {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    return win.loadURL(`${devUrl}/${page}/index.html`)
  }
  return win.loadFile(join(mainDir, `../renderer/${page}/index.html`))
}

/** resources/ klasöründeki dosya (paketlenince process.resourcesPath altına kopyalanır) */
export function resourcePath(file: string): string {
  return app.isPackaged ? join(process.resourcesPath, file) : join(app.getAppPath(), 'resources', file)
}

export function appIcon(): Electron.NativeImage {
  return nativeImage.createFromPath(resourcePath('icon.png'))
}
