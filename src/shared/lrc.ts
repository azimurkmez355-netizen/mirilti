/** LRC (zaman damgalı şarkı sözü) ayrıştırıcı — yan etkisiz, test edilebilir */
import type { LyricLine } from './types'

/** "[01:23.45] satır" — bir satırda birden fazla zaman damgası olabilir; üst bilgi satırları ([ar:..]) atlanır */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    if (!stamps.length) continue
    const text = raw.replace(/\[[^\]]*\]/g, '').trim()
    for (const m of stamps) {
      const frac = m[3] ? Number(m[3]) / 10 ** m[3].length : 0
      lines.push({ time: Number(m[1]) * 60 + Number(m[2]) + frac, text })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}
