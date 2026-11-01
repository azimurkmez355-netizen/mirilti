/** Ses kaydırıcısı + sessize alma. Değer useVolume ile anında güncellenir. */
import type { CSSProperties } from 'react'
import { Volume1, Volume2, VolumeX } from 'lucide-react'
import type { PlayerState } from '../../../shared/types'
import type { VolumeHandle } from '../../common/hooks'

export function VolumeControl({ state, volume }: { state: PlayerState; volume: VolumeHandle }): React.JSX.Element {
  const value = volume.value
  const Icon = value === 0 ? VolumeX : value < 50 ? Volume1 : Volume2

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
        onChange={(e) => volume.set(Number(e.target.value))}
        style={{ '--value': `${value}%` } as CSSProperties}
        aria-label="Ses düzeyi"
        title={`Ses: %${value}`}
      />
    </div>
  )
}
