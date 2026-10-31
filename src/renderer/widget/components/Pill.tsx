/**
 * Daraltılmış görünüm: kapak küçük resmi + çalıyorsa ses dalgası.
 * Kenar ve yüzen modlarda sürüklenerek konumu değiştirilebilir.
 */
import { useRef } from 'react'
import { Music2 } from 'lucide-react'
import type { PlayerState, Rect, WidgetLayout } from '../../../shared/types'
import { Wave } from './Wave'

interface Props {
  layout: WidgetLayout
  rect: Rect
  state: PlayerState
  visible: boolean
  draggable: boolean
  onDragChange(dragging: boolean): void
  onClick(): void
}

/** Bu kadar pikselden az hareket tıklama sayılır */
const DRAG_THRESHOLD = 5

export function Pill({ layout, rect, state, visible, draggable, onDragChange, onClick }: Props): React.JSX.Element {
  const start = useRef<{ x: number; y: number; dragging: boolean; raf: number } | null>(null)
  const hasProblem = state.connection === 'offline' || state.loggedIn === false || state.adapterIssues.length > 0

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.screenX, y: e.screenY, dragging: false, raf: 0 }
  }

  const onPointerMove = (e: React.PointerEvent): void => {
    const s = start.current
    if (!s || !draggable) return
    if (!s.dragging && Math.hypot(e.screenX - s.x, e.screenY - s.y) > DRAG_THRESHOLD) {
      s.dragging = true
      onDragChange(true)
      window.mirilti.dragStart()
    }
    // Ana süreç imleci kendisi okur; burada sadece kare başına bir kez haber ver
    if (s.dragging && !s.raf) {
      s.raf = requestAnimationFrame(() => {
        if (start.current) start.current.raf = 0
        window.mirilti.dragMove()
      })
    }
  }

  const onPointerUp = (e: React.PointerEvent): void => {
    const s = start.current
    start.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (!s) return
    if (s.dragging) {
      cancelAnimationFrame(s.raf)
      window.mirilti.dragEnd()
      onDragChange(false)
    } else {
      onClick()
    }
  }

  const cover = state.track?.coverUrl
  return (
    <div
      className={`pill pill-${layout.pillShape} side-${layout.side} ${visible ? '' : 'is-hidden'} ${draggable ? 'is-draggable' : ''}`}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title={state.track ? `${state.track.title} — ${state.track.artist}` : 'Mırıltı'}
    >
      <div className="pill-cover">{cover ? <img src={cover} alt="" draggable={false} /> : <Music2 size={18} />}</div>
      {layout.pillShape === 'horizontal' && <div className="pill-title">{state.track?.title ?? 'Mırıltı'}</div>}
      <Wave playing={state.isPlaying} />
      {hasProblem && <span className="pill-alert" />}
    </div>
  )
}
