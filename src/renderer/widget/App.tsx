// Aşama 2: oynatıcı köprüsünü doğrulamak için basit görünüm
import { useEffect, useState } from 'react'
import { initialPlayerState, type PlayerState } from '../../shared/types'

export function App(): React.JSX.Element {
  const [state, setState] = useState<PlayerState>(initialPlayerState)
  useEffect(() => {
    void window.mirilti.getState().then(setState)
    return window.mirilti.onState(setState)
  }, [])
  const t = state.track
  const btn = (label: string, type: 'previous' | 'togglePlay' | 'next'): React.JSX.Element => (
    <button onClick={() => void window.mirilti.command({ type })}>{label}</button>
  )
  return (
    <div style={{ display: 'flex', gap: 12, padding: 12, background: '#18181bee', color: '#fff', borderRadius: 14, fontFamily: 'Segoe UI', height: 108, boxSizing: 'border-box' }}>
      {t?.coverUrl && <img src={t.coverUrl} width={84} height={84} style={{ borderRadius: 8, objectFit: 'cover' }} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t?.title ?? 'Çalan şarkı yok'}</div>
        <div style={{ opacity: 0.7, fontSize: 13 }}>{t?.artist}</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          {btn('⏮', 'previous')}
          {btn(state.isPlaying ? '⏸' : '▶', 'togglePlay')}
          {btn('⏭', 'next')}
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{state.connection}{state.adPlaying ? ' · Reklam' : ''}</div>
      </div>
    </div>
  )
}
