/**
 * Geliştirici testi (smoke test): `MIRILTI_SMOKE=40 electron .` ile çalışır.
 * Giriş penceresi açılmaz, ses kapatılır; adaptör gerçek YouTube Music'e karşı denenir
 * (arama → çalma → durum → sıra → sözler) ve sonuçlar konsola yazılır.
 */
import { app } from 'electron'
import { getPlayerState, sendCommand } from './player-bridge'
import { getPlayerWindow, playerEvents } from './windows/player'
import { getWidgetWindow, toggleWidgetOpen } from './windows/widget'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function smokeSeconds(): number {
  return Number(process.env['MIRILTI_SMOKE'] ?? 0)
}

export function runSmokeTest(loggedIn: boolean): void {
  const seconds = smokeSeconds()
  console.log(`[smoke] google oturumu: ${loggedIn}`)
  getPlayerWindow()?.webContents.setAudioMuted(true)
  setTimeout(() => app.quit(), seconds * 1000)

  playerEvents.once('loaded', async () => {
    console.log('[smoke] YouTube Music yüklendi')
    await sleep(5000)
    if (process.env['MIRILTI_SMOKE_DUMP']) await dumpRaw()
    const query = process.env['MIRILTI_SMOKE_QUERY'] ?? 'Tarkan Kuzu Kuzu'
    const search = await sendCommand({ type: 'search', query })
    if (!search.ok) return console.log('[smoke] arama HATA:', search.error)
    const sections = search.data as { title: string; items: { type: string; title: string; play: unknown }[] }[]
    console.log('[smoke] arama bölümleri:', sections.map((s) => `${s.title}(${s.items.length})`).join(', '))
    const song = sections.flatMap((s) => s.items).find((i) => i.type === 'song' && i.play)
    console.log('[smoke] ilk şarkı:', song?.title, JSON.stringify(song?.play))
    if (!song) return

    const played = await sendCommand({ type: 'playTarget', target: song.play as { videoId: string } })
    console.log('[smoke] çal:', played.ok ? 'tamam' : played.error)
    await sleep(6000)
    const s = getPlayerState()
    console.log('[smoke] durum:', JSON.stringify({ track: s.track, isPlaying: s.isPlaying, volume: s.volume, like: s.likeStatus, repeat: s.repeat, issues: s.adapterIssues, loggedIn: s.loggedIn }))

    await captureWidget('pill')
    toggleWidgetOpen()
    await sleep(900)
    await captureWidget('open')
    const probe = await getWidgetWindow()?.webContents.executeJavaScript(`(() => {
      const f = document.querySelector('.progress-fill'); if (!f) return 'yok';
      const cs = getComputedStyle(f);
      return JSON.stringify({ cls: f.className, style: f.getAttribute('style'), transform: cs.transform, anim: cs.animationName, dur: cs.animationDuration, from: cs.getPropertyValue('--from') });
    })()`)
    console.log('[smoke] ilerleme:', probe)
    await captureTabs()

    const queue = await sendCommand({ type: 'getQueue' })
    console.log('[smoke] sıra:', queue.ok ? `${(queue.data as unknown[]).length} öğe` : queue.error)
    if (queue.ok) console.log('[smoke] sıra[0..2]:', JSON.stringify((queue.data as unknown[]).slice(0, 3)))
    const other = sections.flatMap((x) => x.items).filter((i) => i.type === 'song' && i.play)[1]
    if (other) {
      const added = await sendCommand({ type: 'addToQueue', target: other.play as { videoId: string } })
      await sleep(1000)
      const q2 = await sendCommand({ type: 'getQueue' })
      console.log('[smoke] sıraya ekle:', added.ok ? 'tamam' : added.error, '→', q2.ok ? (q2.data as { title: string }[]).map((q) => q.title).join(' | ') : q2.error)
    }

    if (s.track?.videoId) {
      const lyrics = await sendCommand({ type: 'getLyrics', videoId: s.track.videoId })
      console.log('[smoke] YTM sözleri:', lyrics.ok ? String(lyrics.data ?? 'yok').slice(0, 80).replace(/\n/g, ' / ') : lyrics.error)
    }

    const vol = await sendCommand({ type: 'setVolume', volume: 40 })
    await sleep(500)
    console.log('[smoke] ses 40:', vol.ok ? getPlayerState().volume : vol.error)
    await sendCommand({ type: 'next' })
    await sleep(4000)
    console.log('[smoke] sonraki şarkı:', getPlayerState().track?.title)
    await sendCommand({ type: 'pause' })
    await sleep(800)
    console.log('[smoke] duraklat → isPlaying:', getPlayerState().isPlaying)
  })
}

/** Ham iç API yanıtlarını .smoke/ klasörüne yazar (adaptör ayrıştırmasını düzeltirken işe yarar) */
async function dumpRaw(): Promise<void> {
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync('.smoke', { recursive: true })
  const code = (endpoint: string, body: string): string => `(async () => {
    const cfg = window.ytcfg;
    const res = await fetch('/youtubei/v1/${endpoint}?prettyPrint=false', { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: cfg.get('INNERTUBE_CONTEXT'), ...${body} }) });
    return await res.text();
  })()`
  const wc = getPlayerWindow()!.webContents
  writeFileSync('.smoke/search.json', await wc.executeJavaScript(code('search', `{ query: ${JSON.stringify(process.env['MIRILTI_SMOKE_QUERY'] ?? 'Tarkan Kuzu Kuzu')} }`)))
  console.log('[smoke] ham yanıtlar .smoke/ klasörüne yazıldı')
}

/** Widget penceresinin görüntüsünü .smoke/<ad>.png olarak kaydeder */
export async function captureWidget(name: string): Promise<void> {
  const win = getWidgetWindow()
  if (!win) return
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync('.smoke', { recursive: true })
  const img = await win.webContents.capturePage()
  writeFileSync(`.smoke/${name}.png`, img.toPNG())
  console.log(`[smoke] görüntü: .smoke/${name}.png`)
}

/** Widget sekmelerini sırayla açıp görüntülerini alır */
async function captureTabs(): Promise<void> {
  const wc = getWidgetWindow()?.webContents
  if (!wc) return
  const click = (title: string): Promise<unknown> =>
    wc.executeJavaScript(`document.querySelector('.player button[title="${title}"]')?.click()`)
  await click('Ara')
  await sleep(500)
  // React denetimli input'a değer yazmak için yerel setter + input olayı
  await wc.executeJavaScript(`(() => {
    const input = document.querySelector('.search-box input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Sezen Aksu'); input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`)
  await sleep(3500)
  await captureWidget('tab-search')
  await click('Sıradaki')
  await sleep(1200)
  await captureWidget('tab-queue')
  await click('Kitaplık')
  await sleep(2500)
  await captureWidget('tab-library')
}
