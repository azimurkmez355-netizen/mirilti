/**
 * Ayarlar ekranı. Her değişiklik anında ana sürece gönderilir; widget canlı güncellenir.
 * "Önizleme" anahtarı açıkken widget açık tutulur, böylece görünüm değişiklikleri hemen görülür.
 */
import { useEffect, useState } from 'react'
import {
  Download,
  Eye,
  Keyboard,
  LayoutGrid,
  LogIn,
  Monitor,
  MousePointer2,
  Palette,
  RefreshCw,
  RotateCcw,
  Settings2,
  Upload
} from 'lucide-react'
import type { SystemInfo } from '../../shared/ipc'
import type { Settings, SettingsPatch, ShortcutSettings, SizePreset } from '../../shared/settings'
import { useSettings } from '../common/hooks'
import { Card, Row, Segmented, Slider, Toggle } from './controls'
import { PositionPicker } from './PositionPicker'
import { ShortcutInput } from './ShortcutInput'

type SectionId = 'position' | 'appearance' | 'sections' | 'shortcuts' | 'system' | 'backup'

const NAV: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: 'position', label: 'Konum ve davranış', icon: <MousePointer2 size={16} /> },
  { id: 'appearance', label: 'Görünüm', icon: <Palette size={16} /> },
  { id: 'sections', label: 'Bölümler', icon: <LayoutGrid size={16} /> },
  { id: 'shortcuts', label: 'Kısayollar', icon: <Keyboard size={16} /> },
  { id: 'system', label: 'Sistem ve hesap', icon: <Monitor size={16} /> },
  { id: 'backup', label: 'Yedekleme', icon: <Settings2 size={16} /> }
]

const set = (patch: SettingsPatch): void => {
  void window.mirilti.setSettings(patch)
}

export function App(): React.JSX.Element | null {
  const settings = useSettings()
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [section, setSection] = useState<SectionId>('position')
  const [preview, setPreview] = useState(false)

  // Monitörler ve kısayol hataları; ayar değişince (kısayollar yeniden kaydedilince) tazele
  useEffect(() => {
    const t = window.setTimeout(() => void window.mirilti.getSystemInfo().then(setInfo), 150)
    return () => window.clearTimeout(t)
  }, [settings])

  useEffect(() => {
    window.mirilti.previewWidget(preview)
  }, [preview])

  if (!settings || !info) return null

  return (
    <div className="layout">
      <nav className="nav">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <strong>Mırıltı</strong>
            <small>v{info.version}</small>
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.id} className={section === n.id ? 'is-on' : ''} onClick={() => setSection(n.id)}>
            {n.icon}
            {n.label}
          </button>
        ))}
        <label className="preview-switch">
          <Eye size={15} />
          <span>Widget'ı açık tut (önizleme)</span>
          <Toggle checked={preview} onChange={setPreview} label="Önizleme" />
        </label>
      </nav>

      <main className="content">
        {section === 'position' && <PositionSection settings={settings} info={info} />}
        {section === 'appearance' && <AppearanceSection settings={settings} info={info} />}
        {section === 'sections' && <SectionsSection settings={settings} />}
        {section === 'shortcuts' && <ShortcutsSection settings={settings} info={info} />}
        {section === 'system' && <SystemSection settings={settings} info={info} />}
        {section === 'backup' && <BackupSection />}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------

