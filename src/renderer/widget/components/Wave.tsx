/** Çalarken oynayan küçük ses dalgası (yalnızca transform animasyonu: GPU'da, CPU'yu yormaz) */
export function Wave({ playing, bars = 4 }: { playing: boolean; bars?: number }): React.JSX.Element {
  return (
    <span className={`wave ${playing ? 'is-playing' : ''}`} aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} style={{ animationDelay: `${i * -0.23}s` }} />
      ))}
    </span>
  )
}
