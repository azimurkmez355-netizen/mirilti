/**
 * Widget kök bileşeni.
 *
 * Tek bir "yüzey" (surface) en büyük açık hâlin (full) boyutundadır; görünen kısım
 * `clip-path: inset(...)` ile pill → oynatıcı → sekmeler arasında kırpılır. clip-path
 * tıklama alanını da kırptığı için şeffaf kısımlara gelen tıklamalar arkadaki pencereye geçer.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Settings } from '../../shared/settings'
import type { CoverPalette, PlayerState, Rect, WidgetLayout, WidgetView } from '../../shared/types'
import { useLayout, usePalette, usePlayerState, useSettings } from '../common/hooks'
import { themeVars } from '../common/theme'
import { Backdrop } from './components/Backdrop'
import { Pill } from './components/Pill'
import { Player } from './components/Player'
import { TabContent, type TabId } from './components/TabContent'

export function App(): React.JSX.Element | null {
  const settings = useSettings()
  const layout = useLayout()
  const state = usePlayerState()
  const palette = usePalette()
  if (!settings || !layout) return null
  return <Widget settings={settings} layout={layout} state={state} palette={palette} />
}

interface WidgetProps {
  settings: Settings
  layout: WidgetLayout
  state: PlayerState
  palette: CoverPalette | null
}

function Widget({ settings, layout, state, palette }: WidgetProps): React.JSX.Element {
  const [view, setView] = useState<WidgetView>('collapsed')
  const [tab, setTab] = useState<TabId | null>(null)
  const [pinned, setPinned] = useState(false)
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const expanded = view !== 'collapsed'
  const { trigger } = settings

  // Ana süreç (yerel malzeme modunda pencere boyutu için) görünümü bilsin
  useEffect(() => window.mirilti.setView(view), [view])

  const clearTimers = (): void => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }

  const open = useCallback((): void => {
    clearTimers()
    setView((v) => (v === 'collapsed' ? (tab ? 'full' : 'compact') : v))
  }, [tab])

  const close = useCallback((): void => {
    clearTimers()
    setView('collapsed')
  }, [])

  // Ayarlar penceresinden "önizleme için açık tut"
  useEffect(() => window.mirilti.onPinOpen(setPinned), [])
  useEffect(() => {
    if (pinned) open()
  }, [pinned, open])

  // Kısayol tuşu
  useEffect(
    () =>
      window.mirilti.onToggle(() => {
        if (!trigger.hotkey) return
        setView((v) => (v === 'collapsed' ? (tab ? 'full' : 'compact') : 'collapsed'))
      }),
    [trigger.hotkey, tab]
  )

  // Yalnız tıklama tetikleyicisinde: pencere odağı kaybedince (dışarı tıklanınca) kapan
  useEffect(() => {
    if (trigger.hover) return
    const onBlur = (): void => {
      if (!pinned) close()
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [trigger.hover, pinned, close])

  // --- Tıklama geçirgenliği: fare bir öğenin üstünde değilse tıklamalar arkaya geçsin ---
  useEffect(() => {
    if (layout.fitted) return
    let ignoring = true
    const set = (ignore: boolean): void => {
      if (ignore === ignoring) return
      ignoring = ignore
      window.mirilti.setIgnoreMouse(ignore)
    }
    const onMove = (e: MouseEvent): void => {
      if (draggingRef.current) return set(false)
      const el = document.elementFromPoint(e.clientX, e.clientY)
      set(!el?.closest('[data-hit]'))
    }
    const onLeave = (): void => {
      if (!draggingRef.current) set(true)
    }
    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
    }
  }, [layout.fitted])

  // --- Hover ---
  const onPointerEnter = (): void => {
    window.clearTimeout(closeTimer.current)
    if (!trigger.hover || expanded || draggingRef.current) return
    window.clearTimeout(openTimer.current)
    openTimer.current = window.setTimeout(open, trigger.openDelay)
  }

  const onPointerLeave = (): void => {
    window.clearTimeout(openTimer.current)
    if (!trigger.hover || !expanded || pinned) return
    // Arama kutusuna yazı yazılıyorsa kapanmasın
    const active = document.activeElement
    if (active instanceof HTMLInputElement && active.type === 'text' && active.value) return
    closeTimer.current = window.setTimeout(close, trigger.closeDelay)
  }

  // Fare tekerleğiyle ses
  const onWheel = (e: React.WheelEvent): void => {
    if ((e.target as Element).closest('[data-scroll]')) return // listeleri kaydırırken değil
    const delta = e.deltaY < 0 ? 5 : -5
    void window.mirilti.command({ type: 'setVolume', volume: Math.max(0, Math.min(100, state.volume + delta)) })
  }

  const selectTab = (id: TabId): void => {
    if (view === 'full' && tab === id) {
      setView('compact')
      setTab(null)
    } else {
      setTab(id)
      setView('full')
    }
  }

  // --- Geometri: tüm ölçüler CSS pikseline (ölçeksiz) çevrilir; ölçek `zoom` ile uygulanır ---
  const k = 1 / layout.scale
  const full = scaleRect(layout.full, k)
  const pill = scaleRect(layout.pill, k)
  const compact = scaleRect(layout.compact, k)
  const active = view === 'collapsed' ? pill : view === 'compact' ? compact : full

  const radius = settings.appearance.radius
  const clip = insetClip(full, active, cornerRadii(layout, view, radius, pill))
  const playerHeight = compact.height
  // Oynatıcı bölümünün yüzey içindeki dikey yeri
  const playerTop = view === 'full' ? (layout.growsUp ? full.height - playerHeight : 0) : compact.y - full.y

  // Yerel malzeme modunda pencere yalnızca etkin dikdörtgen kadardır: sahneyi kaydır
  const stageShift = layout.fitted ? { transform: `translate(${-active.x}px, ${-active.y}px)` } : undefined

  const rootStyle: CSSProperties = {
    ...themeVars(settings, palette),
    zoom: layout.scale
  }

  return (
    <div className={`root scheme-${settings.appearance.colorScheme} ${layout.fitted ? 'fitted' : ''}`} style={rootStyle}>
      <div className="stage" style={stageShift}>
        <div className="shadow-wrap" style={rectStyle(full)}>
          <div
            ref={surfaceRef}
            className={`surface view-${view}`}
            data-hit
            style={{ clipPath: clip }}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onWheel={onWheel}
          >
            <Backdrop coverUrl={state.track?.coverUrl ?? ''} fitted={layout.fitted} />

            <Pill
              layout={layout}
              rect={offsetRect(pill, full)}
              state={state}
              visible={!expanded}
              draggable={settings.position.mode === 'floating' || settings.position.mode.startsWith('edge')}
              onDragChange={(d) => {
                draggingRef.current = d
                if (d) clearTimers()
              }}
              onClick={() => {
                if (!trigger.click) return
                if (expanded) close()
                else open()
              }}
            />

            <div
              className="player-slot"
              style={{ top: 0, height: playerHeight, transform: `translateY(${playerTop}px)`, opacity: expanded ? 1 : 0 }}
              aria-hidden={!expanded}
            >
              <Player
                state={state}
                settings={settings}
                active={expanded}
                tab={view === 'full' ? tab : null}
                onSelectTab={selectTab}
              />
            </div>

            <div
              className="tab-slot"
              style={{
                top: layout.growsUp ? 0 : playerHeight,
                height: full.height - playerHeight,
                opacity: view === 'full' ? 1 : 0
              }}
              aria-hidden={view !== 'full'}
            >
              <TabContent tab={tab} state={state} active={view === 'full'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- geometri yardımcıları ---

function scaleRect(r: Rect, k: number): Rect {
  return { x: r.x * k, y: r.y * k, width: r.width * k, height: r.height * k }
}

/** r'yi kapsayıcı c'ye göre göreli yap */
function offsetRect(r: Rect, c: Rect): Rect {
  return { x: r.x - c.x, y: r.y - c.y, width: r.width, height: r.height }
}

function rectStyle(r: Rect): CSSProperties {
  return { left: r.x, top: r.y, width: r.width, height: r.height }
}

type Radii = [number, number, number, number] // sol-üst, sağ-üst, sağ-alt, sol-alt

/** Ekran kenarına yapışık köşeler düz, diğerleri yuvarlak */
function cornerRadii(layout: WidgetLayout, view: WidgetView, radius: number, pill: Rect): Radii {
  const r = view === 'collapsed' ? (layout.pillShape === 'bubble' ? pill.width / 2 : Math.min(pill.width, pill.height) / 2) : radius
  switch (layout.side) {
    case 'right': return [r, 0, 0, r]
    case 'left': return [0, r, r, 0]
    case 'top': return [0, 0, r, r]
    case 'bottom': return [r, r, 0, 0]
    default: return [r, r, r, r]
  }
}

function insetClip(container: Rect, r: Rect, radii: Radii): string {
  const top = r.y - container.y
  const left = r.x - container.x
  const right = container.x + container.width - (r.x + r.width)
  const bottom = container.y + container.height - (r.y + r.height)
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${radii.map((v) => `${v}px`).join(' ')})`
}