function PositionSection({ settings, info }: { settings: Settings; info: SystemInfo }): React.JSX.Element {
  const { position, trigger, behavior } = settings
  const isEdge = position.mode.startsWith('edge')
  const vertical = position.mode === 'edge-left' || position.mode === 'edge-right'

  // En az bir açılma yöntemi açık kalmalı, yoksa widget hiç açılamaz
  const triggerCount = [trigger.hover, trigger.click, trigger.hotkey].filter(Boolean).length
  const setTrigger = (key: 'hover' | 'click' | 'hotkey', v: boolean): void => {
    if (!v && triggerCount === 1) return
    set({ trigger: { [key]: v } })
  }

  return (
    <>
      <h2>Konum ve davranış</h2>
      <Card title="Konum" description="Widget'ın ekranda nerede duracağını seç. Kenar ve yüzen modlarda widget'ı sürükleyerek de taşıyabilirsin.">
        <PositionPicker value={position.mode} onChange={(mode) => set({ position: { mode } })} />
        {isEdge && (
          <Row label={vertical ? 'Dikey konum' : 'Yatay konum'} hint="Kenar boyunca nerede dursun">
            <Slider
              label="Kenar konumu"
              value={position.edgeOffset}
              min={0}
              max={1}
              step={0.01}
              format={(v) => `%${Math.round(v * 100)}`}
              onChange={(v) => set({ position: { edgeOffset: v } })}
            />
          </Row>
        )}
        <Row label="Ekran" hint="Birden fazla monitör varsa hangisinde dursun">
          <select
            value={position.displayId ?? ''}
            onChange={(e) => set({ position: { displayId: e.target.value === '' ? null : Number(e.target.value) } })}
          >
            <option value="">Birincil ekran</option>
            {info.displays.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
                {d.primary ? ' (birincil)' : ''}
              </option>
            ))}
          </select>
        </Row>
      </Card>

      <Card title="Açılma" description="Widget nasıl açılsın? Birden fazlasını aynı anda seçebilirsin.">
        <Row label="Üzerine gelince (hover)">
          <Toggle label="Hover" checked={trigger.hover} onChange={(v) => setTrigger('hover', v)} />
        </Row>
        <Row label="Tıklayınca">
          <Toggle label="Tıklama" checked={trigger.click} onChange={(v) => setTrigger('click', v)} />
        </Row>
        <Row label="Kısayol tuşuyla" hint={`Şu anki kısayol: ${settings.shortcuts.toggleWidget || 'atanmamış'}`}>
          <Toggle label="Kısayol" checked={trigger.hotkey} onChange={(v) => setTrigger('hotkey', v)} />
        </Row>
        <Row label="Açılma gecikmesi" hint="Fare üzerine geldikten sonra" disabled={!trigger.hover}>
          <Slider label="Açılma gecikmesi" value={trigger.openDelay} min={0} max={1500} step={10} format={(v) => `${v} ms`} disabled={!trigger.hover} onChange={(v) => set({ trigger: { openDelay: v } })} />
        </Row>
        <Row label="Kapanma gecikmesi" hint="Fare ayrıldıktan sonra" disabled={!trigger.hover}>
          <Slider label="Kapanma gecikmesi" value={trigger.closeDelay} min={0} max={3000} step={10} format={(v) => `${v} ms`} disabled={!trigger.hover} onChange={(v) => set({ trigger: { closeDelay: v } })} />
        </Row>
      </Card>

      <Card title="Davranış">
        <Row label="Tam ekranda gizle" hint="Oyun, video ya da sunum tam ekrandayken widget kaybolsun">
          <Toggle label="Tam ekranda gizle" checked={behavior.autoHideFullscreen} onChange={(v) => set({ behavior: { autoHideFullscreen: v } })} />
        </Row>
      </Card>
    </>
  )
}

