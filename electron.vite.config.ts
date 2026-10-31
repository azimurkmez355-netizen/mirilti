import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Not: "dependencies" içindeki paketler (yalnızca koffi) dışarıda bırakılır,
// "devDependencies" içindekiler (electron-store vb.) pakete gömülür.
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    build: {
      // Sandbox'lı preload'lar başka dosya require edemez; her giriş tek dosya olmalı.
      isolatedEntries: true,
      rollupOptions: {
        input: {
          // YouTube Music sayfasına köprü (izole dünya)
          ytm: resolve(__dirname, 'src/preload/ytm/index.ts'),
          // Sayfanın kendi dünyasına enjekte edilen adaptör (ana süreç okuyup çalıştırır)
          'ytm-adapter': resolve(__dirname, 'src/preload/ytm/ytm-adapter.ts'),
          // Widget ve ayarlar pencerelerinin ortak köprüsü
          app: resolve(__dirname, 'src/preload/app.ts')
        }
      }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          widget: resolve(__dirname, 'src/renderer/widget/index.html'),
          settings: resolve(__dirname, 'src/renderer/settings/index.html')
        }
      }
    }
  }
})
