# Mırıltı

YouTube Music için Windows 10/11 masaüstü mini oynatıcı. Müziği arka planda gizli bir pencerede çalar; ekranın kenarında ince bir şerit olarak durur, fareyle üzerine gelince cam efektli bir oynatıcıya dönüşür. Chrome sekmesine gerek kalmaz.

> Uygulama yalnızca YouTube Music'in kendi web oynatıcısını kontrol eder. Reklam engelleme ya da şarkı indirme yoktur.

## Özellikler

- **Widget:** Kapak, şarkı adı, sanatçı, albüm. Oynat/durdur, ileri/geri, karıştır, tekrar. Sürüklenebilir ilerleme çubuğu, ses kaydırıcısı ve fare tekerleğiyle ses ayarı.
- **Beğen / beğenme:** Durum YouTube Music ile eşzamanlıdır.
- **Sekmeler:**
  - Sıradaki listesi
  - Arama: çal ya da sıraya ekle
  - Kitaplık: çalma listeleri ve Beğenilen müzikler
  - Şarkı sözleri: LRCLIB'den satır satır akan senkron sözler; senkron yoksa YouTube Music sözleri
- **Konum:** Sağ, sol, üst ("dynamic island") ya da alt kenar; dört köşe; serbestçe sürüklenebilen yüzen balon. Çoklu monitör desteklenir.
- **Açılma:** Hover, tıklama ve kısayol tuşu; birden fazlası aynı anda seçilebilir. Açılma ve kapanma gecikmeleri ayarlanabilir.
- **Tasarım:**
  - Kapağa göre değişen renkler (yumuşak geçişli)
  - Bulanık cam arka plan; isteğe bağlı olarak Windows 11 yerel Acrylic
  - Açık ya da koyu tema
  - Animasyon hızı ayarlanabilir, istenirse kapatılabilir
- **Sistem:**
  - Medya tuşları ve Windows ses kutusu (SMTC)
  - Özelleştirilebilir global kısayollar
  - İsteğe bağlı şarkı bildirimi
  - Windows açılışında başlatma
  - Tam ekran oyun/videoda otomatik gizlenme
  - Tepside çalmaya devam etme
- **Ayarlar:** Tüm seçenekler canlı önizlemeyle değişir. Ayarlar JSON olarak dışa/içe aktarılabilir ve sıfırlanabilir.

## Gereksinimler

