/**
 * Şarkı sözleri sekmesi.
 * Senkron sözlerde çalan satır vurgulanır ve ortaya kaydırılır; bir satıra tıklamak
 * şarkıyı o ana sarar. Kullanıcı elle kaydırırsa otomatik kaydırma birkaç saniye bekler.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MicVocal } from 'lucide-react'
import type { Lyrics, PlayerState } from '../../../shared/types'
import { scrollToCenter } from '../../common/format'
import { EmptyState } from './ListRow'

/** Senkron satırlar için konum güncelleme aralığı (yalnızca sekme görünürken ve çalarken) */
const TICK_MS = 200
/** Elle kaydırmadan sonra otomatik kaydırmanın bekleme süresi */
const MANUAL_SCROLL_PAUSE = 4000
/** Sözler sesten biraz önce görünsün */
const LEAD_SECONDS = 0.3

type LoadState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: string } | { status: 'done'; lyrics: Lyrics }

export function LyricsTab({ active, state }: { active: boolean; state: PlayerState }): React.JSX.Element {
  const track = state.track
  const [load, setLoad] = useState<LoadState>({ status: 'idle' })
  /** Sözleri yüklenen (ya da yüklenmekte olan) şarkı */
  const loadedFor = useRef<string | null>(null)

  // Sekme görünürken şarkı değişince sözleri getir
  useEffect(() => {
    if (!active || !track?.videoId || loadedFor.current === track.videoId) return
    const videoId = track.videoId
    loadedFor.current = videoId
    setLoad({ status: 'loading' })
    void window.mirilti
      .getLyrics({ videoId, title: track.title, artist: track.artist, album: track.album, duration: track.duration })
      .then((res) => {
        // Bu arada şarkı değiştiyse eski sonucu gösterme
        if (loadedFor.current !== videoId) return
        setLoad(res.ok ? { status: 'done', lyrics: res.data } : { status: 'error', error: res.error })
        // Hata olursa bir sonraki açılışta yeniden dene
        if (!res.ok) loadedFor.current = null
      })
  }, [active, track?.videoId, track?.title, track?.artist, track?.album, track?.duration])

  if (!track) return <EmptyState icon={<MicVocal size={22} />}>Çalan şarkı yok.</EmptyState>
  if (load.status === 'loading' || load.status === 'idle') {
    return <EmptyState icon={<Loader2 size={20} className="spin" />}>Sözler aranıyor…</EmptyState>
  }
  if (load.status === 'error') return <EmptyState icon={<MicVocal size={22} />}>{load.error}</EmptyState>

  const { lyrics } = load
  if (lyrics.synced?.length) return <SyncedLyrics lyrics={lyrics} state={state} active={active} />
  if (lyrics.plain) {
    return (
      <div className="lyrics" data-scroll>
        <div className="lyrics-plain">{lyrics.plain}</div>
        <SourceNote source={lyrics.source} />
      </div>
    )
  }
  return <EmptyState icon={<MicVocal size={22} />}>Bu şarkı için söz bulunamadı.</EmptyState>
}

function SyncedLyrics({ lyrics, state, active }: { lyrics: Lyrics; state: PlayerState; active: boolean }): React.JSX.Element {
  const lines = lyrics.synced!
  const containerRef = useRef<HTMLDivElement>(null)
  const manualUntil = useRef(0)
  const [position, setPosition] = useState(0)

  // Konumu yerelde hesapla; yalnızca gerektiğinde zamanlayıcı çalışsın
  useEffect(() => {
    const compute = (): number =>
      state.isPlaying ? state.position + ((Date.now() - state.positionAt) / 1000) * state.playbackRate : state.position
    setPosition(compute())
    if (!active || !state.isPlaying) return
    const id = window.setInterval(() => setPosition(compute()), TICK_MS)
    return () => window.clearInterval(id)
  }, [active, state.isPlaying, state.position, state.positionAt, state.playbackRate])

  const current = useMemo(() => {
    if (state.adPlaying) return -1
    const t = position + LEAD_SECONDS
    let lo = 0
    let hi = lines.length - 1
    let found = -1
    // İkili arama: zamanı t'den küçük/eşit son satır
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (lines[mid].time <= t) {
        found = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return found
  }, [position, lines, state.adPlaying])

  useEffect(() => {
    if (!active || current < 0 || Date.now() < manualUntil.current) return
    const container = containerRef.current
    const el = container?.querySelector<HTMLElement>(`[data-line="${current}"]`)
    if (container && el) scrollToCenter(container, el)
  }, [current, active])

  return (
    <div
      className="lyrics is-synced"
      ref={containerRef}
      data-scroll
      onWheel={() => {
        manualUntil.current = Date.now() + MANUAL_SCROLL_PAUSE
      }}
    >
      <div className="lyrics-spacer" />
      {lines.map((line, i) => (
        <p
          key={i}
          data-line={i}
          className={`lyric-line ${i === current ? 'is-active' : i < current ? 'is-past' : ''}`}
          onClick={() => {
            manualUntil.current = 0
            void window.mirilti.command({ type: 'seek', seconds: line.time })
          }}
        >
          {line.text || '♪'}
        </p>
      ))}
      <div className="lyrics-spacer" />
      <SourceNote source={lyrics.source} />
    </div>
  )
}

function SourceNote({ source }: { source: Lyrics['source'] }): React.JSX.Element | null {
  if (!source) return null
  return <div className="lyrics-source">Kaynak: {source === 'lrclib' ? 'LRCLIB' : 'YouTube Music'}</div>
}
