/** Sıra, arama ve kitaplık listelerinde ortak satır: küçük resim + başlık + alt başlık + işlemler */
import type { ReactNode } from 'react'
import { Music2 } from 'lucide-react'

interface Props {
  thumbnail: string
  title: string
  subtitle?: string
  trailing?: ReactNode
  current?: boolean
  round?: boolean
  disabled?: boolean
  onClick?(): void
}

export function ListRow({ thumbnail, title, subtitle, trailing, current, round, disabled, onClick }: Props): React.JSX.Element {
  return (
    <div
      className={`row ${current ? 'is-current' : ''} ${disabled ? 'is-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <div className={`row-thumb ${round ? 'is-round' : ''}`}>
        {thumbnail ? <img src={thumbnail} alt="" loading="lazy" draggable={false} /> : <Music2 size={16} />}
      </div>
      <div className="row-text">
        <div className="row-title" title={title}>
          {title}
        </div>
        {subtitle && (
          <div className="row-sub" title={subtitle}>
            {subtitle}
          </div>
        )}
      </div>
      {trailing && (
        <div className="row-trailing" onClick={(e) => e.stopPropagation()}>
          {trailing}
        </div>
      )}
    </div>
  )
}

/** Liste boşken / yüklenirken / hata durumunda gösterilen ortalanmış mesaj */
export function EmptyState({ icon, children }: { icon?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <div className="empty">
      {icon}
      <div>{children}</div>
    </div>
  )
}
