/** Genişletilmiş görünümdeki sekme içeriği */
import type { PlayerState } from '../../../shared/types'

export type TabId = 'lyrics' | 'queue' | 'search' | 'library'

interface Props {
  tab: TabId
  state: PlayerState
  active: boolean
}

export function TabContent({ tab }: Props): React.JSX.Element {
  return <div className="tab-empty">{tab} — yakında</div>
}
