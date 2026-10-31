/**
 * Cam efekti arka planı: kapağın çok bulanık, büyütülmüş hâli + vurgu gradyanı.
 * (Şeffaf pencerede CSS backdrop-filter masaüstünü göremez; bu yüzden "cam" görünümü
 * kapağın kendisinden üretilir. Yerel Acrylic modunda gerçek masaüstü bulanıklığı görünür.)
 * Kapak değişince yeni görsel yüklenip eskisinin üstünde yumuşakça belirir.
 */
import { useEffect, useState } from 'react'

interface Layer {
  url: string
  loaded: boolean
}

export function Backdrop({ coverUrl, fitted }: { coverUrl: string; fitted: boolean }): React.JSX.Element {
  const [layers, setLayers] = useState<Layer[]>([])

  useEffect(() => {
    if (!coverUrl) return
    setLayers((prev) => (prev.at(-1)?.url === coverUrl ? prev : [...prev.slice(-1), { url: coverUrl, loaded: false }]))
  }, [coverUrl])

  const onLoad = (url: string): void => {
    setLayers((prev) => prev.map((l) => (l.url === url ? { ...l, loaded: true } : l)))
    // Geçiş bitince eski katmanı at
    window.setTimeout(() => setLayers((prev) => (prev.length > 1 && prev.at(-1)?.loaded ? prev.slice(-1) : prev)), 900)
  }

  return (
    <div className={`backdrop ${fitted ? 'is-fitted' : ''}`} aria-hidden>
      {layers.map((l) => (
        <img
          key={l.url}
          className={`backdrop-art ${l.loaded ? 'is-loaded' : ''}`}
          src={l.url}
          alt=""
          draggable={false}
          onLoad={() => onLoad(l.url)}
        />
      ))}
      <div className="backdrop-tint" />
      <div className="backdrop-sheen" />
    </div>
  )
}