function AppearanceSection({ settings, info }: { settings: Settings; info: SystemInfo }): React.JSX.Element {
  const a = settings.appearance
  return (
    <>
      <h2>Görünüm</h2>
      <Card title="Boyut ve şekil">
        <Row label="Boyut">
          <Segmented<SizePreset>
            label="Boyut"
            value={a.size}
            options={[
              { value: 'small', label: 'Küçük' },
              { value: 'medium', label: 'Orta' },
              { value: 'large', label: 'Büyük' }
            ]}
            onChange={(v) => set({ appearance: { size: v } })}
          />
        </Row>
        <Row label="Özel ölçek" hint="Seçilen boyutun üzerine ek çarpan">
          <Slider label="Ölçek" value={a.scale} min={0.7} max={1.6} step={0.05} format={(v) => `×${v.toFixed(2)}`} onChange={(v) => set({ appearance: { scale: v } })} />
        </Row>
        <Row label="Köşe yuvarlaklığı">
          <Slider label="Köşe yuvarlaklığı" value={a.radius} min={0} max={32} step={1} format={(v) => `${v} px`} onChange={(v) => set({ appearance: { radius: v } })} />
        </Row>
      </Card>

      <Card title="Cam efekti">
        <Row label="Arka plan opaklığı" hint="Düşük değer = daha saydam">
          <Slider label="Opaklık" value={a.opacity} min={0.3} max={1} step={0.01} format={(v) => `%${Math.round(v * 100)}`} onChange={(v) => set({ appearance: { opacity: v } })} />
        </Row>
        <Row label="Bulanıklık">
          <Slider label="Bulanıklık" value={a.blur} min={0} max={60} step={1} format={(v) => `${v} px`} onChange={(v) => set({ appearance: { blur: v } })} />
        </Row>
        <Row
          label="Windows 11 Acrylic"
          hint={info.supportsNativeMaterial ? 'Masaüstünü gerçekten bulanıklaştırır. Açılma animasyonu sadeleşir.' : 'Windows 11 22H2 veya sonrası gerekir'}
          disabled={!info.supportsNativeMaterial}
        >
          <Toggle label="Acrylic" checked={a.nativeMaterial} disabled={!info.supportsNativeMaterial} onChange={(v) => set({ appearance: { nativeMaterial: v } })} />
        </Row>
      </Card>

      <Card title="Renkler">
        <Row label="Vurgu rengi">
          <Segmented
            label="Vurgu rengi"
            value={a.accentMode}
            options={[
              { value: 'cover', label: 'Kapağa göre' },
              { value: 'fixed', label: 'Sabit renk' }
            ]}
            onChange={(v) => set({ appearance: { accentMode: v } })}
          />
        </Row>
        {a.accentMode === 'fixed' && (
          <Row label="Renk">
            <input type="color" value={a.fixedAccent} onChange={(e) => set({ appearance: { fixedAccent: e.target.value } })} />
          </Row>
        )}
        <Row label="Tema">
          <Segmented
            label="Tema"
            value={a.colorScheme}
            options={[
              { value: 'dark', label: 'Koyu' },
              { value: 'light', label: 'Açık' }
            ]}
            onChange={(v) => set({ appearance: { colorScheme: v } })}
          />
        </Row>
      </Card>

      <Card title="Animasyon">
        <Row label="Animasyon hızı" hint="En solda animasyonlar kapanır">
          <Slider
            label="Animasyon hızı"
            value={a.animationSpeed}
            min={0}
            max={2}
            step={0.25}
            format={(v) => (v === 0 ? 'Kapalı' : `×${v}`)}
            onChange={(v) => set({ appearance: { animationSpeed: v } })}
          />
        </Row>
      </Card>
    </>
  )
}

function SectionsSection({ settings }: { settings: Settings }): React.JSX.Element {
  const s = settings.sections
  const items: { key: keyof Settings['sections']; label: string; hint?: string }[] = [
    { key: 'album', label: 'Albüm adı' },
    { key: 'like', label: 'Beğen / beğenme düğmeleri' },
    { key: 'shuffleRepeat', label: 'Karıştır ve tekrar düğmeleri' },
    { key: 'volume', label: 'Ses kaydırıcısı', hint: 'Fare tekerleğiyle ses ayarı her zaman çalışır' },
    { key: 'lyrics', label: 'Şarkı sözleri sekmesi' },
    { key: 'queue', label: 'Sıradaki sekmesi' },
    { key: 'search', label: 'Arama sekmesi' },
    { key: 'library', label: 'Kitaplık sekmesi' }
  ]
  return (
    <>
      <h2>Bölümler</h2>
      <Card title="Görünecek düğmeler ve sekmeler">
        {items.map((it) => (
          <Row key={it.key} label={it.label} hint={it.hint}>
            <Toggle label={it.label} checked={s[it.key]} onChange={(v) => set({ sections: { [it.key]: v } })} />
          </Row>
        ))}
      </Card>
    </>
  )
}

function ShortcutsSection({ settings, info }: { settings: Settings; info: SystemInfo }): React.JSX.Element {
  const items: { key: keyof ShortcutSettings; label: string }[] = [
    { key: 'toggleWidget', label: "Widget'ı aç / kapat" },
    { key: 'playPause', label: 'Oynat / duraklat' },
    { key: 'next', label: 'Sonraki şarkı' },
    { key: 'previous', label: 'Önceki şarkı' },
    { key: 'like', label: 'Beğen' },
    { key: 'volumeUp', label: 'Sesi aç' },
    { key: 'volumeDown', label: 'Sesi kıs' }
  ]
  return (
    <>
      <h2>Kısayollar</h2>
      <Card title="Global kısayollar" description="Her uygulamanın içindeyken çalışır. Değiştirmek için kutuya tıklayıp yeni tuş kombinasyonuna bas.">
        {items.map((it) => (
          <Row key={it.key} label={it.label}>
            <ShortcutInput label={it.label} value={settings.shortcuts[it.key]} onChange={(v) => set({ shortcuts: { [it.key]: v } })} />
          </Row>
        ))}
        {info.shortcutErrors.length > 0 && (
          <div className="notice is-warning">
            Şu kısayollar kaydedilemedi (başka bir uygulama kullanıyor olabilir): {info.shortcutErrors.join(', ')}
          </div>
        )}
      </Card>
      <Card title="Medya tuşları">
        <Row
          label="Medya tuşlarını ayrıca yakala"
          hint="Klavyedeki ⏯ ⏭ ⏮ tuşları normalde Windows üzerinden zaten çalışır. Çalışmıyorsa bunu aç."
        >
          <Toggle label="Medya tuşları" checked={settings.behavior.captureMediaKeys} onChange={(v) => set({ behavior: { captureMediaKeys: v } })} />
        </Row>
      </Card>
    </>
  )
}

