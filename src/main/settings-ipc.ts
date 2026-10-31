/**
 * Ayarlarla ilgili IPC uçları: oku, değiştir, sıfırla, dışa/içe aktar.
 * Her değişiklik tüm pencerelere yayınlanır (canlı önizleme).
 */
import { readFile, writeFile } from 'node:fs/promises'
import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
import { IPC, type Result, type SystemInfo } from '../shared/ipc'
import { defaultSettings, type SettingsPatch } from '../shared/settings'
import { broadcast } from './player-bridge'
import { getSettings, onSettingsChange, replaceSettings, updateSettings } from './store'
import { supportsNativeMaterial } from './windows/widget'

/** Kısayol modülü kaydedilemeyen kısayolları buraya yazar */
let shortcutErrors: string[] = []
export function setShortcutErrors(errors: string[]): void {
  shortcutErrors = errors
}

export function initSettingsIpc(): void {
  ipcMain.handle(IPC.settingsGet, () => getSettings())
  ipcMain.handle(IPC.settingsSet, (_e, patch: SettingsPatch) => updateSettings(patch))
  ipcMain.handle(IPC.settingsReset, () => replaceSettings(defaultSettings))

  ipcMain.handle(IPC.settingsExport, async (e): Promise<Result<string | null>> => {
    try {
      const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined
      const opts = {
        title: 'Ayarları dışa aktar',
        defaultPath: 'mirilti-ayarlar.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      }
      const { canceled, filePath } = parent ? await dialog.showSaveDialog(parent, opts) : await dialog.showSaveDialog(opts)
      if (canceled || !filePath) return { ok: true, data: null }
      await writeFile(filePath, JSON.stringify(getSettings(), null, 2), 'utf8')
      return { ok: true, data: filePath }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.settingsImport, async (e) => {
    try {
      const parent = BrowserWindow.fromWebContents(e.sender) ?? undefined
      const opts = {
        title: 'Ayarları içe aktar',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile' as const]
      }
      const { canceled, filePaths } = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts)
      if (canceled || !filePaths[0]) return { ok: true, data: null }
      const parsed: unknown = JSON.parse(await readFile(filePaths[0], 'utf8'))
      // Varsayılanlarla birleştirilir: bilinmeyen/hatalı alanlar yok sayılır
      return { ok: true, data: replaceSettings(parsed) }
    } catch (err) {
      return { ok: false, error: `Dosya okunamadı: ${err instanceof Error ? err.message : String(err)}` }
    }
  })

  ipcMain.handle(IPC.systemInfo, (): SystemInfo => {
    const primary = screen.getPrimaryDisplay().id
    return {
      displays: screen.getAllDisplays().map((d, i) => ({
        id: d.id,
        label: `${d.label || `Ekran ${i + 1}`} — ${d.size.width}×${d.size.height} (%${Math.round(d.scaleFactor * 100)})`,
        primary: d.id === primary
      })),
      shortcutErrors,
      supportsNativeMaterial: supportsNativeMaterial(),
      isPackaged: app.isPackaged,
      version: app.getVersion()
    }
  })

  onSettingsChange((next) => broadcast(IPC.settingsChanged, next))
}
