/**
 * Şarkı sözleri.
 *
 * Kaynak sırası:
 *   1. LRCLIB'de senkron (zaman damgalı) söz varsa → satır satır akan sözler
 *   2. Yoksa YouTube Music'in kendi sözleri (düz metin)
 *   3. O da yoksa LRCLIB'in düz sözleri
 * İki kaynak paralel sorgulanır; sonuçlar şarkı başına önbelleğe alınır.
 *
 * LRCLIB: https://lrclib.net/docs — ücretsiz, anahtar gerektirmez; kendini tanıtan bir
 * User-Agent göndermemiz isteniyor.
 */
import { app, ipcMain, net } from 'electron'
import { IPC, type Result } from '../shared/ipc'
import { parseLrc } from '../shared/lrc'
import type { Lyrics } from '../shared/types'
import { sendCommand } from './player-bridge'

const LRCLIB = 'https://lrclib.net/api'
const USER_AGENT = `Mirilti/${app.getVersion()} (https://github.com/azimurkmez355-netizen/mirilti)`

interface TrackQuery {
  videoId: string
  title: string
  artist: string
  album: string
  duration: number
}

interface LrclibRecord {
  trackName?: string
  artistName?: string
  duration?: number
  instrumental?: boolean
  plainLyrics?: string | null
  syncedLyrics?: string | null
}

const cache = new Map<string, Lyrics>()

export function initLyrics(): void {
  ipcMain.handle(IPC.lyricsGet, async (_e, raw: unknown): Promise<Result<Lyrics>> => {
    const track = validate(raw)
    if (!track) return { ok: false, error: 'Geçersiz şarkı bilgisi' }
    try {
      return { ok: true, data: await getLyrics(track) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

async function getLyrics(track: TrackQuery): Promise<Lyrics> {
  const cached = cache.get(track.videoId)
  if (cached) return cached

  const [lrc, ytm] = await Promise.allSettled([fromLrclib(track), sendCommand({ type: 'getLyrics', videoId: track.videoId })])
  const record = lrc.status === 'fulfilled' ? lrc.value : null
  const ytmText = ytm.status === 'fulfilled' && ytm.value.ok && typeof ytm.value.data === 'string' ? ytm.value.data : null

  let result: Lyrics
  const synced = record?.syncedLyrics ? parseLrc(record.syncedLyrics) : null
  if (synced?.length) {
    result = { synced, plain: ytmText ?? record?.plainLyrics ?? null, source: 'lrclib' }
  } else if (ytmText) {
    result = { synced: null, plain: ytmText, source: 'youtube-music' }
  } else if (record?.plainLyrics) {
    result = { synced: null, plain: record.plainLyrics, source: 'lrclib' }
  } else {
    // İki kaynak da ağ hatası verdiyse önbelleğe alma; sonra tekrar denensin
    if (lrc.status === 'rejected' && (ytm.status === 'rejected' || (ytm.status === 'fulfilled' && !ytm.value.ok))) {
      throw new Error('Şarkı sözleri alınamadı (bağlantıyı kontrol et)')
    }
    result = { synced: null, plain: null, source: null }
  }

  cache.set(track.videoId, result)
  if (cache.size > 100) cache.delete(cache.keys().next().value!)
  return result
}

/** Önce tam eşleşme (/get), bulunamazsa arama (/search) ile en yakın süreyi seç */
async function fromLrclib(track: TrackQuery): Promise<LrclibRecord | null> {
  // Geliştirme testi: MIRILTI_FAKE_LRC=dosya.lrc verilirse her şarkı için o dosya kullanılır
  const fake = process.env['MIRILTI_FAKE_LRC']
  if (fake && !app.isPackaged) {
    const { readFile } = await import('node:fs/promises')
    return { syncedLyrics: await readFile(fake, 'utf8') }
  }
  const artist = track.artist.split(/,|&| ve | feat\.? | ft\.? /i)[0].trim()
  const exact = new URLSearchParams({ track_name: track.title, artist_name: artist })
  if (track.album) exact.set('album_name', track.album)
  if (track.duration) exact.set('duration', String(Math.round(track.duration)))
  const hit = await lrclibFetch<LrclibRecord>(`/get?${exact}`)
  if (hit?.syncedLyrics || hit?.plainLyrics) return hit

  // "(Official Video)", "[Remastered]" gibi ekleri at ve ara
  const title = track.title.replace(/\s*[([].*?[)\]]\s*/g, ' ').trim()
  const list = await lrclibFetch<LrclibRecord[]>(`/search?${new URLSearchParams({ track_name: title, artist_name: artist })}`)
  if (!Array.isArray(list) || !list.length) return null
  const score = (r: LrclibRecord): number =>
    (r.syncedLyrics ? 0 : 1000) + (track.duration && r.duration ? Math.abs(r.duration - track.duration) : 100)
  const best = [...list].sort((a, b) => score(a) - score(b))[0]
  // Süre çok farklıysa büyük ihtimalle başka bir kayıt
  if (track.duration && best.duration && Math.abs(best.duration - track.duration) > 15) return null
  return best
}

async function lrclibFetch<T>(path: string): Promise<T | null> {
  const res = await net.fetch(`${LRCLIB}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`LRCLIB hatası (${res.status})`)
  return (await res.json()) as T
}

function validate(raw: unknown): TrackQuery | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  const str = (v: unknown): v is string => typeof v === 'string' && v.length <= 300
  if (!str(t.videoId) || !t.videoId || !str(t.title) || !t.title || !str(t.artist) || !str(t.album)) return null
  return {
    videoId: t.videoId,
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration: typeof t.duration === 'number' && Number.isFinite(t.duration) ? t.duration : 0
  }
}
