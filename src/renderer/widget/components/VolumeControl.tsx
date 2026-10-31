/** Ses kaydırıcısı + sessize alma. Kaydırırken arayüz anında güncellenir, komut seyrekleştirilir. */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Volume1, Volume2, VolumeX } from 'lucide-react'
import type { PlayerState } from '../../../shared/types'

export function VolumeControl({ state }: { state: PlayerState }): React.JSX.Element {
  const [local, setLocal] = useState<number | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const value = local ?? (state.muted ? 0 : state.volume)
  const Icon = state.muted || value === 0 ? VolumeX : value < 50 ? Volume1 : Volume2

  const onChange = (v: number): void => {
    setLocal(v)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void window.mirilti.command({ type: 'setVolume', volume: v }).finally(() => setLocal(null))
    }, 60)
  }

  return (
    <div className="volume">
      <button
        className="icon-btn sm"
        onClick={() => void window.mirilti.command({ type: 'toggleMute' })}
        title={state.muted ? 'Sesi aç' : 'Sessize al'}
      >
        <Icon size={16} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--value': `${value}%` } as CSSProperties}
        aria-label="Ses düzeyi"
      />
    </div>
  )
}
