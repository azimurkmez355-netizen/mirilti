/**
 * Widget penceresi: çerçevesiz, şeffaf, her zaman üstte, görev çubuğunda görünmeyen küçük pencere.
 *
 * İki çalışma modu var:
 *  1. Varsayılan (şeffaf kutu): Pencere açık hâlin en büyük boyutunda sabit kalır, animasyonu
 *     CSS yapar. Boş (şeffaf) alanlara gelen tıklamalar `setIgnoreMouseEvents(true, {forward:true})`
 *     ile arkadaki pencerelere geçer; arayüz fare bir öğenin üstüne gelince bunu kapatır.
 *  2. Yerel malzeme (Windows 11 Acrylic): Acrylic tüm pencereye uygulandığı için pencere,
 *     görünen şeklin (pill / oynatıcı / sekmeler) boyutuna göre yeniden boyutlanır.
 */
import os from 'node:os'
import { app, BrowserWindow, ipcMain, screen, type IpcMainEvent } from 'electron'
import { IPC } from '../../shared/ipc'
import type { Settings } from '../../shared/settings'
import type { Rect, WidgetView } from '../../shared/types'
import { loadRenderer, preloadPath } from '../paths'
import { computePlacement, positionFromPill, type Placement } from '../positioning'
import { getSettings, onSettingsChange, updateSettings } from '../store'
import { refreshTrayMenu } from '../tray'

let win: BrowserWindow | null = null
let quitting = false
app.on('before-quit', () => {
  quitting = true
})
let placement: Placement | null = null
let view: WidgetView = 'collapsed'
/** Kullanıcı tepsiden gizledi */
let userHidden = false
/** Tam ekran uygulama nedeniyle otomatik gizlendi */
let autoHidden = false
/** Sürükleme durumu: başlangıçtaki imleç ve pill konumu; sürerken ayarlar bellekte tutulur */
let drag: { cursor: Electron.Point; pill: { x: number; y: number }; position: Settings['position'] } | null = null

export function getWidgetWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null
}

/** Windows 11 22H2 (derleme 22621) ve sonrası yerel Acrylic/Mica destekler */
export function supportsNativeMaterial(): boolean {
  if (process.platform !== 'win32') return false
  const build = Number(os.release().split('.')[2] ?? 0)
  return build >= 22621
}

function useFitted(settings: Settings): boolean {
  return settings.appearance.nativeMaterial && supportsNativeMaterial()
}