- Windows 10 veya 11 (Acrylic için Windows 11 22H2+)
- [Node.js](https://nodejs.org/) 22 veya üzeri (yalnızca geliştirme ve paketleme için)

## Kurulum (geliştirme)

```powershell
git clone https://github.com/azimurkmez355-netizen/mirilti.git
cd mirilti
npm install
```

## Geliştirme modunda çalıştırma

```powershell
npm run dev
```

Arayüz kodunu (React) değiştirince widget anında yenilenir. Ana süreç kodunu (`src/main`) değiştirince uygulama kendiliğinden yeniden başlar.

İlk açılışta Google giriş penceresi açılır. Giriş bir kez yapılır ve hatırlanır (`persist:ytmusic` oturumu).

## Paketleme (Windows kurulum dosyası)

```powershell
npm run build
```

Bu komut sırasıyla tip denetimi yapar, kodu derler ve `electron-builder` ile `dist/Mirilti-Kurulum-<sürüm>.exe` dosyasını üretir.

- Kurulum dosyası imzasız olduğu için Windows SmartScreen "Bilinmeyen yayımcı" uyarısı gösterebilir. **Ek bilgi → Yine de çalıştır** ile devam edebilirsin.
- Uygulama ikonunu değiştirmek istersen `scripts/generate-icons.mjs` dosyasını düzenleyip `npm run icons` çalıştır.

Diğer komutlar:

| Komut | Ne yapar |
| --- | --- |
| `npm run typecheck` | TypeScript tip denetimi |
| `npm run compile` | Yalnızca derler (`out/`), kurulum dosyası üretmez |
| `npm start` | Derlenmiş sürümü çalıştırır |

## Kullanım

- **Widget:** Varsayılan olarak ekranın sağ kenarında durur. Üzerine gelince açılır, fare ayrılınca kapanır. Kenar ya da yüzen moddayken sürükleyerek yerini değiştirebilirsin.
- **Tepsi simgesi:** Sol tık widget'ı gösterir/gizler. Sağ tık menüsünde oynat/duraklat, sonraki/önceki, ayarlar, YouTube Music penceresi ve çıkış bulunur.
- **Pencereyi kapatmak** uygulamayı kapatmaz; müzik tepside çalmaya devam eder. Tamamen çıkmak için tepsi menüsünden **Çıkış**'ı seç.

Varsayılan kısayollar (Ayarlar → Kısayollar'dan değiştirilebilir):

| Kısayol | İşlev |
| --- | --- |
| `Alt+Shift+M` | Widget'ı aç / kapat |
| `Alt+Shift+P` | Oynat / duraklat |
| `Alt+Shift+→` / `←` | Sonraki / önceki şarkı |
| `Alt+Shift+L` | Beğen |
| `Alt+Shift+↑` / `↓` | Sesi aç / kıs |

Ayarlar ve oturum `%APPDATA%\Mırıltı` klasöründe saklanır. Uygulamayı kaldırmak bunları silmez.

## Mimari

```
┌──────────────────────┐   IPC    ┌───────────────────┐   IPC    ┌──────────────────┐
│ Gizli YTM penceresi  │ ───────▶ │    Ana süreç      │ ───────▶ │ Widget (React)   │
│ music.youtube.com    │ ◀─────── │  durum önbelleği, │ ◀─────── │ Ayarlar (React)  │
│ + ytm preload        │  komut   │  tepsi, kısayol,  │  komut   │                  │
│   + ytm-adapter.ts   │          │  konumlandırma    │          │                  │
└──────────────────────┘          └───────────────────┘          └──────────────────┘
```

- **Güvenlik:** Tüm pencerelerde `contextIsolation: true`, `nodeIntegration: false` ve `sandbox: true` açıktır. Arayüzler yalnızca `window.mirilti` API'sini kullanır (`contextBridge`). Ana süreç, sayfadan ve arayüzden gelen her mesajı doğrular.
- **Olay tabanlı veri akışı:** Boştayken CPU kullanımı neredeyse sıfırdır.
  - Adaptör sayfadaki medya olaylarını, `mediaSession` değişikliklerini ve `MutationObserver`'ları dinler; sürekli yoklama yapmaz.
  - Çalma konumu sürekli gönderilmez, "konum + zaman damgası" olarak gelir.
  - İlerleme çubuğu bir CSS animasyonudur, JS her karede çalışmaz.
- **Widget animasyonu:** Pencere açık hâlin boyutunda sabit durur; görünen kısım `clip-path` ile kırpılarak açılıp kapanır. Pencereyi her karede yeniden boyutlandırmak Windows'ta takıldığı için bu yöntem seçildi. Boş alanlara gelen tıklamalar `setIgnoreMouseEvents(true, { forward: true })` ile arkadaki pencerelere geçer.

### Klasör yapısı

```
src/
├─ shared/                 # tüm süreçlerin ortak kodu
│  ├─ types.ts             # PlayerState, TrackInfo, QueueItem…
│  ├─ ipc.ts               # IPC kanal adları + window.mirilti API tipi
│  ├─ settings.ts          # ayar şeması ve varsayılanlar
│  └─ lrc.ts               # senkron söz ayrıştırıcı
├─ main/                   # ana süreç (Node)
│  ├─ index.ts             # giriş noktası, yaşam döngüsü
│  ├─ windows/             # player (gizli YTM), login, widget, settings
│  ├─ player-bridge.ts     # YTM ↔ arayüz santrali, komut doğrulama
│  ├─ positioning.ts       # kenar/köşe/yüzen yerleşim, çoklu monitör
│  ├─ colors.ts            # kapaktan renk paleti
│  ├─ lyrics.ts            # LRCLIB + YouTube Music sözleri
│  ├─ shortcuts.ts, fullscreen.ts, system.ts, tray.ts, store.ts
│  └─ smoke.ts             # geliştirici testi (aşağıda)
├─ preload/
│  ├─ ytm/index.ts         # YTM sayfasına köprü (izole dünya)
│  ├─ ytm/ytm-adapter.ts   # ⚠ YouTube Music'e bağımlı TÜM kod
│  └─ app.ts               # widget + ayarlar köprüsü (window.mirilti)
└─ renderer/
   ├─ widget/              # widget arayüzü
   ├─ settings/            # ayarlar arayüzü
   └─ common/              # ortak hook'lar, tema, stiller
```

## YouTube Music arayüzü değişirse: `ytm-adapter.ts`'i güncelleme

YouTube Music sitesi güncellendiğinde bazı özellikler bozulabilir. Uygulama bu durumda çökmez; widget'ta **"YouTube Music arayüzü değişmiş olabilir"** uyarısı çıkar. Uyarının üzerine gelince bulunamayan öğeler listelenir.

Siteye bağımlı her şey tek dosyada: [`src/preload/ytm/ytm-adapter.ts`](src/preload/ytm/ytm-adapter.ts). Dosya bölümlere ayrılmıştır:

| Bölüm | İçerik | Ne zaman bakılır |
| --- | --- | --- |
| 1. SEÇİCİLER (`SEL`) | Oynatıcı çubuğu, düğmeler, sıra listesi… | Bir düğme çalışmıyorsa |
| 2. DURUM OKUMA | Şarkı bilgisi, beğeni, tekrar modu | Bilgi yanlış/eksik görünüyorsa |
| 4. SIRA | Sıra deposu ve DOM'dan okuma | Sıradaki listesi boşsa |
| 6. İÇ API | Arama, kitaplık, sözler (Innertube) | Arama/kitaplık boş dönüyorsa |

### Adım adım

1. **Sorunu bul.**
   - Uygulamayı `npm run dev` ile başlat.
   - Tepsi menüsünden **YouTube Music penceresini aç**.
   - Pencerede `Ctrl+Shift+I` ile geliştirici araçlarını aç.
   - Konsolda `[mirilti]` ile başlayan satırlar adaptörün günlükleridir; başarısız komutlar burada görünür.
2. **Seçici bozulduysa:**
   - Geliştirici araçlarında öğe seçiciyle (sol üstteki ok) çalışmayan düğmeye tıkla ve yeni etiketini/sınıfını bul.
   - `SEL` nesnesindeki ilgili satırı güncelle.
   - Konsolda `document.querySelector('yeni-seçici')` ile önce doğrulayabilirsin.
3. **Arama, kitaplık ya da sözler bozulduysa** büyük ihtimalle iç API yanıtının yapısı değişmiştir. Ham yanıtı görmek için:

   ```powershell
   npm run compile
   $env:MIRILTI_SMOKE = "30"; $env:MIRILTI_SMOKE_DUMP = "1"; npx electron .
   ```

   Ham arama yanıtı `.smoke/search.json` dosyasına yazılır. `search()` / `parseListItem()` fonksiyonlarını yeni yapıya göre düzenle.

   Ayrıştırma kodu belirli yollara değil, büyük ölçüde `findKey` / `findAll` yardımcılarıyla anahtar aramasına dayandığı için küçük değişikliklerden etkilenmez.
4. **Smoke testiyle doğrula.** Bu test uygulamayı sesi kapalı açar ve gerçek siteye karşı şunları dener:
   - arama, çalma, durum, sıra
   - sıraya ekleme, sözler, ses, sonraki/duraklat
   - Windows medya kontrolleri

   Ayrıca widget'ın ekran görüntülerini `.smoke/` klasörüne kaydeder.

   ```powershell
   npm run compile
   $env:MIRILTI_SMOKE = "60"; npx electron .
   ```

   Konsolda `[smoke]` satırlarını kontrol et; ekran görüntülerine `.smoke/*.png` dosyalarından bakabilirsin.

İpuçları:

- Adaptör `import` yapamaz; tek parça betik olarak sayfaya enjekte edilir. Yalnızca `import type` kullanılabilir.
- Mümkün olduğunca YouTube'un oynatıcı nesnesi (`#movie_player`: `playVideo`, `seekTo`, `setVolume`…) ve `navigator.mediaSession` tercih edilir. Bunlar DOM'dan çok daha az değişir.
- Senkron sözleri internetsiz denemek için `$env:MIRILTI_FAKE_LRC = "dosya.lrc"` verebilirsin. Bu yalnızca geliştirme modunda çalışır.

## Sorun giderme

| Sorun | Çözüm |
| --- | --- |
| Google "Bu tarayıcı güvenli olmayabilir" diyor | Ayarlar → Sistem ve hesap → **Giriş tarayıcı kimliği: Firefox**, sonra tekrar giriş yap |
| Widget görünmüyor | Tepsi simgesine sol tıkla. Tam ekran bir uygulama açıksa otomatik gizlenmiş olabilir |
| Medya tuşları çalışmıyor | Ayarlar → Kısayollar → **Medya tuşlarını ayrıca yakala**'yı aç |
| Kısayol çalışmıyor | Başka bir uygulama aynı kısayolu kullanıyor olabilir; Ayarlar → Kısayollar'da uyarı görünür |
| Senkron sözler gelmiyor | LRCLIB'de o şarkının kaydı yoksa ya da servis geçici olarak erişilemezse YouTube Music'in düz sözleri gösterilir |
| "Arayüz değişmiş olabilir" uyarısı | Uyarıdaki **Yenile** düğmesi sayfayı yeniden yükler; sürerse yukarıdaki güncelleme adımlarına bak |

## Bilinen sınırlamalar

- **"Sıraya ekle"** YouTube Music'in iç sıra deposunu kullanır. Site bu yapıyı değiştirirse bu özellik ilk bozulacak olandır.
- **Windows 11 Acrylic** modunda pencere görünen şekle göre boyutlandığı için açılma animasyonu sadeleşir.
- Google hesabıyla giriş yapılmadan da çalar, ancak YouTube Music reklam gösterebilir (engellenmez; widget'ta "Reklam" etiketi çıkar). Kitaplık için giriş gerekir.
