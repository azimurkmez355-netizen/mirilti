/**
 * Google giriş penceresi.
 * Gizli oynatıcıyla aynı oturum bölümünü (`persist:ytmusic`) kullanır; burada giriş yapılınca
 * çerezler oynatıcıya da geçer. Giriş tamamlanıp YouTube Music'e dönülünce pencere kapanır.
 */
import { BrowserWindow, shell } from 'electron'
import { appIcon } from '../paths'
import { getSettings, appState } from '../store'
import { loginUserAgent } from '../user-agent'
import { YTM_PARTITION, reloadPlayer } from './player'

const LOGIN_URL =
  'https://accounts.google.com/ServiceLogin?ltmpl=music&service=youtube&passive=true&continue=' +
  encodeURIComponent('https://www.youtube.com/signin?action_handle_signin=true&next=https://music.youtube.com/')

let win: BrowserWindow | null = null

export function openLoginWindow(): void {
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
    return
  }

  win = new BrowserWindow({
    width: 500,
    height: 720,
    title: 'Mırıltı – Google ile giriş yap',
    icon: appIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      partition: YTM_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  const contents = win.webContents
  // Yalnızca bu pencerenin kimliği değişir; oynatıcı her zaman Chrome kimliğiyle kalır.
  contents.setUserAgent(loginUserAgent(getSettings().behavior.loginAgent))

  const checkDone = (url: string): void => {
    let host = ''
    try {
      host = new URL(url).host
    } catch {
      return
    }
    if (host === 'music.youtube.com') {
      appState.hasLoggedInOnce = true
      reloadPlayer()
      win?.close()
    }
  }
  contents.on('did-navigate', (_e, url) => checkDone(url))
  contents.on('did-navigate-in-page', (_e, url) => checkDone(url))

  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.on('closed', () => {
    win = null
  })

  void contents.loadURL(LOGIN_URL)
}
