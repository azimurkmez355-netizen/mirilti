/**
 * Arayüzlerin ortak React hook'ları: ana süreçteki durumlara abone olur.
 * Her hook önce son değeri ister, sonra değişiklikleri dinler; bileşen kapanınca aboneliği bırakır.
 */
import { useEffect, useState } from 'react'
import type { Settings } from '../../shared/settings'
import { initialPlayerState, type CoverPalette, type PlayerState, type QueueItem, type WidgetLayout } from '../../shared/types'

export function usePlayerState(): PlayerState {
  const [state, setState] = useState<PlayerState>(initialPlayerState)
  useEffect(() => {
    let alive = true
    void window.mirilti.getState().then((s) => alive && setState(s))
    const off = window.mirilti.onState(setState)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}

export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => {
    let alive = true
    void window.mirilti.getSettings().then((s) => alive && setSettings(s))
    const off = window.mirilti.onSettings(setSettings)
    return () => {
      alive = false
      off()
    }
  }, [])
  return settings
}

export function useLayout(): WidgetLayout | null {
  const [layout, setLayout] = useState<WidgetLayout | null>(null)
  useEffect(() => {
    let alive = true
    void window.mirilti.getLayout().then((l) => alive && setLayout(l))
    const off = window.mirilti.onLayout(setLayout)
    return () => {
      alive = false
      off()
    }
  }, [])
  return layout
}

export function usePalette(): CoverPalette | null {
  const [palette, setPalette] = useState<CoverPalette | null>(null)
  useEffect(() => window.mirilti.onPalette(setPalette), [])
  return palette
}

/** Sıra listesi: yalnızca `active` iken ilk listeyi ister; değişiklikleri her zaman dinler */
export function useQueue(active: boolean): QueueItem[] {
  const [queue, setQueue] = useState<QueueItem[]>([])
  useEffect(() => window.mirilti.onQueue(setQueue), [])
  useEffect(() => {
    if (!active) return
    void window.mirilti.command({ type: 'getQueue' }).then((r) => {
      if (r.ok) setQueue(r.data)
    })
  }, [active])
  return queue
}

/**
 * O anki çalma konumu (sn). Yalnızca `active` ve çalıyorken saniyede bir güncellenir;
 * ilerleme çubuğunun akıcı hareketi CSS animasyonuyla yapılır (bkz. ProgressBar).
 */
export function useLivePosition(state: PlayerState, active: boolean): number {
  const compute = (): number =>
    state.isPlaying ? state.position + ((Date.now() - state.positionAt) / 1000) * state.playbackRate : state.position
  const [pos, setPos] = useState(compute)
  useEffect(() => {
    setPos(compute())
    if (!active || !state.isPlaying) return
    const id = window.setInterval(() => setPos(compute()), 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, state.isPlaying, state.position, state.positionAt, state.playbackRate])
  return pos
}
