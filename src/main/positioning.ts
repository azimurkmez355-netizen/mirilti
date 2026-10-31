/**
 * Widget yerleşim hesapları.
 *
 * Widget penceresi, açık hâlin en büyük boyutunu (oynatıcı + sekmeler) kapsayan sabit bir
 * kutudur. İçinde üç dikdörtgen vardır:
 *   pill    → daraltılmış hâl (kapak + ses dalgası)
 *   compact → açık hâl, yalnız oynatıcı
 *   full    → açık hâl, oynatıcı + sekme içeriği
 * Her zaman pill ⊂ compact ⊂ full olacak şekilde hesaplanır; böylece arayüz tek bir yüzeyi
 * `clip-path` ile kırparak akıcı bir "açılma" animasyonu yapabilir ve pencereyi her karede
 * yeniden boyutlandırmak (Windows'ta takılır) gerekmez.
 *
 * Tüm ölçüler DIP (cihazdan bağımsız piksel) cinsindendir; Electron bunları her monitörün
 * ölçeğine (%100, %150…) göre kendisi çevirir. Konumlar çalışma alanına (görev çubuğu hariç)
 * ORANLA saklandığı için çözünürlük değişse de widget doğru yerde kalır.
 */
import { screen, type Display } from 'electron'
import { sizeScale, type DockMode, type Settings } from '../shared/settings'
import type { DockSide, Rect, WidgetLayout } from '../shared/types'

/** Ölçeksiz temel ölçüler (ölçek 1 = "orta" boy) */
const BASE = {
  panelWidth: 340,
  compactHeight: 212,
  fullHeight: 540,
  pillVertical: { width: 54, height: 108 },
  pillHorizontal: { width: 172, height: 46 },
  bubble: { width: 62, height: 62 },
  /** Köşe ve yüzen modlarda ekran kenarından boşluk */
  margin: 14,
  /** Gölge için çevrede bırakılan şeffaf alan */
  shadow: 28
}

export interface Placement {
  display: Display
  /** Pencerenin ekrandaki yeri */
  bounds: Rect
  layout: WidgetLayout
}

export function widgetScale(settings: Settings): number {
  return sizeScale[settings.appearance.size] * settings.appearance.scale
}

export function pickDisplay(displayId: number | null): Display {
  if (displayId !== null) {
    const found = screen.getAllDisplays().find((d) => d.id === displayId)
    if (found) return found
  }
  return screen.getPrimaryDisplay()
}

/** Ayarlardan yerleşimi hesaplar (isteğe bağlı olarak belirli bir monitör için) */
export function computePlacement(settings: Settings, display = pickDisplay(settings.position.displayId)): Placement {
  const wa = display.workArea
  const s = widgetScale(settings)
  const mode = settings.position.mode
  const m = Math.round(BASE.margin * s)

  const panelW = Math.round(BASE.panelWidth * s)
  const compactH = Math.min(Math.round(BASE.compactHeight * s), wa.height - 2 * m)
  const fullH = Math.min(Math.round(BASE.fullHeight * s), wa.height - 2 * m)

  // --- 1. Pill ---
  const { side, shape } = dockInfo(mode)
  const pillBase = shape === 'vertical' ? BASE.pillVertical : shape === 'horizontal' ? BASE.pillHorizontal : BASE.bubble
  const pw = Math.round(pillBase.width * s)
  const ph = Math.round(pillBase.height * s)
  const offset = clamp01(settings.position.edgeOffset)
  let pill: Rect
  switch (mode) {
    case 'edge-right':
      pill = { x: wa.x + wa.width - pw, y: wa.y + Math.round(offset * (wa.height - ph)), width: pw, height: ph }
      break
    case 'edge-left':
      pill = { x: wa.x, y: wa.y + Math.round(offset * (wa.height - ph)), width: pw, height: ph }
      break
    case 'edge-top':
      pill = { x: wa.x + Math.round(offset * (wa.width - pw)), y: wa.y, width: pw, height: ph }
      break
    case 'edge-bottom':
      pill = { x: wa.x + Math.round(offset * (wa.width - pw)), y: wa.y + wa.height - ph, width: pw, height: ph }
      break
    case 'corner-top-left':
      pill = { x: wa.x + m, y: wa.y + m, width: pw, height: ph }
      break
    case 'corner-top-right':
      pill = { x: wa.x + wa.width - pw - m, y: wa.y + m, width: pw, height: ph }
      break
    case 'corner-bottom-left':
      pill = { x: wa.x + m, y: wa.y + wa.height - ph - m, width: pw, height: ph }
      break
    case 'corner-bottom-right':
      pill = { x: wa.x + wa.width - pw - m, y: wa.y + wa.height - ph - m, width: pw, height: ph }
      break
    case 'floating':
    default:
      pill = {
        x: wa.x + Math.round(clamp01(settings.position.floatX) * (wa.width - pw)),
        y: wa.y + Math.round(clamp01(settings.position.floatY) * (wa.height - ph)),
        width: pw,
        height: ph
      }
  }

  // --- 2. Açık hâller ---
  const compact = panelRect(mode, wa, pill, panelW, compactH, m)
  const full = fullRect(mode, wa, pill, compact, fullH, m)

  // --- 3. Pencere kutusu: hepsini kapsayan alan + gölge payı (çalışma alanından taşmadan) ---
  const union = unionRect(pill, full)
  const pad = Math.round(BASE.shadow * s)
  const box = intersectRect(
    { x: union.x - pad, y: union.y - pad, width: union.width + 2 * pad, height: union.height + 2 * pad },
    wa
  )

  const rel = (r: Rect): Rect => ({ x: r.x - box.x, y: r.y - box.y, width: r.width, height: r.height })
  return {
    display,
    bounds: box,
    layout: {
      pill: rel(pill),
      compact: rel(compact),
      full: rel(full),
      side,
      pillShape: shape,
      growsUp: opensUpward(mode, wa, pill),
      scale: s,
      fitted: settings.appearance.nativeMaterial
    }
  }
}

