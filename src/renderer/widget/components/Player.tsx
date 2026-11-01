/**
 * Açık hâldeki oynatıcı: kapak, şarkı bilgisi, ilerleme, kontroller, ses ve sekme düğmeleri.
 * Hangi düğme/bölümün görüneceği Ayarlar > Bölümler'den gelir.
 */
import {
  Library,
  ListMusic,
  MicVocal,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Search,
  Settings2,
  Shuffle,
  SkipBack,
  SkipForward,
  ThumbsDown,
  ThumbsUp
} from 'lucide-react'
import type { PlayerCommand } from '../../../shared/ipc'
import type { Settings } from '../../../shared/settings'
import type { PlayerState } from '../../../shared/types'
import type { VolumeHandle } from '../../common/hooks'
import { ProgressBar } from './ProgressBar'
import { StatusBanner } from './StatusBanner'
import type { TabId } from './TabContent'
import { VolumeControl } from './VolumeControl'

interface Props {
  state: PlayerState
  volume: VolumeHandle
  settings: Settings
  active: boolean
  tab: TabId | null
  onSelectTab(tab: TabId): void
}

const send = (cmd: PlayerCommand): void => {
  void window.mirilti.command(cmd as never)
}

export function Player({ state, volume, settings, active, tab, onSelectTab }: Props): React.JSX.Element {
  const t = state.track
  const sec = settings.sections
  const liked = state.likeStatus === 'LIKE'
  const disliked = state.likeStatus === 'DISLIKE'

  const tabs: { id: TabId; label: string; icon: React.ReactNode; on: boolean }[] = [
    { id: 'lyrics', label: 'Şarkı sözleri', icon: <MicVocal size={16} />, on: sec.lyrics },
    { id: 'queue', label: 'Sıradaki', icon: <ListMusic size={16} />, on: sec.queue },
    { id: 'search', label: 'Ara', icon: <Search size={16} />, on: sec.search },
    { id: 'library', label: 'Kitaplık', icon: <Library size={16} />, on: sec.library }
  ]

  return (
    <div className="player">
      <StatusBanner state={state} />

      <div className="player-head">
        <div className="cover">
          {t?.coverUrl ? <img key={t.coverUrl} src={t.coverUrl} alt="" draggable={false} /> : <Music2 size={26} />}
        </div>
        <div className="meta">
          <div className="title" title={t?.title}>
            {t?.title ?? 'Çalan şarkı yok'}
          </div>
          <div className="artist" title={t?.artist}>
            {t?.artist ?? 'Aramadan ya da kitaplıktan bir şey çal'}
          </div>
          {sec.album && t?.album && (
            <div className="album" title={t.album}>
              {t.album}
            </div>
          )}
          {state.adPlaying && <span className="badge">Reklam</span>}
        </div>
      </div>

      <ProgressBar state={state} active={active} />

      <div className="controls">
        <div className="controls-side">
          {sec.like && (
            <>
              <button className={`icon-btn ${liked ? 'is-on' : ''}`} onClick={() => send({ type: 'like' })} title="Beğen">
                <ThumbsUp size={17} fill={liked ? 'currentColor' : 'none'} />
              </button>
              <button className={`icon-btn ${disliked ? 'is-on' : ''}`} onClick={() => send({ type: 'dislike' })} title="Beğenme">
                <ThumbsDown size={17} fill={disliked ? 'currentColor' : 'none'} />
              </button>
            </>
          )}
        </div>

        <div className="controls-main">
          <button className="icon-btn" onClick={() => send({ type: 'previous' })} title="Önceki">
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button className="play-btn" onClick={() => send({ type: 'togglePlay' })} title={state.isPlaying ? 'Duraklat' : 'Oynat'}>
            {state.isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
          </button>
          <button className="icon-btn" onClick={() => send({ type: 'next' })} title="Sonraki">
            <SkipForward size={20} fill="currentColor" />
          </button>
        </div>

        <div className="controls-side end">
          {sec.shuffleRepeat && (
            <>
              <button className="icon-btn" onClick={() => send({ type: 'shuffle' })} title="Karıştır">
                <Shuffle size={17} />
              </button>
              <button
                className={`icon-btn ${state.repeat !== 'NONE' ? 'is-on' : ''}`}
                onClick={() => send({ type: 'cycleRepeat' })}
                title={state.repeat === 'ONE' ? 'Tekrar: tek şarkı' : state.repeat === 'ALL' ? 'Tekrar: tümü' : 'Tekrar kapalı'}
              >
                {state.repeat === 'ONE' ? <Repeat1 size={17} /> : <Repeat size={17} />}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="player-foot">
        {sec.volume ? <VolumeControl state={state} volume={volume} /> : <span />}
        <div className="tabs">
          {tabs
            .filter((x) => x.on)
            .map((x) => (
              <button key={x.id} className={`icon-btn sm ${tab === x.id ? 'is-on' : ''}`} onClick={() => onSelectTab(x.id)} title={x.label}>
                {x.icon}
              </button>
            ))}
          <button className="icon-btn sm" onClick={() => window.mirilti.openSettings()} title="Ayarlar">
            <Settings2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
