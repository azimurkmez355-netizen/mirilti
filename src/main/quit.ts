/**
 * Uygulamadan tamamen çıkış.
 *
 * Normal app.quit() pencereleri "kapatmayı" dener; ama gizli YouTube Music sayfası müzik
 * çalarken kapanmayı engelleyebiliyor ve widget de kapatılmaya karşı korunuyor. Bu yüzden
 * burada pencereler doğrudan yok edilir (destroy: hiçbir olay ya da sayfa engeli çalışmaz).
 * Yine de bir şey takılırsa kısa süre sonra süreç zorla sonlandırılır.
 */
import { app, BrowserWindow, globalShortcut } from 'electron'
import { flushSettings } from './store'
import { destroyTray } from './tray'
import { markQuitting } from './windows/player'

const FORCE_EXIT_MS = 2000
let exiting = false

export function quitApp(): void {
  if (exiting) return
  exiting = true
  markQuitting()
  try {
    flushSettings()
    globalShortcut.unregisterAll()
    destroyTray()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.destroy()
    }
  } catch (err) {
    console.error('[quit] temizlik sırasında hata:', err)
  }
  // Son güvence: normal çıkış takılırsa süreci sonlandır
  setTimeout(() => app.exit(0), FORCE_EXIT_MS).unref()
  app.quit()
}
