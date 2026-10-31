/** Ayarlar ekranının küçük, yeniden kullanılabilir form kontrolleri */
import type { ReactNode } from 'react'

export function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="card">
      <header>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </header>
      <div className="card-body">{children}</div>
    </section>
  )
}

/** Solda etiket + açıklama, sağda kontrol */
export function Row({ label, hint, children, disabled }: { label: string; hint?: ReactNode; children: ReactNode; disabled?: boolean }): React.JSX.Element {
  return (
    <div className={`row ${disabled ? 'is-disabled' : ''}`}>
      <div className="row-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  )
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange(v: boolean): void; disabled?: boolean; label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'is-on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}

interface SliderProps {
  value: number
  min: number
  max: number
  step: number
  onChange(v: number): void
  format?(v: number): string
  disabled?: boolean
  label: string
}

export function Slider({ value, min, max, step, onChange, format, disabled, label }: SliderProps): React.JSX.Element {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--value': `${pct}%` } as React.CSSProperties}
      />
      <output>{format ? format(value) : value}</output>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label
}: {
  value: T
  options: { value: T; label: string }[]
  onChange(v: T): void
  disabled?: boolean
  label: string
}): React.JSX.Element {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'is-on' : ''}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
