// Arayüz tarafında `window.mirilti` için tip tanımı
import type { MiriltiApi } from '../shared/ipc'

declare global {
  interface Window {
    mirilti: MiriltiApi
  }
}

export {}
