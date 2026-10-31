/** Bağlantı / oturum / arayüz sorunlarında anlaşılır bir mesaj ve çözüm düğmesi gösterir */
import { AlertTriangle, LogIn, RefreshCw, WifiOff } from 'lucide-react'
import type { PlayerState } from '../../../shared/types'

export function StatusBanner({ state }: { state: PlayerState }): React.JSX.Element | null {
  if (state.connection === 'offline') {
    return (
      <div className="banner">
        <WifiOff size={13} /> <span>İnternet bağlantısı yok — yeniden deneniyor</span>
      </div>
    )
  }
  if (state.loggedIn === false) {
    return (
      <div className="banner">
        <LogIn size={13} /> <span>Google hesabına giriş yapılmadı</span>
        <button onClick={() => window.mirilti.openLogin()}>Giriş yap</button>
      </div>
    )
  }
  if (state.adapterIssues.length) {
    return (
      <div className="banner is-warning" title={state.adapterIssues.join('\n')}>
        <AlertTriangle size={13} /> <span>YouTube Music arayüzü değişmiş olabilir</span>
        <button onClick={() => window.mirilti.reloadPlayer()}>
          <RefreshCw size={11} /> Yenile
        </button>
      </div>
    )
  }
  if (state.connection === 'loading' && !state.track) {
    return (
      <div className="banner is-muted">
        <span>YouTube Music yükleniyor…</span>
      </div>
    )
  }
  return null
}
