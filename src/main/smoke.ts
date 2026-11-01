/**
 * Geliştirici testi (smoke test): `MIRILTI_SMOKE=40 electron .` ile çalışır.
 * Giriş penceresi açılmaz, ses kapatılır; adaptör gerçek YouTube Music'e karşı denenir
 * (arama → çalma → durum → sıra → sözler) ve sonuçlar konsola yazılır.
 */
import { app } from 'electron'
import { getPlayerState, sendCommand } from './player-bridge'
import { getPlayerWindow, playerEvents } from './windows/player'
import { getWidgetWindow, toggleWidgetOpen } from './windows/widget'
import { getSettingsWindow, openSettingsWindow } from './windows/settings'
import { getSettings, replaceSettings, updateSettings } from './store'
import type { DockMode } from '../shared/settings'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function smokeSeconds(): number {
  return Number(process.env['MIRILTI_SMOKE'] ?? 0)
}

export function runSmokeTest(loggedIn: boolean): void {
  const seconds = smokeSeconds()
  console.log(`[smoke] google oturumu: ${loggedIn}`)
  // MIRILTI_SMOKE_VOLUME0=1: pencereyi susturmak yerine oynatıcı sesini 0 yap (SMTC testi için)
  if (!process.env['MIRILTI_SMOKE_VOLUME0']) getPlayerWindow()?.webContents.setAudioMuted(true)
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

    if (process.env['MIRILTI_SMOKE_VOLUME0']) await sendCommand({ type: 'setVolume', volume: 0 })
    const played = await sendCommand({ type: 'playTarget', target: song.play as { videoId: string } })
    console.log('[smoke] çal:', played.ok ? 'tamam' : played.error)
    await sleep(6000)
    const s = getPlayerState()
    console.log('[smoke] durum:', JSON.stringify({ track: s.track, isPlaying: s.isPlaying, volume: s.volume, like: s.likeStatus, repeat: s.repeat, issues: s.adapterIssues, loggedIn: s.loggedIn }))

    await checkSystem()
    await captureWidget('pill')
    // Açılma animasyonunun kare sürelerini ölç
    const wc = getWidgetWindow()!.webContents
    void wc.executeJavaScript(`new Promise((done) => {
      const t = []; let last = performance.now(); const end = last + 600;
      const f = (now) => { t.push(now - last); last = now; now < end ? requestAnimationFrame(f) : (window.__frames = t, done()); };
      requestAnimationFrame(f);
    })`)
    toggleWidgetOpen()
    await sleep(900)
    const frames = (await wc.executeJavaScript('window.__frames')) as number[]
    const sorted = [...frames].sort((x, y) => x - y)
    console.log('[smoke] açılma kareleri:', frames.length, 'kare, ortalama', (frames.reduce((x, y) => x + y, 0) / frames.length).toFixed(1), 'ms, en kötü', sorted.at(-1)?.toFixed(1), 'ms')
    await captureWidget('open')
    // Fare tekerleğiyle 3 adım ses kıs ve göstergeyi yakala
    for (let i = 0; i < 3; i++) {
      await wc.executeJavaScript(`document.querySelector('.surface').dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true }))`)
      await sleep(80)
    }
    await sleep(150)
    await captureWidget('volume-osd')
    await sleep(900)
    console.log('[smoke] tekerlek sonrası ses:', getPlayerState().volume)
    const probe = await getWidgetWindow()?.webContents.executeJavaScript(`(() => {
      const f = document.querySelector('.progress-fill'); if (!f) return 'yok';
      const cs = getComputedStyle(f);
      return JSON.stringify({ cls: f.className, style: f.getAttribute('style'), transform: cs.transform, anim: cs.animationName, dur: cs.animationDuration, from: cs.getPropertyValue('--from') });
    })()`)
    console.log('[smoke] ilerleme:', probe)
    await captureTabs()
    await captureModes()

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
    // YouTube Music ses düzeyini oturuma kaydeder: testten sonra varsayılana döndür
    await sendCommand({ type: 'setVolume', volume: 100 })
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
  await click('Şarkı sözleri')
  await sleep(5000)
  await captureWidget('tab-lyrics')
}

/** Farklı konum modlarını ve ayarlar penceresini dener; sonunda ayarları geri yükler */
async function captureModes(): Promise<void> {
  const original = getSettings()
  try {
    openSettingsWindow()
    await sleep(2000)
    const sw = getSettingsWindow()
    if (sw) {
      const { writeFileSync } = await import('node:fs')
      writeFileSync('.smoke/settings.png', (await sw.webContents.capturePage()).toPNG())
      await sw.webContents.executeJavaScript(`[...document.querySelectorAll('.nav > button')][1].click()`)
      await sleep(600)
      writeFileSync('.smoke/settings-appearance.png', (await sw.webContents.capturePage()).toPNG())
      console.log('[smoke] görüntü: .smoke/settings*.png')
    }
    const modes: DockMode[] = ['edge-top', 'corner-bottom-left', 'floating']
    for (const mode of modes) {
      updateSettings({ position: { mode }, appearance: { colorScheme: mode === 'floating' ? 'light' : 'dark' } })
      await sleep(900)
      await captureWidget(`mode-${mode}`)
    }
  } finally {
    replaceSettings(original)
  }
}

/** Aşama 7 kontrolleri: tam ekran API'si, kısayollar ve Windows medya kontrolleri (SMTC) */
async function checkSystem(): Promise<void> {
  const koffi = (await import('koffi')).default
  const fn = koffi.load('shell32.dll').func('long __stdcall SHQueryUserNotificationState(_Out_ int *pquns)')
  const out = [0]
  console.log('[smoke] tam ekran API: hr =', fn(out), 'durum =', out[0])
  const { globalShortcut } = await import('electron')
  console.log('[smoke] kısayol kayıtlı (Alt+Shift+M):', globalShortcut.isRegistered('Alt+Shift+M'))
  const { execFile } = await import('node:child_process')
  const { join } = await import('node:path')
  await new Promise<void>((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(app.getAppPath(), 'scripts/smtc-sessions.ps1')], { timeout: 20000 }, (err, stdout, stderr) => {
      console.log('[smoke] SMTC oturumları:', err ? `HATA ${stderr || err.message}` : `
${stdout.trim() || '(yok)'}`)
      resolve()
    })
  })
}
