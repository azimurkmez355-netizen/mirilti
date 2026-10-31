/**
 * Widget içinden arama: şarkı, video, albüm, sanatçı ve çalma listesi sonuçları.
 * Satıra tıklamak çalar; "+" düğmesi sıranın sonuna ekler.
 */
import { useEffect, useRef, useState } from 'react'
import { ListPlus, Loader2, Play, Search, X } from 'lucide-react'
import type { SearchItem, SearchSection } from '../../../shared/types'
import { EmptyState, ListRow } from './ListRow'

const TYPE_LABEL: Record<SearchItem['type'], string> = {
  song: 'Şarkı',
  video: 'Video',
  album: 'Albüm',
  artist: 'Sanatçı',
  playlist: 'Çalma listesi',
  other: ''
}

export function SearchTab({ active }: { active: boolean }): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [sections, setSections] = useState<SearchSection[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (active) inputRef.current?.focus()
  }, [active])

  // Yazmayı bırakınca (400 ms) ara; eski isteklerin yanıtı yeni sonuçları ezmesin
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSections(null)
      setError(null)
      return
    }
    const id = ++requestId.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const res = await window.mirilti.command({ type: 'search', query: q })
      if (id !== requestId.current) return
      setLoading(false)
      if (res.ok) {
        setSections(res.data)
        setError(null)
      } else {
        setError(res.error)
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [query])

  const showToast = (text: string): void => {
    setToast(text)
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2200)
  }

  const play = async (item: SearchItem): Promise<void> => {
    if (!item.play) return
    const res = await window.mirilti.command({ type: 'playTarget', target: item.play })
    if (!res.ok) showToast(res.error)
  }

  const enqueue = async (item: SearchItem): Promise<void> => {
    if (!item.play) return
    const res = await window.mirilti.command({ type: 'addToQueue', target: item.play })
    showToast(res.ok ? 'Sıraya eklendi' : res.error)
  }

  return (
    <div className="search">
      <div className="search-box">
        <Search size={15} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Şarkı, sanatçı, albüm ara…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('')
          }}
          spellCheck={false}
        />
        {loading ? (
          <Loader2 size={15} className="spin" />
        ) : (
          query && (
            <button className="icon-btn xs" onClick={() => setQuery('')} title="Temizle">
              <X size={14} />
            </button>
          )
        )}
      </div>

      <div className="list" data-scroll>
        {error && <EmptyState>{error}</EmptyState>}
        {!error && sections?.length === 0 && <EmptyState>Sonuç bulunamadı.</EmptyState>}
        {!error && !sections && !loading && (
          <EmptyState icon={<Search size={22} />}>YouTube Music'te aramak için yazmaya başla.</EmptyState>
        )}
        {!error &&
          sections?.map((section, si) => (
            <div key={`${si}-${section.title}`} className="list-section">
              <div className="list-head">{section.title}</div>
              {section.items.map((item, i) => (
                <ListRow
                  key={i}
                  thumbnail={item.thumbnail}
                  title={item.title}
                  subtitle={[TYPE_LABEL[item.type], item.subtitle.replace(/^(Şarkı|Video|Albüm|Sanatçı|Çalma listesi|Song|Video|Album|Artist|Playlist) • /, '')]
                    .filter(Boolean)
                    .join(' · ')}
                  round={item.type === 'artist'}
                  disabled={!item.play}
                  onClick={() => void play(item)}
                  trailing={
                    item.play && (
                      <>
                        <button className="icon-btn xs" onClick={() => void play(item)} title="Çal">
                          <Play size={14} fill="currentColor" />
                        </button>
                        {item.canQueue && (
                          <button className="icon-btn xs" onClick={() => void enqueue(item)} title="Sıraya ekle">
                            <ListPlus size={15} />
                          </button>
                        )}
                      </>
                    )
                  }
                />
              ))}
            </div>
          ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
