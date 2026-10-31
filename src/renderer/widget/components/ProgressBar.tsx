/**
 * Tıklanabilir / sürüklenebilir ilerleme çubuğu.
 * Çubuğun dolması bir CSS animasyonudur: her durum güncellemesinde mevcut konumdan şarkı
 * sonuna kadar doğrusal bir animasyon başlatılır. Böylece JS her karede çalışmaz.
 */
import { useRef, useState, type CSSProperties } from 'react'
import type { PlayerState } from '../../../shared/types'
import { clamp, formatTime } from '../../common/format'
import { useLivePosition } from '../../common/hooks'

export function ProgressBar({ state, active }: { state: PlayerState; active: boolean }): React.JSX.Element {
  const duration = state.track?.duration ?? 0
  const live = useLivePosition(state, active)
  const [scrub, setScrub] = useState<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const fractionAt = (clientX: number): number => {
    const rect = trackRef.current!.getBoundingClientRect()
    return clamp((clientX - rect.left) / rect.width, 0, 1)
  }

  const onPointerDown = (e: React.PointerEvent): void => {
    if (!duration || state.adPlaying) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setScrub(fractionAt(e.clientX))
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    if (scrub !== null) setScrub(fractionAt(e.clientX))
  }
  const onPointerUp = (e: React.PointerEvent): void => {
    if (scrub === null) return
    const f = fractionAt(e.clientX)
    setScrub(null)
    void window.mirilti.command({ type: 'seek', seconds: f * duration })
  }

  // Durum anındaki konum (kesir) ve sona kalan gerçek süre
  const nowFraction = duration ? clamp(live / duration, 0, 1) : 0
  const remaining = Math.max(0, (duration - live) / (state.playbackRate || 1))
  const animate = active && state.isPlaying && scrub === null && duration > 0
  const fillStyle: CSSProperties =
    scrub !== null
      ? { transform: `scaleX(${scrub})` }
      : animate
        ? ({ '--from': nowFraction, animationDuration: `${remaining}s` } as CSSProperties)
        : { transform: `scaleX(${nowFraction})` }

  const shown = scrub !== null ? scrub * duration : live
  return (
    <div className="progress">
      <span className="time">{formatTime(shown)}</span>
      <div
        ref={trackRef}
        className={`progress-track ${scrub !== null ? 'is-scrubbing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setScrub(null)}
        role="slider"
        aria-label="Şarkı konumu"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shown)}
      >
        {/* key değişince animasyon baştan başlar */}
        <div
          key={animate ? `${state.positionAt}-${state.position}` : 'still'}
          className={`progress-fill ${animate ? 'is-running' : ''}`}
          style={fillStyle}
        />
      </div>
      <span className="time">{duration ? `-${formatTime(Math.max(0, duration - shown))}` : '--:--'}</span>
    </div>
  )
}
