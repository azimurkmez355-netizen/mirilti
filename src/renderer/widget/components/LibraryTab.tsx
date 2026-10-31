/** Kitaplıktaki çalma listeleri ve "Beğenilen müzikler". Tıklanan listeyi baştan çalar. */
import { useCallback, useEffect, useState } from 'react'
import { Heart, Library, Loader2, RefreshCw } from 'lucide-react'
import type { LibraryPlaylist } from '../../../shared/types'
import { EmptyState, ListRow } from './ListRow'

export function LibraryTab({ active }: { active: boolean }): React.JSX.Element {
  const [items, setItems] = useState<LibraryPlaylist[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await window.mirilti.command({ type: 'getLibrary' })
    setLoading(false)
    if (res.ok) {
      setItems(res.data)
      setError(null)
    } else {
      setError(res.error)
    }
  }, [])

  // İlk açılışta yükle
  useEffect(() => {
    if (active && !items && !loading) void load()
  }, [active, items, loading, load])

  if (loading && !items) {
    return (
      <EmptyState icon={<Loader2 size={20} className="spin" />}>Kitaplık yükleniyor…</EmptyState>
    )
  }
  if (error) {
    return (
      <EmptyState icon={<Library size={22} />}>
        {error}
        <button className="link-btn" onClick={() => void load()}>
          Tekrar dene
        </button>
      </EmptyState>
    )
  }

  return (
    <div className="list" data-scroll>
      <div className="list-head">
        Kitaplığım
        <button className="icon-btn xs" onClick={() => void load()} title="Yenile">
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>
      </div>
      {items?.map((p) => (
        <ListRow
          key={p.playlistId}
          thumbnail={p.thumbnail}
          title={p.title}
          subtitle={p.subtitle}
          trailing={p.playlistId === 'LM' ? <Heart size={14} className="accent" fill="currentColor" /> : undefined}
          onClick={() => void window.mirilti.command({ type: 'playTarget', target: { playlistId: p.playlistId } })}
        />
      ))}
    </div>
  )
}
