/**
 * Tam ekran uygulama algılama (oyun, tam ekran video, sunum).
 *
 * Windows'un `SHQueryUserNotificationState` API'si, bildirim göstermenin uygun olup olmadığını
 * söyler; tam ekran bir uygulama öndeyse "meşgul" döner. Bu API'yi `koffi` ile (derleme
 * gerektirmeyen yerel çağrı kütüphanesi) çağırıyoruz.
 *
 * Windows'ta "tam ekran oldu" olayı olmadığı için yoklama gerekiyor; yalnızca ayar açıkken
 * ve 2 saniyede bir yapılır (tek bir sistem çağrısı, maliyeti ihmal edilebilir).
 */
import { getSettings, onSettingsChange } from './store'
import { setAutoHidden } from './windows/widget'

const POLL_MS = 2000

// QUERY_USER_NOTIFICATION_STATE değerleri
const QUNS_BUSY = 2 // tam ekran uygulama
const QUNS_RUNNING_D3D_FULL_SCREEN = 3 // tam ekran Direct3D (oyun)
const QUNS_PRESENTATION_MODE = 4 // sunum modu

type QueryFn = (out: number[]) => number

let query: QueryFn | null | undefined
let timer: NodeJS.Timeout | null = null

/** API'yi ilk kullanımda yükle; yüklenemezse özellik sessizce devre dışı kalır */
async function loadQuery(): Promise<QueryFn | null> {
  if (query !== undefined) return query
  try {
    const koffi = (await import('koffi')).default
    const shell32 = koffi.load('shell32.dll')
    query = shell32.func('long __stdcall SHQueryUserNotificationState(_Out_ int *pquns)') as QueryFn
  } catch (err) {
    console.warn('[fullscreen] Windows API yüklenemedi; tam ekranda gizleme kapalı:', err)
    query = null
  }
  return query
}

export function isFullscreenAppActive(fn: QueryFn): boolean {
  const out = [0]
  if (fn(out) !== 0) return false // HRESULT başarısız
  const state = out[0]
  return state === QUNS_BUSY || state === QUNS_RUNNING_D3D_FULL_SCREEN || state === QUNS_PRESENTATION_MODE
}

async function update(enabled: boolean): Promise<void> {
  if (timer) clearInterval(timer)
  timer = null
  if (!enabled || process.platform !== 'win32') {
    setAutoHidden(false)
    return
  }
  const fn = await loadQuery()
  if (!fn) return
  const tick = (): void => {
    try {
      setAutoHidden(isFullscreenAppActive(fn))
    } catch {
      setAutoHidden(false)
    }
  }
  tick()
  timer = setInterval(tick, POLL_MS)
}

export function initFullscreenWatcher(): void {
  void update(getSettings().behavior.autoHideFullscreen)
  onSettingsChange((next, prev) => {
    if (next.behavior.autoHideFullscreen !== prev.behavior.autoHideFullscreen) {
      void update(next.behavior.autoHideFullscreen)
    }
  })
}
