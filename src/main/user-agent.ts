/**
 * Google girişi için tarayıcı kimliği (user-agent).
 *
 * Google, Electron gibi "gömülü" tarayıcılardan girişi "Bu tarayıcı veya uygulama güvenli
 * olmayabilir" mesajıyla engelliyor. Bilinen çözüm: user-agent'tan "Electron/x.y" ve uygulama
 * adını çıkarıp standart bir Chrome kimliği göndermek. Bazı hesaplarda bu da yetmezse
 * Firefox kimliği işe yarıyor (ayarlardan seçilebilir).
 */
import type { LoginAgent } from '../shared/settings'

/** Electron'un içindeki Chromium sürümüyle uyumlu, sade bir Chrome kimliği */
export function chromeUserAgent(): string {
  const major = process.versions.chrome.split('.')[0]
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`
}

export function firefoxUserAgent(): string {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'
}

export function loginUserAgent(agent: LoginAgent): string {
  return agent === 'firefox' ? firefoxUserAgent() : chromeUserAgent()
}
