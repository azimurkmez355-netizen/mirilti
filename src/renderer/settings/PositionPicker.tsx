/** Konum seçici: küçük bir ekran çizimi üzerinde kenar, köşe ya da yüzen modu seç */
import type { DockMode } from '../../shared/settings'

const SPOTS: { mode: DockMode; label: string; className: string }[] = [
  { mode: 'edge-top', label: 'Üst kenar (dynamic island)', className: 'spot edge top' },
  { mode: 'edge-bottom', label: 'Alt kenar', className: 'spot edge bottom' },
  { mode: 'edge-left', label: 'Sol kenar', className: 'spot edge left' },
  { mode: 'edge-right', label: 'Sağ kenar', className: 'spot edge right' },
  { mode: 'corner-top-left', label: 'Sol üst köşe', className: 'spot corner tl' },
  { mode: 'corner-top-right', label: 'Sağ üst köşe', className: 'spot corner tr' },
  { mode: 'corner-bottom-left', label: 'Sol alt köşe', className: 'spot corner bl' },
  { mode: 'corner-bottom-right', label: 'Sağ alt köşe', className: 'spot corner br' },
  { mode: 'floating', label: 'Yüzen balon (sürüklenebilir)', className: 'spot floating' }
]

export function modeLabel(mode: DockMode): string {
  return SPOTS.find((s) => s.mode === mode)?.label ?? mode
}

export function PositionPicker({ value, onChange }: { value: DockMode; onChange(mode: DockMode): void }): React.JSX.Element {
  return (
    <div className="picker">
      <div className="picker-screen" role="radiogroup" aria-label="Widget konumu">
        {SPOTS.map((s) => (
          <button
            key={s.mode}
            type="button"
            role="radio"
            aria-checked={value === s.mode}
            title={s.label}
            aria-label={s.label}
            className={`${s.className} ${value === s.mode ? 'is-on' : ''}`}
            onClick={() => onChange(s.mode)}
          />
        ))}
        <div className="picker-taskbar" />
      </div>
      <div className="picker-label">{modeLabel(value)}</div>
    </div>
  )
}
