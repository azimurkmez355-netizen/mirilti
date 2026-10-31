/**
 * Albüm kapağından renk paleti çıkarma.
 *
 * Kapak ana süreçte indirilir (tarayıcıdaki CORS kısıtlamalarına takılmamak için),
 * Electron'un nativeImage'ı ile 32x32'ye küçültülür ve pikseller renk kutularına
 * gruplanır. Harici kütüphane gerekmez; 1024 piksel üzerinde basit bir histogram yeterli.
 *
 *  - accent: en canlı ve yeterince sık görülen renk (ilerleme çubuğu, vurgular)
 *  - bgFrom / bgTo: en baskın renklerin koyulaştırılmış hâlleri (arka plan gradyanı)
 */
import { nativeImage, net } from 'electron'
import type { CoverPalette } from '../shared/types'

const cache = new Map<string, CoverPalette | null>()

interface Bucket {
  r: number
  g: number
  b: number
  count: number
}

export async function extractPalette(url: string): Promise<CoverPalette | null> {
  if (!url) return null
  if (cache.has(url)) return cache.get(url)!
  try {
    const res = await net.fetch(smallCoverUrl(url))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const img = nativeImage.createFromBuffer(Buffer.from(await res.arrayBuffer()))
    if (img.isEmpty()) throw new Error('görsel çözülemedi')
    const palette = paletteFromBitmap(img.resize({ width: 32, height: 32, quality: 'good' }).toBitmap())
    remember(url, palette)
    return palette
  } catch (err) {
    console.warn('[colors] palet çıkarılamadı:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Google görsel adreslerinde boyut parametresi vardır: küçük sürümü iste (daha hızlı) */
function smallCoverUrl(url: string): string {
  return url.replace(/=w\d+-h\d+[^/]*$/, '=w64-h64-l90-rj')
}

function remember(url: string, palette: CoverPalette | null): void {
  cache.set(url, palette)
  if (cache.size > 60) cache.delete(cache.keys().next().value!)
}

function paletteFromBitmap(bmp: Buffer): CoverPalette | null {
  // toBitmap() Windows'ta BGRA sırasıyla döner
  const buckets = new Map<number, Bucket>()
  for (let i = 0; i + 3 < bmp.length; i += 4) {
    if (bmp[i + 3] < 128) continue
    const b = bmp[i]
    const g = bmp[i + 1]
    const r = bmp[i + 2]
    // Kanal başına 16 seviye → 4096 kutu
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 }
    bucket.r += r
    bucket.g += g
    bucket.b += b
    bucket.count++
    buckets.set(key, bucket)
  }
  if (!buckets.size) return null

  const colors = [...buckets.values()]
    .map((bk) => ({ hsl: rgbToHsl(bk.r / bk.count, bk.g / bk.count, bk.b / bk.count), count: bk.count }))
    .sort((a, b) => b.count - a.count)

  // Vurgu rengi: doygunluk ve sıklığın birlikte yüksek olduğu, çok koyu/açık olmayan renk
  let accent = colors[0].hsl
  let bestScore = -1
  for (const c of colors) {
    const [, s, l] = c.hsl
    const lightPenalty = l < 0.15 || l > 0.92 ? 0.15 : 1
    const score = Math.sqrt(c.count) * (0.15 + s * s) * lightPenalty
    if (score > bestScore) {
      bestScore = score
      accent = c.hsl
    }
  }
  const [ah, as] = accent
  const accentHsl: [number, number, number] = [ah, Math.max(as, 0.45), 0.62]

  // Arka plan: en baskın iki rengin koyu tonları
  const dominant = colors[0].hsl
  const second = colors.find((c) => Math.abs(c.hsl[0] - dominant[0]) > 0.08)?.hsl ?? accentHsl
  const bgFrom: [number, number, number] = [dominant[0], Math.min(dominant[1], 0.6), 0.2]
  const bgTo: [number, number, number] = [second[0], Math.min(second[1], 0.6), 0.1]

  return {
    accent: hslCss(accentHsl),
    onAccent: '#0b0b0f',
    bgFrom: hslCss(bgFrom),
    bgTo: hslCss(bgTo)
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h / 6, s, l]
}

function hslCss([h, s, l]: [number, number, number]): string {
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`
}
