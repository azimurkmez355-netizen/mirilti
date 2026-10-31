/**
 * Genişletilmiş görünümdeki sekme içeriği.
 * Bir kez açılan sekme bellekte kalır (arama sonuçları, kaydırma konumu kaybolmasın);
 * yalnızca görünen sekme etkin (active) sayılır.
 */
import { useEffect, useState } from 'react'
import type { PlayerState } from '../../../shared/types'
import { LibraryTab } from './LibraryTab'
import { LyricsTab } from './LyricsTab'
import { QueueTab } from './QueueTab'
import { SearchTab } from './SearchTab'

export type TabId = 'lyrics' | 'queue' | 'search' | 'library'

interface Props {
  /** null: sekme kapatıldı (son sekme kapanma animasyonu bitene kadar görünür kalır) */
  tab: TabId | null
  state: PlayerState
  active: boolean
}

export function TabContent({ tab: requested, state, active }: Props): React.JSX.Element {
  const [visited, setVisited] = useState<TabId[]>([])
  const [tab, setTab] = useState<TabId | null>(requested)
  useEffect(() => {
    if (!requested) return
    setTab(requested)
    setVisited((v) => (v.includes(requested) ? v : [...v, requested]))
  }, [requested])

  return (
    <div className="tab-content">
      {visited.map((id) => {
        const on = active && id === tab
        return (
          <div key={id} className="tab-pane" hidden={id !== tab}>
            {id === 'queue' && <QueueTab active={on} />}
            {id === 'search' && <SearchTab active={on} />}
            {id === 'library' && <LibraryTab active={on} />}
            {id === 'lyrics' && <LyricsTab active={on} state={state} />}
          </div>
        )
      })}
    </div>
  )
}
