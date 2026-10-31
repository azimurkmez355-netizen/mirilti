/**
 * Uygulama ve tepsi ikonlarını üretir (harici kütüphane gerekmez).
 * Çizim: mor→pembe gradyanlı yuvarlatılmış kare + ortada beyaz ses dalgası çubukları.
 * Kenar yumuşatma için her pikselde 4x4 alt örnekleme yapılır.
 *
 * Çalıştırma: npm run icons
 * Çıktılar: resources/icon.png (512), resources/tray.png (16), resources/tray@2x.png (32)
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'resources')
mkdirSync(outDir, { recursive: true })

const FROM = [139, 92, 246] // #8b5cf6
const TO = [236, 72, 153] // #ec4899
const BARS = [0.3, 0.56, 0.78, 0.56, 0.3] // çubuk yükseklikleri (ikon boyutuna oranla)

/** Yuvarlatılmış dikdörtgen için işaretli uzaklık (içeride negatif) */
function roundedRectSdf(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r
  const qy = Math.abs(py - cy) - hh + r
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return outside + Math.min(Math.max(qx, qy), 0) - r
}

/** 0-1 aralığındaki koordinatta rengi döndürür: [r,g,b,a] */
function sample(u, v, { bars }) {
  // Arka plan: yuvarlatılmış kare
  const bg = roundedRectSdf(u, v, 0.5, 0.5, 0.46, 0.46, 0.22)
  if (bg > 0) return [0, 0, 0, 0]
  const t = Math.min(1, Math.max(0, (u + v) / 2))
  let color = FROM.map((c, i) => c + (TO[i] - c) * t)

  if (bars) {
    const barW = 0.085
    const gap = 0.05
    const total = BARS.length * barW + (BARS.length - 1) * gap
    const start = 0.5 - total / 2
    for (let i = 0; i < BARS.length; i++) {
      const cx = start + i * (barW + gap) + barW / 2
      const d = roundedRectSdf(u, v, cx, 0.5, barW / 2, BARS[i] / 2, barW / 2)
      if (d <= 0) color = [255, 255, 255]
    }
  }
  return [...color, 255]
}

function render(size, opts) {
  const SS = 4
  const data = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, opts)
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca
        }
      }
      const i = (y * size + x) * 4
      const n = SS * SS
      data[i] = a ? Math.round(r / a) : 0
      data[i + 1] = a ? Math.round(g / a) : 0
      data[i + 2] = a ? Math.round(b / a) : 0
      data[i + 3] = Math.round(a / n)
    }
  }
  return encodePng(size, size, data)
}

// --- Minimal PNG kodlayıcı ---
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit derinliği
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0 // filtre yok
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

writeFileSync(join(outDir, 'icon.png'), render(512, { bars: true }))
writeFileSync(join(outDir, 'tray.png'), render(16, { bars: true }))
writeFileSync(join(outDir, 'tray@2x.png'), render(32, { bars: true }))
console.log('İkonlar resources/ klasörüne yazıldı.')