function SystemSection({ settings, info }: { settings: Settings; info: SystemInfo }): React.JSX.Element {
  const b = settings.behavior
  return (
    <>
      <h2>Sistem ve hesap</h2>
      <Card title="Windows">
        <Row label="Windows açılınca başlat" hint={info.isPackaged ? undefined : 'Yalnızca kurulu sürümde etkin (geliştirme modunda değil)'}>
          <Toggle label="Otomatik başlat" checked={b.autoStart} onChange={(v) => set({ behavior: { autoStart: v } })} />
        </Row>
        <Row label="Şarkı değişince bildirim göster">
          <Toggle label="Bildirim" checked={b.notifications} onChange={(v) => set({ behavior: { notifications: v } })} />
        </Row>
      </Card>

      <Card title="YouTube Music hesabı">
        <Row label="Google ile giriş yap" hint="Oturum bir kez açılır ve hatırlanır">
          <button className="btn" onClick={() => window.mirilti.openLogin()}>
            <LogIn size={15} /> Giriş penceresini aç
          </button>
        </Row>
        <Row label="Giriş tarayıcı kimliği" hint={'Google "Bu tarayıcı güvenli olmayabilir" derse Firefox\'u dene'}>
          <Segmented
            label="Tarayıcı kimliği"
            value={b.loginAgent}
            options={[
              { value: 'chrome', label: 'Chrome' },
              { value: 'firefox', label: 'Firefox' }
            ]}
            onChange={(v) => set({ behavior: { loginAgent: v } })}
          />
        </Row>
        <Row label="YouTube Music penceresi" hint="Gizli oynatıcıyı görünür aç (sorun giderme)">
          <div className="btn-group">
            <button className="btn" onClick={() => window.mirilti.openPlayer()}>
              Pencereyi aç
            </button>
            <button className="btn" onClick={() => window.mirilti.reloadPlayer()}>
              <RefreshCw size={14} /> Yeniden yükle
            </button>
          </div>
        </Row>
      </Card>
    </>
  )
}

function BackupSection(): React.JSX.Element {
  const [message, setMessage] = useState<{ text: string; warn?: boolean } | null>(null)

  const doExport = async (): Promise<void> => {
    const res = await window.mirilti.exportSettings()
    if (!res.ok) setMessage({ text: res.error, warn: true })
    else if (res.data) setMessage({ text: `Kaydedildi: ${res.data}` })
  }
  const doImport = async (): Promise<void> => {
    const res = await window.mirilti.importSettings()
    if (!res.ok) setMessage({ text: res.error, warn: true })
    else if (res.data) setMessage({ text: 'Ayarlar içe aktarıldı.' })
  }
  const doReset = async (): Promise<void> => {
    if (!window.confirm('Tüm ayarlar varsayılana dönsün mü?')) return
    await window.mirilti.resetSettings()
    setMessage({ text: 'Ayarlar sıfırlandı.' })
  }

  return (
    <>
      <h2>Yedekleme</h2>
      <Card title="Ayarları taşı" description="Ayarlarını bir JSON dosyasına kaydedip başka bir bilgisayara aktarabilirsin.">
        <div className="btn-group">
          <button className="btn" onClick={() => void doExport()}>
            <Download size={15} /> Dışa aktar
          </button>
          <button className="btn" onClick={() => void doImport()}>
            <Upload size={15} /> İçe aktar
          </button>
        </div>
      </Card>
      <Card title="Sıfırla">
        <button className="btn is-danger" onClick={() => void doReset()}>
          <RotateCcw size={15} /> Varsayılan ayarlara dön
        </button>
      </Card>
      {message && <div className={`notice ${message.warn ? 'is-warning' : ''}`}>{message.text}</div>}
    </>
  )
}
