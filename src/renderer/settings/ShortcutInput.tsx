/**
 * Kısayol kaydedici: kutuya tıklayıp tuş kombinasyonuna bas.
 * Basılan tuşları Electron'un "accelerator" biçimine çevirir (ör. "Alt+Shift+M").
 * Backspace/Delete kısayolu kaldırır, Esc vazgeçer.
 */
import { useState } from 'react'

/** KeyboardEvent.code → Electron tuş adı */
function keyName(e: React.KeyboardEvent): string | null {
  const code = e.code
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^Numpad\d$/.test(code)) return `num${code.slice(6)}`
  if (/^F\d{1,2}$/.test(code)) return code
  const map: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Space: 'Space',
    Enter: 'Enter',
    Tab: 'Tab',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Insert: 'Insert',
    Minus: '-',
    Equal: '=',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backquote: '`',
    BracketLeft: '[',
    BracketRight: ']',
    Semicolon: ';',
    Quote: "'",
    Backslash: '\\',
    NumpadAdd: 'numadd',
    NumpadSubtract: 'numsub',
    NumpadMultiply: 'nummult',
    NumpadDivide: 'numdiv',
    MediaPlayPause: 'MediaPlayPause',
    MediaTrackNext: 'MediaNextTrack',
    MediaTrackPrevious: 'MediaPreviousTrack',
    MediaStop: 'MediaStop'
  }
  return map[code] ?? null
}

export function ShortcutInput({ value, onChange, label }: { value: string; onChange(v: string): void; label: string }): React.JSX.Element {
  const [recording, setRecording] = useState(false)
  const [preview, setPreview] = useState('')

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!recording) return
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') {
      setRecording(false)
      setPreview('')
      return
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      onChange('')
      setRecording(false)
      setPreview('')
      return
    }
    const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean) as string[]
    const key = keyName(e)
    setPreview([...mods, key ?? ''].filter(Boolean).join('+'))
    if (!key) return // yalnızca değiştirici tuşlara basılıyor
    // F tuşları ve medya tuşları tek başına olabilir; diğerleri en az bir değiştirici ister
    const standalone = /^F\d{1,2}$/.test(key) || key.startsWith('Media')
    if (!mods.length && !standalone) return
    onChange([...mods, key].join('+'))
    setRecording(false)
    setPreview('')
  }

  return (
    <button
      type="button"
      className={`shortcut ${recording ? 'is-recording' : ''}`}
      aria-label={label}
      onClick={() => setRecording(true)}
      onBlur={() => {
        setRecording(false)
        setPreview('')
      }}
      onKeyDown={onKeyDown}
    >
      {recording ? preview || 'Tuşlara bas… (Esc: vazgeç, ⌫: sil)' : value ? <Keys accel={value} /> : <span className="muted">Atanmamış</span>}
    </button>
  )
}

function Keys({ accel }: { accel: string }): React.JSX.Element {
  return (
    <span className="keys">
      {accel.split('+').map((k, i) => (
        <kbd key={i}>{k}</kbd>
      ))}
    </span>
  )
}