export function createWidgetWindow(): BrowserWindow {
  const settings = getSettings()
  const fitted = useFitted(settings)
  placement = computePlacement(settings)
  view = 'collapsed'

  win = new BrowserWindow({
    ...placement.bounds,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    // Alt+Tab listesinde görünmesin
    type: 'toolbar',
    title: 'Mırıltı',
    backgroundColor: '#00000000',
    ...(fitted ? { transparent: false, backgroundMaterial: 'acrylic' as const } : { transparent: true }),
    webPreferences: {
      preload: preloadPath.app,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Açılış animasyonu gizliyken de hazır olsun; yine de boştayken CSS animasyonu yok
      backgroundThrottling: true
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  if (fitted) win.setBounds(fittedBounds())
  else win.setIgnoreMouseEvents(true, { forward: true })

  win.once('ready-to-show', () => syncVisibility())
  // Alt+F4 ya da Windows'un "kapat" komutu widget'ı yok etmesin: yalnızca uygulama kapanırken kapanır.
  win.on('close', (e) => {
    if (!quitting) e.preventDefault()
  })
  win.on('closed', () => {
    win = null
  })
  // Arayüz süreci çökerse widget'ı yeniden yükle (ekranda boşluk kalmasın)
  win.webContents.on('render-process-gone', () => {
    if (!quitting) setTimeout(recreate, 500)
  })
  void loadRenderer(win, 'widget')
  return win
}

/** Ayar değişince pencereyi yeniden oluşturmak gerekebilir (şeffaflık oluşturma anında seçilir) */
function recreate(): void {
  const old = getWidgetWindow()
  win = null
  // destroy(), 'close' olayını tetiklemeden pencereyi kaldırır
  old?.destroy()
  createWidgetWindow()
}

/** Yerleşimi yeniden hesapla ve uygula (ayar, monitör ya da ölçek değişince) */
export function applyPlacement(settings: Settings = getSettings()): void {
  const w = getWidgetWindow()
  if (!w) return
  placement = computePlacement(settings)
  setBoundsSafe(w, useFitted(settings) ? fittedBounds() : placement.bounds)
  w.webContents.send(IPC.widgetLayout, placement.layout)
}

/** Yerel malzeme modunda pencerenin o anki görünüme göre ekrandaki yeri */
function fittedBounds(): Rect {
  if (!placement) return { x: 0, y: 0, width: 1, height: 1 }
  const r = view === 'collapsed' ? placement.layout.pill : view === 'compact' ? placement.layout.compact : placement.layout.full
  return { x: placement.bounds.x + r.x, y: placement.bounds.y + r.y, width: r.width, height: r.height }
}

/**
 * Farklı ölçekli monitörler arasında taşırken Windows ilk setBounds'ta boyutu yanlış
 * ölçekleyebiliyor; bilinen geçici çözüm olarak boyut tutmazsa bir kez daha uygula.
 */
function setBoundsSafe(w: BrowserWindow, bounds: Rect): void {
  w.setBounds(bounds)
  const b = w.getBounds()
  if (b.width !== bounds.width || b.height !== bounds.height) w.setBounds(bounds)
}

// --- Görünürlük ---

function syncVisibility(): void {
  const w = getWidgetWindow()
  if (!w) return
  const shouldShow = !userHidden && !autoHidden
  if (shouldShow && !w.isVisible()) w.showInactive()
  else if (!shouldShow && w.isVisible()) w.hide()
  refreshTrayMenu()
}

export function isWidgetVisible(): boolean {
  return !userHidden
}

export function toggleWidgetVisible(): void {
  userHidden = !userHidden
  syncVisibility()
}

export function setAutoHidden(hidden: boolean): void {
  if (autoHidden === hidden) return
  autoHidden = hidden
  syncVisibility()
}

/** Kısayol tuşu: widget'ı aç/kapat (gizliyse önce göster) */
export function toggleWidgetOpen(): void {
  const w = getWidgetWindow()
  if (!w) return
  if (userHidden) {
    userHidden = false
    syncVisibility()
  }
  w.webContents.send(IPC.widgetToggle)
}

/** Ayarlar açıkken canlı önizleme için widget'ı açık tut */
export function pinWidgetOpen(pinned: boolean): void {
  getWidgetWindow()?.webContents.send(IPC.widgetPinOpen, pinned)
}

// --- IPC ---

function fromWidget(e: IpcMainEvent | Electron.IpcMainInvokeEvent): boolean {
  const w = getWidgetWindow()
  return !!w && e.sender === w.webContents
}

export function initWidgetIpc(): void {
  ipcMain.handle(IPC.widgetGetLayout, () => {
    placement ??= computePlacement(getSettings())
    return placement.layout
  })

  ipcMain.on(IPC.widgetSetIgnoreMouse, (e, ignore: unknown) => {
    if (!fromWidget(e) || useFitted(getSettings())) return
    getWidgetWindow()?.setIgnoreMouseEvents(ignore === true, { forward: true })
  })

  ipcMain.on(IPC.widgetSetView, (e, next: unknown) => {
    if (!fromWidget(e) || (next !== 'collapsed' && next !== 'compact' && next !== 'full')) return
    view = next
    const w = getWidgetWindow()
    if (w && useFitted(getSettings())) setBoundsSafe(w, fittedBounds())
  })

  ipcMain.on(IPC.widgetDragStart, (e) => {
    if (!fromWidget(e) || !placement) return
    const settings = getSettings()
    drag = {
      cursor: screen.getCursorScreenPoint(),
      pill: { x: placement.bounds.x + placement.layout.pill.x, y: placement.bounds.y + placement.layout.pill.y },
      position: settings.position
    }
  })

  ipcMain.on(IPC.widgetDragMove, (e) => {
    if (!fromWidget(e) || !drag) return
    const cursor = screen.getCursorScreenPoint()
    const x = drag.pill.x + cursor.x - drag.cursor.x
    const y = drag.pill.y + cursor.y - drag.cursor.y
    const settings = getSettings()
    drag.position = positionFromPill(settings, x, y, cursor)
    // Diske yazmadan, geçici ayarla yeniden yerleştir
    applyPlacement({ ...settings, position: drag.position })
  })

  ipcMain.on(IPC.widgetDragEnd, (e) => {
    if (!fromWidget(e) || !drag) return
    const position = drag.position
    drag = null
    updateSettings({ position })
  })

  onSettingsChange((next, prev) => {
    if (next.appearance.nativeMaterial !== prev.appearance.nativeMaterial) {
      recreate()
      return
    }
    if (drag) return
    if (
      JSON.stringify(next.position) !== JSON.stringify(prev.position) ||
      next.appearance.size !== prev.appearance.size ||
      next.appearance.scale !== prev.appearance.scale
    ) {
      applyPlacement(next)
    }
  })

  // Monitör takılıp çıkarılınca, çözünürlük ya da ölçek değişince konumu tazele
  const refresh = (): void => applyPlacement()
  screen.on('display-added', refresh)
  screen.on('display-removed', refresh)
  screen.on('display-metrics-changed', refresh)
}
