/**
 * Ayarlar + kapak paletinden CSS değişkenleri üretir.
 * Renk değişkenleri CSS'te @property ile kayıtlı olduğu için şarkı değişince yumuşakça geçiş yapar.
 */
import type { CSSProperties } from 'react'
import type { Settings } from '../../shared/settings'
import type { CoverPalette } from '../../shared/types'

/** Temel animasyon süresi (ms); hız ayarına bölünür */
const BASE_DURATION = 320

export function themeVars(settings: Settings, palette: CoverPalette | null): CSSProperties {
  const a = settings.appearance
  const light = a.colorScheme === 'light'
  const useCover = a.accentMode === 'cover' && palette

  const accent = useCover ? palette.accent : a.fixedAccent
  const base = light ? '#f4f4f7' : '#0c0c11'
  // Sabit renkte arka plan gradyanı vurgu renginden türetilir
  let bgFrom = useCover ? palette.bgFrom : `color-mix(in oklab, ${accent} 38%, ${base})`
  let bgTo = useCover ? palette.bgTo : `color-mix(in oklab, ${accent} 12%, ${base})`
  if (light) {
    bgFrom = `color-mix(in oklab, ${bgFrom} 22%, #ffffff)`
    bgTo = `color-mix(in oklab, ${bgTo} 12%, #f2f2f5)`
  }

  const speed = a.animationSpeed
  const dur = speed <= 0 ? 0 : Math.round(BASE_DURATION / speed)

  return {
    '--accent': light ? `color-mix(in oklab, ${accent} 80%, #000)` : accent,
    '--bg-from': bgFrom,
    '--bg-to': bgTo,
    '--on-accent': light ? '#ffffff' : '#0b0b0f',
    '--fg': light ? '#15151b' : '#f6f6f8',
    '--fg-dim': light ? 'rgba(20,20,28,.62)' : 'rgba(246,246,248,.62)',
    '--fg-faint': light ? 'rgba(20,20,28,.38)' : 'rgba(246,246,248,.38)',
    '--hover': light ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.09)',
    '--track': light ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.16)',
    '--opacity': String(a.opacity),
    '--blur': `${a.blur}px`,
    '--radius': `${a.radius}px`,
    '--dur': `${dur}ms`,
    '--dur-slow': `${dur * 2}ms`
  } as CSSProperties
}