function dockInfo(mode: DockMode): { side: DockSide; shape: WidgetLayout['pillShape'] } {
  switch (mode) {
    case 'edge-right': return { side: 'right', shape: 'vertical' }
    case 'edge-left': return { side: 'left', shape: 'vertical' }
    case 'edge-top': return { side: 'top', shape: 'horizontal' }
    case 'edge-bottom': return { side: 'bottom', shape: 'horizontal' }
    default: return { side: 'none', shape: 'bubble' }
  }
}

/** Yalnız oynatıcı görünümü: kenar modlarında kenara yapışık, pill'i ortalar */
function panelRect(mode: DockMode, wa: Rect, pill: Rect, w: number, h: number, m: number): Rect {
  const cx = pill.x + pill.width / 2
  const cy = pill.y + pill.height / 2
  const clampX = (x: number): number => clamp(x, wa.x, wa.x + wa.width - w)
  const clampY = (y: number): number => clamp(y, wa.y, wa.y + wa.height - h)
  switch (mode) {
    case 'edge-right': return { x: wa.x + wa.width - w, y: clampY(Math.round(cy - h / 2)), width: w, height: h }
    case 'edge-left': return { x: wa.x, y: clampY(Math.round(cy - h / 2)), width: w, height: h }
    case 'edge-top': return { x: clampX(Math.round(cx - w / 2)), y: wa.y, width: w, height: h }
    case 'edge-bottom': return { x: clampX(Math.round(cx - w / 2)), y: wa.y + wa.height - h, width: w, height: h }
    case 'corner-top-left': return { x: wa.x + m, y: wa.y + m, width: w, height: h }
    case 'corner-top-right': return { x: wa.x + wa.width - w - m, y: wa.y + m, width: w, height: h }
    case 'corner-bottom-left': return { x: wa.x + m, y: wa.y + wa.height - h - m, width: w, height: h }
    case 'corner-bottom-right': return { x: wa.x + wa.width - w - m, y: wa.y + wa.height - h - m, width: w, height: h }
    default: {
      // Yüzen: ekranın ortasına doğru açıl
      const left = cx < wa.x + wa.width / 2
      const top = cy < wa.y + wa.height / 2
      return {
        x: clampX(left ? pill.x : pill.x + pill.width - w),
        y: clampY(top ? pill.y : pill.y + pill.height - h),
        width: w,
        height: h
      }
    }
  }
}

/** Sekmeli görünüm: oynatıcının bulunduğu yerden aşağı (alt kenar modlarında yukarı) uzar */
function fullRect(mode: DockMode, wa: Rect, pill: Rect, compact: Rect, h: number, m: number): Rect {
  const growsUp = opensUpward(mode, wa, pill)
  const minY = mode.startsWith('corner') || mode === 'floating' ? wa.y + m : wa.y
  const maxBottom = mode.startsWith('corner') || mode === 'floating' ? wa.y + wa.height - m : wa.y + wa.height
  let y = growsUp ? compact.y + compact.height - h : compact.y
  y = clamp(y, minY, maxBottom - h)
  return { x: compact.x, y, width: compact.width, height: h }
}

/** Sekme alanı oynatıcının üstünde mi açılır? (arayüz de bunu kullanır) */
export function opensUpward(mode: DockMode, wa: Rect, pill: Rect): boolean {
  if (mode === 'edge-bottom' || mode === 'corner-bottom-left' || mode === 'corner-bottom-right') return true
  if (mode === 'floating') return pill.y + pill.height / 2 > wa.y + wa.height / 2
  return false
}

/**
 * Sürükleme: pill'in yeni sol-üst köşesinden kenar/yüzen konum ayarlarını üretir.
 * Kenar modunda yalnızca kenar boyunca kayar; yüzen modda serbesttir ve monitör değiştirebilir.
 */
export function positionFromPill(settings: Settings, pillX: number, pillY: number, cursor: Electron.Point): Settings['position'] {
  const pos = { ...settings.position }
  const mode = pos.mode
  if (mode.startsWith('corner')) return pos

  const display = mode === 'floating' ? screen.getDisplayNearestPoint(cursor) : pickDisplay(pos.displayId)
  const wa = display.workArea
  const current = computePlacement(settings, display)
  const pw = current.layout.pill.width
  const ph = current.layout.pill.height

  if (mode === 'edge-left' || mode === 'edge-right') {
    pos.edgeOffset = clamp01((pillY - wa.y) / Math.max(1, wa.height - ph))
  } else if (mode === 'edge-top' || mode === 'edge-bottom') {
    pos.edgeOffset = clamp01((pillX - wa.x) / Math.max(1, wa.width - pw))
  } else {
    pos.floatX = clamp01((pillX - wa.x) / Math.max(1, wa.width - pw))
    pos.floatY = clamp01((pillY - wa.y) / Math.max(1, wa.height - ph))
    pos.displayId = display.id === screen.getPrimaryDisplay().id ? null : display.id
  }
  return pos
}

// --- küçük yardımcılar ---
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
function clamp01(v: number): number {
  return clamp(Number.isFinite(v) ? v : 0.5, 0, 1)
}
function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }
}
function intersectRect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(1, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(1, Math.min(a.y + a.height, b.y + b.height) - y)
  }
}
