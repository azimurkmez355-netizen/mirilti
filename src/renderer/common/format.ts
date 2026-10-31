/** Saniyeyi "3:07" ya da "1:02:45" biçimine çevirir */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/**
 * Öğeyi yalnızca verilen kaydırma kutusu içinde ortala.
 * (scrollIntoView, overflow:hidden olan üst öğeleri de kaydırıp widget'ı bozduğu için kullanılmıyor.)
 */
export function scrollToCenter(container: HTMLElement, el: HTMLElement, smooth = true): void {
  const c = container.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const top = container.scrollTop + (r.top - c.top) - (c.height - r.height) / 2
  container.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
}
