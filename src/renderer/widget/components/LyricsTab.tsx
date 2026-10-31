/** Şarkı sözleri sekmesi (Aşama 5'te dolduruluyor) */
import type { PlayerState } from '../../../shared/types'
import { EmptyState } from './ListRow'

export function LyricsTab(_props: { active: boolean; state: PlayerState }): React.JSX.Element {
  return <EmptyState>Şarkı sözleri yakında.</EmptyState>
}
