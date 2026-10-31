/** "Sıradaki" listesi: tıklanan şarkıya geçer; açılınca çalan şarkıya kaydırır */
import { useEffect, useRef } from 'react'
import { ListMusic } from 'lucide-react'
import { useQueue } from '../../common/hooks'
import { EmptyState, ListRow } from './ListRow'
import { Wave } from './Wave'

export function QueueTab({ active }: { active: boolean }): React.JSX.Element {
  const queue = useQueue(active)
  const listRef = useRef<HTMLDivElement>(null)
  const currentIndex = queue.findIndex((q) => q.isCurrent)

  // Sekme açılınca ya da şarkı değişince çalan öğeyi görünür yap
  useEffect(() => {
    if (!active || currentIndex < 0) return
    const el = listRef.current?.querySelector<HTMLElement>('.row.is-current')
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [active, currentIndex])

  if (!queue.length) {
    return <EmptyState icon={<ListMusic size={22} />}>Sıra boş. Bir şarkı çalınca burada görünecek.</EmptyState>
  }

  return (
    <div className="list" ref={listRef} data-scroll>
      <div className="list-head">Sıradaki · {queue.length} şarkı</div>
      {queue.map((q) => (
        <ListRow
          key={`${q.index}-${q.videoId}`}
          thumbnail={q.thumbnail}
          title={q.title}
          subtitle={q.artist}
          current={q.isCurrent}
          trailing={q.isCurrent ? <Wave playing bars={3} /> : <span className="row-meta">{q.durationText}</span>}
          onClick={() => void window.mirilti.command({ type: 'playQueueIndex', index: q.index })}
        />
      ))}
    </div>
  )
}
