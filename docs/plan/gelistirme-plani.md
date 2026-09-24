# Kâşif — Science Kit CMS + Kids Learning Platform · Geliştirme Planı (v5)

> **Doküman türü:** Faz faz, adım adım uygulanabilir geliştirme planı (ürün + mimari + test)
> **Girdi:** [bil-kit-anlyz.md](bil-kit-anlyz.md) (vizyon ve örnek plan) + kullanıcı istekleri (§0.2)
> **Referans çıktı:** [erzurum-bilim-merkezi/E-B-M](https://github.com/erzurum-bilim-merkezi/E-B-M)
> ("Küçük Çiftçiler"). Platformun **üretebilmesi gereken** deneyimin örneğidir. O repoda değişiklik
> yapılmaz.
> **Canlı adres:** https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/
> **Backend:** Supabase **Free**, **tek ortam** · **Yapay zekâ:** Gemini API ücretsiz katman (Edge
> Function üzerinden; anahtar yalnızca sunucuda, `GEMINI_API_KEY`)
> **Durum:** Onay bekliyor (v5: ikinci kıdemli inceleme, Gemini geçişi, kâşif üyeliği) · **Tarih:**
> 2026-09-24
> **Kural:** Plan [CLAUDE.md](../../CLAUDE.md) ile çelişirse CLAUDE.md geçerlidir. Çelişki önce ADR
> ile çözülür.

---

## 0. Özet

### 0.1 Ürün ve sözlük

| Terim             | Anlamı                                                                                                                   | Kodda              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| **Kâşif**         | Uygulamanın adı (çocuk PWA'sı), aynı zamanda uygulamayı kullanan çocuk ("kâşif")                                         | `kids`, `explorer` |
| **Kâşif Studio**  | Yönetim paneli (Science Kit CMS)                                                                                         | `studio`           |
| **Kâşif Kiti**    | Bir bilim kiti, ör. "Küçük Çiftçiler"                                                                                    | `kit`              |
| **Kart**          | Kitteki bir soru/etkinlik: soru, görsel alan (animasyon/video/görsel), etkileşim, cevap. Her kartın ikonu ve QR'ı vardır | `step`             |
| **Ekipman QR'ı**  | Kartın QR'ı; fiziksel kit ekipmanına etiket ya da kart olarak basılır                                                    | `qrCode`           |
| **Bilim Merkezi** | Çocuğun adını yazıp "girdiği" ana ekran: kitler, rozetler, "QR Okut"                                                     | `ExploreHomePage`  |
| **Kâşif üyeliği** | Çocuğun Supabase'deki üye kaydı: takma ad, avatar, ilerleme, rozetler, etkinlik. Cihaz yalnızca önbellektir              | `explorer`         |
| **Kâşif kodu**    | Üyenin 8 karakterli giriş kodu (ör. `KSF-7Q2M-X9`); "Kâşif kartı"na basılır, başka cihazda aynı üyeliğe döner            | `restoreCode`      |
| **Eğitmen**       | Bilim merkezi görevlisi (Studio personeli); çocuklar uygulamayı eğitmen gözetiminde kullanır                             | `admin`, `editor`  |

İki yüzey aynı uygulamada ve aynı adreste durur, tek PWA olarak kurulur. Marka varlıkları
`public/kasifkit-logo-mark.svg` (F0'da `kasif-logo-mark.svg` olarak yeniden adlandırılır),
`icon-192.png` ve `icon-512.png` dosyalarıdır. Maskot, uzay kasklı ve başında filiz olan robottur.

### 0.2 İstekler → plandaki karşılığı

| #   | Kullanıcı isteği                                                                         | Karşılık                                                                |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | E-B-M benzeri kitler üreten, yönetim + kullanım uygulaması; premium; faz faz, E2E testli | Tüm plan; her fazda E2E; premium kalite kapısı                          |
| 2   | E-B-M'de değişiklik yok                                                                  | Referans olarak okunur; hiçbir adım o repoya dokunmaz                   |
| 3   | Supabase Free, tek ortam, "3 kez planla 1 kez yap"                                       | §3.10 protokolü, F4 prova, F12 tek seferlik uygulama                    |
| 4   | Canlı adres `…github.io/E-B-M-DIGITAL/`; "QR oluştur" deyince dinamik QR                 | §0.3, F11                                                               |
| 5   | Admin kendi kitini oluşturur; isim Kâşif; tüm özellikler                                 | Admin doğrudan yayınlar; editör rolü de var; örnek planın tamamı (§1.3) |
| 6   | Admin girince ana sayfa: Kâşif kitleri listesi, durumları, pano, analiz                  | F6 Pano + F14 Analitik                                                  |
| 7   | "Yeni Kâşif Kiti" → ad (ör. Küçük Çiftçiler), açıklama, soru/kart ekleme, kart ikonu     | F6 sihirbaz, F8 kart editörü, F7 ikon seçici                            |
| 8   | Yapay zekâ destekli animasyon oluşturma **veya** doğrudan video ekleme                   | F9 AI sahne/ikon/metin (Gemini), F7 video (**yalnızca URL**)            |
| 9   | Kartlara örnekteki gibi QR; ekipmana eklenir; okutunca çocuk o ekrana gelir              | F11: ekipman etiketleri, `?q=` girişi, uygulama içi okuyucu             |
| 10  | Uygulama açılınca çocuk Kâşif adını yazar, "Bilim Merkezine" girer                       | F5 karşılama (ad, avatar → Kâşif üyeliği)                               |
| 11  | QR okuttukça istatistik ve yaptıkları tutulur; admin panolarda görür                     | F5 olay kaydı, F14 Kâşifler ve kit analitiği (§3.12)                    |
| 12  | Claude yerine **ücretsiz Gemini**; anahtarı kullanıcı girer                              | §3.13, F0.10–F0.11, F9, F12.6                                           |
| 13  | Video URL olarak; AI sahnesi durum başına ayrı `<img>`                                   | §3.4, §3.14, F5.7, F7                                                   |
| 14  | Veli izni yok, eğitmen gözetimi yeterli; çocuk üye olur, tüm bilgisi Supabase'de         | §3.12, F5, F13.8                                                        |

### 0.3 Kesinleşen kararlar

| Konu               | Karar                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Barındırma         | Her şey GitHub Pages'te, `https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/` (`BASE_PATH=/E-B-M-DIGITAL/`)                                                                                                                                                                                                     |
| QR                 | "QR oluştur" → görseller **tarayıcıda anlık** üretilir, saklanmaz. İçerik: `…/E-B-M-DIGITAL/?q=KC-01` (kök + sorgu: GitHub Pages derin yolda 404 döndürdüğü için). Kod **çalışma anında** güncel yayındaki karta çözülür                                                                                            |
| Yayın              | Admin kendi kitini doğrudan yayınlar. Editör rolü vardır; editör incelemeye gönderir, admin yayınlar                                                                                                                                                                                                                |
| Supabase           | **Free**, **tek ortam**. Veritabanı 3 kez planlanır, 1 kez uygulanır (§3.10)                                                                                                                                                                                                                                        |
| Test ve geliştirme | Canlı Supabase'e **hiçbir** test, seed ya da deneme yazılmaz. Yerel geliştirme ve E2E **mock arka uçla**; gerçek Supabase provası **CI'da yerel Supabase ile**                                                                                                                                                      |
| Çocuk kimliği      | **Kâşif üyeliği**: takma ad + avatar ile Supabase'de üye kaydı; ilerleme, rozet ve etkinlik sunucuda. Parola/e-posta yok; cihaz anonim oturumla üyeye bağlanır, başka cihazda **Kâşif kodu** ile girilir. Veli izni ekranı yok; kullanım eğitmen gözetiminde, aydınlatma metni gösterilir (§3.12)                   |
| Yapay zekâ         | Yalnızca Studio'da; **Gemini API ücretsiz katman**; anahtar yalnızca Edge Function secret'ı `GEMINI_API_KEY` (asla `VITE_`); üretilen her şey **taslaktır**; günlük kota. Gemini koşullarındaki 18 yaş maddesi **F0 hukuk kapısıdır**; olumsuzsa AI kapalı (`AI_PROVIDER=off`), platform AI'sız tam çalışır (§3.13) |
| Video              | **Yalnızca URL**: YouTube bağlantısı ya da https MP4 bağlantısı. Supabase'e video yüklenmez (trafik kotası)                                                                                                                                                                                                         |
| AI sahnesi         | Her durum ayrı, temizlenmiş SVG dosyası; Kâşif'te **`<img>`** ile gösterilir (satır içi SVG ve DOMPurify yok)                                                                                                                                                                                                       |
| Personel oturumu   | Sekmeye bağlı `sessionStorage` (yenilemede korunur, sekme kapanınca biter)                                                                                                                                                                                                                                          |
| İçerik             | Canlıya örnek kit yüklenmez. Örnek kitler test verisi ve Studio şablonu olarak kalır                                                                                                                                                                                                                                |

### 0.4 Başarı tanımı: altın yolculuk

1. Admin Studio'ya girer (parola + 2FA), panoda kitleri ve durumlarını görür.
2. **"Yeni Kâşif Kiti"** → "Küçük Çiftçiler", açıklama, kapak, tema.
3. 7 kart ekler; her karta ikon seçer.
4. Kartların bir kısmına **yapay zekâyla animasyon** üretir, bir kısmına **video** ekler, bir
   kısmında hazır sahneleri kullanır (tohuma dokun, kaydırıcı, sera butonları, ışığı aç, su
   yolculuğu, çimlenme oyunu, karşılaştırma kartları).
5. Önizler, yayınlar, **"QR oluştur"** ile ekipman etiketlerini basar.
6. Çocuk uygulamayı açar, adını yazar, avatarını seçer ve **Kâşif üyesi** olarak **Bilim Merkezine
   girer**. Ekipmandaki QR'ı okutur; kart açılır. Dinler, oynar, kutlama ve rozet kazanır.
7. Admin panoda "Ayşe #A7F2 'Tohum nedir?' kartını tamamladı" etkinliğini, QR okutma ve tamamlama
   sayılarını görür.

Bu yolculuk CI'da her commit'te **iki arka uçta** (mock ve yerel Supabase) E2E ile doğrulanır.

### 0.5 Kilometre taşları

| #      | Kilometre taşı                        | Fazlar  | Sonuç                                                                                                         | Süre (≈) |
| ------ | ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| **M1** | Temel + veri katmanı + Kâşif deneyimi | F0–F5   | Tasarım sistemi, içerik modeli, mock arka uç, Supabase şeması (provada), üyelik + Bilim Merkezi + 13 blok     | 48 gün   |
| **M2** | Studio ile üretim                     | F6–F11  | Pano, kit sihirbazı, medya/ikon/video, kart editörü, yapay zekâ, yayın, ekipman QR'ları; altın yolculuk yeşil | 38 gün   |
| **G**  | Canlı ortam kapısı                    | F12     | Supabase'e tek seferlik uygulama; admin coming-soon arkasında gerçek kit üretmeye başlar                      | 3 gün    |
| **M3** | Tam çocuk deneyimi + analitik         | F13–F14 | İlerleme/rozet/sertifika, Kâşif kartı, PWA/çevrimdışı, merkez cihazı modu, Kâşifler ve kit analitiği          | 13 gün   |
| **M4** | Lansman                               | F15     | Sertleştirme, coming-soon kapanır                                                                             | 5 gün    |
| —      | Tampon (%15)                          | —       | Onay beklemeleri (Plan 1/2, hukuk, KVKK), öngörülemeyen işler                                                 | 16 gün   |

Toplam, tek kıdemli geliştirici için yaklaşık **123 iş günü (~25 hafta)**: 107 gün iş + 16 gün
tampon. v4'teki 95 gün F0 (3 → 6) ve F4 (8 → 14) için gerçekçi değildi ve tampon içermiyordu.
Gemini hukuk görüşü olumsuz çıkarsa F9 düşer (−6 gün).

---

## 1. İnceleme raporu ve kapsam

### 1.1 v4 → v5: ikinci kıdemli inceleme ve kullanıcı kararları

İnceleme, planı repodaki kodla (`vite.config.ts`, CI, `docker/nginx`, boundaries script) ve resmî
dokümanlarla (Supabase, Gemini API, WCAG 2.2, Lighthouse) karşılaştırdı. Kullanıcı kararları
(2026-09-24): AI sağlayıcısı ücretsiz Gemini; video yalnızca URL; AI sahnesi durum başına `<img>`;
veli izni yok, eğitmen gözetimi yeterli; çocuk üye olur ve tüm bilgisi Supabase'de durur.

| Önem   | Bulgu (v4)                                                                                                                                                              | v5'teki düzeltme                                                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kritik | Gemini API koşulları: "18 yaş altına yönelik ya da onların erişmesi muhtemel bir hizmetin parçası olarak kullanılamaz". Kâşif çocuklara yöneliktir                      | F0.10 hukuk kapısı; olumsuzsa `AI_PROVIDER=off`, platform AI'sız tam çalışır; AI katmanı sağlayıcıdan bağımsız (§3.13)                                 |
| Kritik | `VITE_GEMINI_API_KEY` bundle'a gömülür, GitHub Pages'te herkes okur (CLAUDE.md ve Google bunu yasaklar)                                                                 | Anahtar yalnızca Edge Function secret'ı `GEMINI_API_KEY`; env şeması ve bundle taraması `VITE_` önekli anahtarları ve `AIza…` desenini reddeder (§3.7) |
| Kritik | Çıkış trafiği (egress) hesabı yok; görsel 300 kB, ses 5 MB, video 25 MB ile Free'nin 5+5 GB'ı ilk ay dolabilir; tam medya yedeği ayda 4 GB yer                          | Trafik formülü (§3.11); video yalnızca URL; görsel ≤ 150 kB, ses ≤ 1 MB; artımlı medya yedeği; B planı: yayın dosyaları GitHub Pages'e                 |
| Kritik | `pg_advisory_xact_lock` RPC transaction'ı bitince düşer; Storage yazımlarını kapsamaz. Yarıda kalan yayın `upsert:false` yüzünden kalıcı takılır                        | `publish_state` üzerinde süreli kiralama + nesil sayacı; sürüm ayırma → dosya → kesinleştirme; aynı hash'li dosya başarı sayılır (§3.9)                |
| Kritik | Meta CSP'de `style-src` yok: satır içi SVG `<style>`'ı, Radix (react-remove-scroll) ve Sonner'ın çalışma anında eklediği `<style>` engellenir                           | `style-src 'self' 'unsafe-inline'` (ADR 0013); AI sahnesi `<img>` ile; CSP F15'te değil **F0'da** (tüm E2E CSP altında)                                |
| Kritik | zxing-wasm için CSP'de `'wasm-unsafe-eval'` yok; `.wasm` varsayılan olarak CDN'den çekilir → iOS'ta QR okuyucu çalışmaz                                                 | `script-src 'self' 'wasm-unsafe-eval'`; `.wasm` self-host + önbellek; QR spike'ı üretim CSP'siyle (F0.12)                                              |
| Kritik | KVKK: yurt dışına aktarım (Supabase, GitHub, YouTube) ve VERBİS ele alınmamış                                                                                           | F12 kapısı: aktarım dayanağı, proje bölgesi kaydı, VERBİS, işleme dayanağı (§3.12)                                                                     |
| Yüksek | Merkez cihazında her ziyaretçi profil açar ama cihaz başına 10 profil sınırı var; kurulum kodu ve PIN'in yeri yok                                                       | `center_devices` tablosu; merkez cihazında sınır yok; PIN özeti sunucuda (§3.9, F13.6)                                                                 |
| Yüksek | Şema eksikleri: ayarlar, hız sınırı sayaçları; `analytics_daily` PK'sında null `step_id`; tekil ziyaretçi toplamı yok; QR sayacı yok; slug yayından önce de değişemiyor | `app_settings`, `rate_limit_counters`, `analytics_daily_uniques`; `step_id not null default ''`; `qrSequence`; `rename_kit` RPC'si (§3.4, §3.9)        |
| Yüksek | Saatlik toplama geç gelen (7 güne kadar) çevrimdışı olayları kaçırır; gün UTC'ye göre hesaplanabilir                                                                    | `id` işaretinden artımlı toplama, `occurred_at`'in Europe/Istanbul gününe upsert; pgTAP testi                                                          |
| Yüksek | Frontend otomatik, migration elle yayınlanır → yeni RPC'ye bağlı arayüz DB'den önce canlıya çıkabilir; önbellekteki eski uygulamalar                                    | Deploy'da canlı `schema_version()` kapısı; geriye uyumlu RPC'ler; katalogda `minAppVersion`; Kâşif SW'si kendiliğinden güncellenir (ADR 0019)          |
| Yüksek | Personel oturumu bellekte: her yenilemede parola + 2FA                                                                                                                  | Sekmeye bağlı `sessionStorage` (ADR 0011)                                                                                                              |
| Yüksek | "Canlıya test yazılmaz" ile F12.10 deneme kiti ve `smoke-prod` çelişiyor; coming-soon açıkken QR testi yapılamıyor                                                      | Doğrulama ilk gerçek kitle; önizleme cihazı bayrağı + `is_preview` olaylar; `smoke-prod` anonim girişi engeller                                        |
| Yüksek | CI'dan canlı DB'ye: Free'de doğrudan adres yalnızca IPv6, GitHub runner'larında IPv6 yok                                                                                | Tüm workflow'lar Supavisor **session pooler** (5432) bağlantısıyla (§3.10)                                                                             |
| Yüksek | iOS Safari 7 gün etkileşimsizlikte localStorage/IndexedDB/önbelleği siler; cihaz profili ve ilerleme kaybolur                                                           | Kâşif üyeliği: tüm bilgi Supabase'de; Kâşif kodu ile geri giriş; `navigator.storage.persist()` (§3.12, F13.8)                                          |
| Yüksek | WCAG 2.2: döngüsel animasyonlarda durdurma yok (2.2.2); video altyazısı isteğe bağlı (1.2.2)                                                                            | Durdur/Oynat (`static` kare); konuşmalı videoda altyazı zorunlu (YouTube'da altyazı onayı, MP4'te VTT)                                                 |
| Yüksek | Admin TOTP'sini kaybederse kurtarma yolu yok (e-posta akışı da yok)                                                                                                     | En az 2 aktif admin (F12 kapısı); onaylı `admin-mfa-reset` workflow'u + runbook                                                                        |
| Orta   | Canlı fonksiyonlar localhost CORS'una izin veriyor                                                                                                                      | Canlıda yalnızca canlı köken                                                                                                                           |
| Orta   | `report_client_error` oturumsuz çağrılabiliyor (uid kotası uygulanamaz)                                                                                                 | Oturum zorunlu (anonim cihaz ya da personel)                                                                                                           |
| Orta   | Lighthouse 12'de PWA kategorisi yok                                                                                                                                     | Kurulabilirlik Playwright + CDP `Page.getInstallabilityErrors` ile                                                                                     |
| Orta   | `/kit/:kitSlug/tamamlandi` ile `/kit/:kitSlug/:stepSlug` çakışır; Kâşif `?donus=` doğrulanmıyor                                                                         | `tamamlandi` rezerve slug; `?donus=` yalnızca `/` ile başlayan iç yol                                                                                  |
| Orta   | YouTube iframe'i çocuğu youtube.com'a çıkarabilir; IFrame API betiği CSP'ye takılır                                                                                     | `sandbox` (popup ve üst sayfa yönlendirmesi yok); YouTube'da tamamlanma "İzledim" ile                                                                  |
| Orta   | Boyut formülünde 250 B/olay düşük; auth şeması büyümesi yok. Uyarı kanalı yok                                                                                           | ≈ 400 B/olay + auth tabloları F4.10'da ölçülür; uptime izleyici + `quota-check` workflow'u                                                             |
| Orta   | CLAUDE.md'deki "CSP nginx'te" ve "token localStorage'da olmaz" kuralları güncellenmiyor                                                                                 | F0.2: CSP tek kaynaktan (`csp.config.ts` → meta + nginx); ADR 0017 istisnası CLAUDE.md'ye                                                              |
| Orta   | ADR 0009 ve 0012 F5/F14'te yazılıyor ama kararları F4 şemasına gömülü                                                                                                   | 0009 F0'a, 0012 F4'e alındı                                                                                                                            |
| Orta   | Takvim: F0 3 gün, F4 8 gün gerçekçi değil; tampon yok                                                                                                                   | F0 6, F4 14 gün; %15 tampon; toplam ≈ 123 gün (§0.5)                                                                                                   |
| Düşük  | Grafik kütüphanesi seçilmemiş; matriste "PDF" var F11'de yok; "Şu an merkezde" KPI'ı yanıltıcı; editör incelemedeki taslağı değiştirebiliyor                            | ADR 0010'a grafik kütüphanesi; PDF = tarayıcıdan yazdır; "Son 15 dk aktif"; incelemedeki taslak editöre kilitli                                        |

### 1.2 v3 → v4 kıdemli inceleme bulguları

Üç bağımsız inceleme yapıldı: güvenlik, E2E/test ve resmî dokümanlara karşı teknik doğrulama.
Bunlara kapsam karşılaştırması eklendi. Bulgular ve plandaki düzeltmeleri:

| Önem   | Bulgu (v3)                                                                                                           | v4'teki düzeltme                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Kritik | Veritabanı yedekleri public repo'da artifact olarak herkese açık kalırdı (e-postalar, parola özetleri)               | Yedekler `age` ile şifrelenir, 7 gün saklanır, ayrı `backup` Environment (§3.11, F4.11)                                         |
| Kritik | RLS kolonları korumaz: editör PostgREST ile `status`, `visibility`, `slug` değiştirebilirdi                          | Kolon bazlı `GRANT UPDATE (draft, lock_version)`; durum yalnızca RPC/fonksiyonla; slug ilk yayından sonra kilitli (§3.9)        |
| Kritik | Eski E-B-M service worker'ı aynı kökendeki **tüm** önbellekleri siliyor; Kâşif'in çevrimdışı önbelleği gider         | Önbellek adları `kasif-` önekli; açılışta bütünlük kontrolü + kendini onarma; E2E testi (F13.5)                                 |
| Yüksek | `security definer` yardımcı fonksiyonlar PostgREST'e açık; `current_role` SQL anahtar kelimesiyle çakışır            | Yardımcılar açığa çıkmayan `private` şemasında; varsayılan EXECUTE yetkileri geri alınır; pgTAP yetki listesini denetler        |
| Yüksek | Edge Function'larda `verify_jwt` yeni anahtarlarla çalışmaz; secret key ile yazınca `auth.uid()` boş kalır           | Her fonksiyon `auth.getUser()` + profil/rol/aal2 kontrolü; DB yazımları çağıranın JWT'siyle RPC üzerinden                       |
| Yüksek | Son admin kendini düşürebilir; e-postasız parola sıfırlama yok; pasifleştirme token'ı hemen kesmez; admin 2FA yok    | Son-admin kilidi, `resetPassword`, RLS'te `active` kontrolü + ban, admin için TOTP (aal2) zorunlu (F3)                          |
| Yüksek | Arşiv/görünürlük değişikliği yalnızca DB'yi değiştirir; yayındaki dosyalar eski kalır; eşzamanlı yayın katalogu ezer | Tüm yayın dosyası işlemleri tek Edge Function'da, advisory lock ile; dosyalar DB'den yeniden üretilir                           |
| Yüksek | Yayınlanmış kitin silinmesi QR kodlarını serbest bırakır                                                             | Yalnızca hiç yayınlanmamış kit silinir; QR kodu ve öneki asla yeniden kullanılmaz                                               |
| Yüksek | Anonim `track` uç noktası veritabanını doldurabilir; bellek içi hız sınırı Edge'de çalışmaz                          | `track` kaldırıldı; olaylar anonim oturumla `record_events` RPC'sine; sabit olay listesi, ID doğrulama, uid başına kota         |
| Yüksek | Mock veri Playwright bağlamları arasında paylaşılmaz; yenileme seed'i yeniden çalıştırır                             | `backend.exportState/importState`, tek seferlik seed koruması (§4)                                                              |
| Yüksek | Bellek içi oturumla her testte UI girişi GoTrue hız sınırına takılır                                                 | Yalnızca e2e build'inde oturum enjeksiyonu; UI girişi yalnızca `auth` spec'lerinde; üretim bundle taraması                      |
| Yüksek | Sözleşme testleri jsdom + MSW altında Supabase'e gidemez                                                             | Ayrı `contract-supabase` Vitest projesi (node, MSW yok, seri)                                                                   |
| Yüksek | E2E `/` altında sunulur, canlı `/E-B-M-DIGITAL/`; GitHub Pages 404 davranışı taklit edilmez                          | E2E build'i base path'le; Pages benzeri statik sunucu (404.html + 404 durumu)                                                   |
| Orta   | Free CDN'de üzerine yazılan dosya önbellekten temizlenmez; supabase-js varsayılan `cacheControl` 3600 sn             | Değişen dosyalar `no-cache`, sürümlü dosyalar uzun ömürlü ve `upsert:false`                                                     |
| Orta   | Edge Function Free'de toplam 150 sn ile sınırlı                                                                      | Yapay zekâ akışı ≤ 120 sn'de kesilir; SVG ≤ 20 kB; F0'da ölçüm spike'ı                                                          |
| Orta   | Anonim girişler IP başına saatte 30 (okul/merkez NAT'ı tıkanır)                                                      | Limit panelden yükseltilir (300/saat); anonim kullanıcı temizliği pg_cron ile                                                   |
| Orta   | Otomatik kayıt her kayıtta denetim satırı üretirse 500 MB dolar                                                      | Denetim yalnızca durum/yayın/kullanıcı olaylarında; taslak kaydı kit/kullanıcı başına saatte 1, diff'siz                        |
| Orta   | Canvas/IndexedDB/ölçüm API'leri jsdom'da yok                                                                         | Saf yardımcılar birim testte; PNG çözme ve sürükle-bırak E2E'de; `fake-indexeddb` + polyfill'ler                                |
| Orta   | `?donus=` açık yönlendirme                                                                                           | Yalnızca `/studio` ile başlayan iç yollar kabul edilir (regex doğrulaması, `//` ve `\` yasak); Auth yönlendirme listesi tam yol |
| Orta   | Aynı kökendeki diğer org siteleri localStorage/IndexedDB/önbelleğe erişebilir                                        | Güven varsayımı ADR'de; tüm anahtarlar `kasif:` önekli; personel oturumu bellekte; özel alan adı seçeneği (§3.7)                |
| Orta   | iOS'ta kameradan okutulan QR Safari'de açılır; kurulu PWA'nın profili görünmez                                       | Uygulama içi "QR Okut" (BarcodeDetector + zxing-wasm polyfill) birincil yol; Safari'de yönlendirici ipucu                       |
| Düşük  | Kapsam: kapak, deney/video/sıralama/eşleştirme, şablonlar, tema seçenekleri, profil, komut paleti, hata izleme eksik | §1.3 matrisi; hepsi v1 kapsamında                                                                                               |

### 1.3 Örnek plan (bil-kit-anlyz.md) kapsam matrisi

| Örnek plan özelliği                                                                                                              | v1'de (faz)                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Admin paneli: kit/içerik/soru/oyun oluşturma, QR, yayın, analitik                                                                | F6–F11, F14                                                                       |
| Kit: genel bilgi, **kapak**, tema, yaş, alan, süre, hedefler, malzemeler, güvenlik                                               | F2, F6                                                                            |
| Bloklar: intro, info, soru, quiz, tap-reveal, sürükle-bırak, sıralama, eşleştirme, deney, simülasyon, video, ses, görsel, başarı | F2, F5 (13 blok + kit ana sayfası + tamamlandı sayfası)                           |
| Kit Builder adımları, özellikler paneli, önizleme                                                                                | F6, F8 (form + canlı önizleme; serbest tuval v2)                                  |
| Yayın: taslak → inceleme → yayında → arşiv; sürümleme                                                                            | F10                                                                               |
| Tema oluşturucu: renk, yazı tipi (oyunsu/standart), animasyon seviyesi; ön ayarlar                                               | F6 (5 ön ayar + kontrast doğrulamalı vurgu rengi + yazı + hareket seviyesi)       |
| Şablonlar: boş, 7 soruluk keşif, deney, quiz, hikâye                                                                             | F2, F6                                                                            |
| İçe/dışa aktarma (JSON)                                                                                                          | F8                                                                                |
| Medya yöneticisi (görsel, ses, video, filtre)                                                                                    | F7 (video yalnızca URL: YouTube ya da MP4 bağlantısı)                             |
| QR: tekil, toplu ZIP, PNG/SVG/PDF, basılabilir kart                                                                              | F11 (+ ekipman etiketleri, uygulama içi okuyucu; PDF = tarayıcıdan yazdır)        |
| Sesli anlatım: dinle/duraklat/sessiz                                                                                             | F1, F5, F13 (ayarlarda genel sessiz)                                              |
| İlerleme, rozetler (kit ve genel), çocuk profili                                                                                 | F5, F13 (Kâşif üyeliği; tüm bilgi Supabase'de, Kâşif kartı)                       |
| PWA, çevrimdışı, önbellek stratejisi, kurulum                                                                                    | F13                                                                               |
| Analitik: görüntülenme, başlatma, tamamlama, süre, quiz başarı, QR, en çok bırakılan                                             | F14                                                                               |
| Komut paleti, kısayollar, otomatik kayıt                                                                                         | F6, F8                                                                            |
| RBAC, güvenlik başlıkları, denetim kaydı, yükleme doğrulama                                                                      | F3, F4, F15                                                                       |
| Hata izleme, izleme (monitoring), yedek                                                                                          | F4, F14, F15                                                                      |
| SEO temel meta; Studio `noindex`                                                                                                 | F15                                                                               |
| **Yapay zekâ içerik asistanı** (örnekte Faz 3)                                                                                   | **F9 (öne alındı)**: animasyon, ikon, kart metni, kit taslağı                     |
| Öğretmen/sınıf, sertifika, çok dilli, çok kurum, beyaz etiket (örnekte Faz 4)                                                    | Sertifika F13'te; diğerleri v2 (§6 F16), şema hazırlığı F4'te (`organization_id`) |

---

## 2. Başlangıç noktası

### 2.1 Hazır altyapı

React 19, TS 6 (strict, `allowImportingTsExtensions` açık), Vite 8, Router 8, TanStack Query 5,
Zod 4, Tailwind 4 + semantik token'lar, Vitest + RTL + MSW, Playwright + axe, oxlint,
`lint:boundaries`, Husky + commitlint, `vite-plugin-pwa`, CI + GitHub Pages deploy (`404.html` SPA
yedeği dahil), coming-soon modu. `qrcode-generator` ve `jszip` kurulu. Supabase projesi açık; URL ve
publishable key `.env`'de (git dışında, doğrulandı). Marka varlıkları `public/` altında, henüz
commit edilmedi. Canlı coming-soon sitesinde `registerType:'autoUpdate'` ile bir service worker
kurulu; F13.4'teki geçiş eski önbellekleri `cleanupOutdatedCaches` ile temizler. Mevcut
`docker/nginx/security-headers.conf` CSP'si `style-src 'unsafe-inline'` içeriyor; F0.9'da meta CSP
ile tek kaynaktan üretilir.

### 2.2 Marka varlıkları: eksikler

| Varlık                         | Durum                                     | Yapılacak (F0.4)                                                                           |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `kasifkit-logo-mark.svg`       | Var, 12 kB (içinde C2PA meta verisi)      | `kasif-logo-mark.svg` adı; `svgo` ile meta veri temizlenir                                 |
| `icon-192.png`, `icon-512.png` | Var, yuvarlatılmış köşeli, köşeler şeffaf | Manifest'te `purpose: "any"`                                                               |
| Maskable ikonlar               | Yok                                       | Tam dolu çivit zemin, maskot %80 güvenli alanda: 192 ve 512                                |
| `apple-touch-icon` 180         | Yok (iOS şeffaflığı siyaha çevirir)       | Opak zeminli                                                                               |
| Favicon                        | `favicon.svg` coming-soon işareti         | Uygulama için logo işaretinden; coming-soon kendi işaretini korur                          |
| Maskot varyantları             | Yok                                       | 6 renk varyantı (çocuk avatarları) ve 3 poz (merhaba, düşünüyor, kutluyor) — `ui-designer` |

Üretim `@vite-pwa/assets-generator` ile tek kaynaktan (`pwa-assets.config.ts`) yapılır.

### 2.3 Referans deneyim: platformun üretebilmesi gerekenler

| #   | E-B-M'deki davranış                                           | Platform yeteneği                     | Faz |
| --- | ------------------------------------------------------------- | ------------------------------------- | --- |
| R1  | Renkli kart menüsü                                            | `KitHomePage` + kart rengi ve ikonu   | F5  |
| R2  | QR ile gelince yalnızca o kart (odak modu)                    | `?q=` çözümleyici + `qrEntryMode`     | F11 |
| R3  | "Dinle": `tr-TR`, hız 0.92, perde 1.1; tekrar basınca durur   | `useSpeech` + `SpeakButton`           | F1  |
| R4  | Sayfa değişince konuşma durur; motor yoksa "🔇 Ses yok"       | `useSpeech`                           | F1  |
| R5  | Konfeti + tebrik balonu, karta özel mesaj                     | `Celebration` + `celebration` alanı   | F1  |
| R6  | Tohuma dokun → çatlar, filiz çıkar                            | `tap-reveal` + `seed-sprout`          | F5  |
| R7  | Kaydırıcıyla 4 evre                                           | `stage-slider` + `lettuce-growth`     | F5  |
| R8  | 4 buton → sahnede öğe parlar                                  | `explore-hotspots` + `greenhouse`     | F5  |
| R9  | "Işığı Aç/Kapat"                                              | `toggle-scene` + `leaf-kitchen`       | F5  |
| R10 | Döngüsel su damlası animasyonu                                | `animated-scene` + `water-journey`    | F5  |
| R11 | Doğru seçimler → çimlenme; yanlış → esprili uyarı             | `choose-correct` + `germination`      | F5  |
| R12 | İki karşılaştırma kartı                                       | `compare-cards`                       | F5  |
| R13 | "Bitirdim!" kutlaması                                         | `KitCompletePage` + rozet + sertifika | F13 |
| R14 | Azaltılmış hareket, güvenli alan, 56 px+ dokunma hedefleri    | Kâşif token'ları + `KidsLayout`       | F1  |
| R15 | PWA yükleme butonu + iOS rehberi                              | `InstallPrompt`                       | F13 |
| R16 | Çevrimdışı açılış; zayıf ağda 4 sn sonra önbellek             | Workbox stratejisi                    | F13 |
| R17 | QR: tek tek PNG (1024 px, hata düzeltme M, başlık) + tümü ZIP | `qr-print`                            | F11 |

---

## 3. Hedef mimari

### 3.1 Sistem görünümü

```
                 https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/   (GitHub Pages, tek PWA: "Kâşif")
 ┌─────────────── Kâşif Studio  /studio  (parola + admin 2FA) ────────────────┐
 │ Pano · Kâşif Kitleri · Kart editörü + canlı önizleme · Yapay zekâ · Medya · │
 │ Yayın/sürüm · QR oluştur · Kâşifler · Analitik · Kullanıcılar              │
 └──────┬──────────────────────────────────────────────┬───────────────────────┘
        │ Port'lar (mock adapter: yerel + E2E)          │ functions: publish-kit · ai-generate · admin-users
        ▼                                              ▼
 ┌───────────────────────────── SUPABASE (Free · tek ortam) ─────────────────────────────┐
 │ Auth: personel (parola + TOTP) · Kâşif cihazları (anonim oturum → üyeye bağlanır)       │
 │ Postgres (RLS): kits · kit_versions · qr_codes · media_assets · explorers ·            │
 │   explorer_devices · explorer_events · explorer_kit_progress · explorer_badges ·       │
 │   analytics_daily(+_uniques) · app_settings · ai_usage · audit_log …                   │
 │ Storage: media (görsel/ses/AI SVG; video yok) · published (herkese okunur anlık görüntü)│
 └──────────────────────────────────────┬─────────────────────────────────────────────────┘
          publish-kit → published/catalog.json · qr-index.json · kits/{slug}/latest.json
                        published/kits/{slug}/v{n}.json (değişmez)
          ai-generate → Gemini API (ücretsiz katman; GEMINI_API_KEY yalnızca burada)
                                        ▼
 ┌──────────────── Kâşif  /  (çocuk; Kâşif üyeliği, tüm bilgisi Supabase'de) ─────────────┐
 │ Karşılama (ad, avatar → üyelik | Kâşif kodu ile giriş) → Bilim Merkezi → Kit → Kart     │
 │ ContentSource → JSON → Zod → Query → KitPlayer → Bloklar → Sahne/AI <img>/Video URL      │
 │ Olay kuyruğu (IndexedDB) → record_events RPC · SW önbelleği · ilerleme sunucuda (önbellek)│
 └──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **İçerik okuma** (kit JSON'ları) veritabanına dokunmaz. Değişmez anlık görüntüler Storage/CDN'den
  gelir, çevrimdışında service worker'dan açılır.
- **Üye verisi** (profil, ilerleme, rozet, ayarlar) Supabase'de durur. Cihazda yalnızca oturum
  anahtarı ve çevrimdışı önbellek tutulur; cihaz silinse de üyelik Kâşif koduyla geri gelir.
- **Etkinlik yazma** (QR okutma, kart tamamlama…) üyeye bağlı cihaz oturumuyla, doğrulayan bir RPC
  üzerinden, toplu ve çevrimdışına dayanıklı yapılır.

### 3.2 Katmanlar ve dilimler

```
src/
  app/          providers, router, KidsLayout, StudioLayout, global.css + kids.css + studio.css
  pages/
    kids/       WelcomePage, RestorePage, ExploreHomePage, KitHomePage, StepPage, KitCompletePage,
                BadgesPage, CertificatePage, QrEntryPage, QrScanPage, ProfilePage, PrivacyPage
    studio/     LoginPage, MfaPage, DashboardPage, KitListPage, KitCreatePage, KitEditorPage,
                KitPreviewPage, KitVersionsPage, KitQrPage, KitQrPrintPage, KitAnalyticsPage,
                ExplorersPage, ExplorerDetailPage, AnalyticsPage, MediaPage, UsersPage, SettingsPage
  features/     (her feature: api/{port.ts, *.mock.ts, *.supabase.ts, index.ts} components/ hooks/)
    kit-catalog/     yayınlanmış katalog ve kit okuma (ContentSource)
    kit-player/      StepShell, StepRenderer, 13 blok, sahne kütüphanesi, AiSceneRenderer, VideoPlayer
    explorer/        karşılama, Kâşif üyeliği, cihaz↔üye bağlama, Kâşif kodu/kartı, ExplorerService
    activity/        olay kuyruğu + senkron (EventSink)
    progress/        sunucudaki ilerleme (cihazda önbellek), rozetler, sertifika
    qr-entry/        ?q= kodu → kit/kart; QrScanner (BarcodeDetector + polyfill); kodu elle yazma
    pwa/             yükleme, güncelleme, çevrimdışı, kit indirme, önbellek onarımı, merkez cihazı modu
    auth/            AuthService, MFA, RequireRole, giriş, parola değiştirme
    kit-studio/      KitRepository, pano kit tablosu, kit sihirbazı, kart editörleri, otomatik kayıt, içe/dışa aktarma, komut paleti
    kit-publishing/  PublishingService, yayın, inceleme notu, sürümler, arşiv
    qr-print/        QrRegistry okuma, PNG/SVG/ZIP, ekipman etiketleri, yazdırılabilir kartlar
    media-library/   MediaRepository, küçültme, video URL doğrulama, ikon seçici, kota
    ai-studio/       AiService: sahne/ikon/metin/kit taslağı üretimi, kota
    analytics/       AnalyticsReader (pano, kit analitiği, kâşifler), dışa aktarma
    user-admin/      UserAdminService
  entities/     ← YENİ KATMAN (ADR 0006)
    kit/        Zod şemaları, tipler, blok/sahne/ikon katalogları, şablonlar, migrateKit, saf yardımcılar
    activity/   olay şemaları (paylaşılan: istemci + RPC sözleşmesi)
  shared/
    ui/         Studio primitifleri (Radix) + ui/kid/ Kâşif primitifleri
    hooks/      useSpeech, usePrefersReducedMotion, useOnlineStatus, useHotkeys, useIdleTimer, useWakeLock
    lib/        cn, richText, slugifyTr, download, imageResize, audioProbe, videoUrl, contrast
    api/        http-client, query-client, supabase (lazy; kids ve staff istemcileri), mock-db
    config/     env
content/samples/   kucuk-ciftciler.json, blok-vitrini.json (yalnızca test ve şablon)
supabase/          config.toml, migrations/, tests/ (pgTAP), functions/, seed.ci.sql
csp.config.ts      CSP'nin tek kaynağı → meta etiket (build) + docker/nginx/security-headers.conf
docs/database/     schema.md, query-catalog.md, capacity.md (boyut + trafik), change-log.md
```

- **`entities`:** Yalnızca **saf** modül: React, `@/` alias ve `import.meta` yok. Modüller birbirini
  `.ts` uzantılı göreli yollarla import eder, böylece Node 24 ve Deno'da da çalışır. Edge
  Function'lar kopyasını `_shared/` altında kullanır (`sync:edge-schema`, CI fark kontrolü).
- **Bileşim sayfada yapılır.**
  - Oynatıcı ilerlemeyi ve etkinliği bilmez. `StepPage`, `onStepComplete` ve `onInteraction`
    callback'lerini `progress` ve `activity` feature'larına bağlar.
  - Studio önizlemesi oynatıcıyı etkinlik kaydı **olmadan** kullanır.
- **Bundle ayrımı:**
  - Studio, `supabase-js` personel istemcisi, mock arka uç ve zxing-wasm ayrı lazy chunk'lardır.
    AI sahneleri `<img>` ile gösterildiği için DOMPurify hiç kullanılmaz.
  - Kâşif'in başlangıç bundle'ına bunlardan hiçbiri girmez.
  - Üretim build'i mock ve E2E kancalarını içermez (CI taraması).

### 3.3 Rotalar

**Kâşif (çocuk)**

| Rota                       | Sayfa           | Not                                                                                                                                                                                                                                    |
| -------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/hosgeldin`               | WelcomePage     | İlk açılış: maskot → "Adın ne, Kâşif?" → avatar → **"Bilim Merkezine Gir"** (Kâşif üyeliği açılır) ya da "Kâşif kodum var". `?donus=` yalnızca `/` ile başlayan iç yol (`//` ve `\` yasak); QR ile ilk kez gelindiyse karta devam eder |
| `/giris`                   | RestorePage     | Kâşif koduyla giriş: kodu yaz ya da Kâşif kartındaki QR'ı okut → üyelik bu cihaza bağlanır                                                                                                                                             |
| `/`                        | ExploreHomePage | **Bilim Merkezi**: "Merhaba Ayşe!", kitler (kategori/yaş filtresi), büyük "QR Okut" butonu, rozetler. `?q=` varsa QrEntry'ye                                                                                                           |
| `/q/:code`                 | QrEntryPage     | Kod çözümleme (elle yazılan kod ve eski biçim)                                                                                                                                                                                         |
| `/qr-okut`                 | QrScanPage      | Uygulama içi kamera okuyucu + "Kodu yaz" alternatifi                                                                                                                                                                                   |
| `/kit/:kitSlug`            | KitHomePage     | Kart menüsü (R1), ilerleme halkası                                                                                                                                                                                                     |
| `/kit/:kitSlug/:stepSlug`  | StepPage        | `?giris=qr` → odak modu (R2). `tamamlandi` kart slug'ı olarak rezervedir                                                                                                                                                               |
| `/kit/:kitSlug/tamamlandi` | KitCompletePage | Rozet + kutlama + "Sertifikamı gör"                                                                                                                                                                                                    |
| `/sertifika/:kitSlug`      | CertificatePage | Adlı sertifika (yazdır/paylaş)                                                                                                                                                                                                         |
| `/rozetlerim`              | BadgesPage      |                                                                                                                                                                                                                                        |
| `/profil`                  | ProfilePage     | Kâşif değiştir, yeni kâşif, **Kâşif kartım** (kod + yazdır), ayarlar (ses, hareket, yazı boyutu), "Üyeliğimi ve verilerimi sil"                                                                                                        |
| `/aydinlatma`              | PrivacyPage     | KVKK aydınlatma metni (karşılamadan ve profilden bağlantı)                                                                                                                                                                             |

**Kâşif Studio (yönetim)**

| Rota                              | Sayfa              | Not                                                                                 |
| --------------------------------- | ------------------ | ----------------------------------------------------------------------------------- |
| `/studio/giris`, `/studio/2fa`    | LoginPage, MfaPage | `?donus=` yalnızca `/studio` ile başlayan iç yol                                    |
| `/studio`                         | DashboardPage      | **Ana sayfa = Pano**: KPI'lar, Kâşif Kitleri tablosu (durum), trend, etkinlik akışı |
| `/studio/kitler`                  | KitListPage        | `?durum=&q=&sayfa=`                                                                 |
| `/studio/kitler/yeni`             | KitCreatePage      | **"Yeni Kâşif Kiti"** sihirbazı                                                     |
| `/studio/kitler/:kitId`           | KitEditorPage      | `?sekme=genel` ve diğer sekmeler (kartlar, tema, rozet, yayin), `&kart=`            |
| `/studio/kitler/:kitId/onizleme`  | KitPreviewPage     | Aynı sekmede tam ekran                                                              |
| `/studio/kitler/:kitId/surumler`  | KitVersionsPage    |                                                                                     |
| `/studio/kitler/:kitId/qr`        | KitQrPage          | "QR oluştur"                                                                        |
| `/studio/kitler/:kitId/qr/yazdir` | KitQrPrintPage     | `?sablon=` kart, etiket ya da kutu                                                  |
| `/studio/kitler/:kitId/analiz`    | KitAnalyticsPage   | Kart hunisi, QR okutma, süre, quiz başarısı                                         |
| `/studio/kasifler`                | ExplorersPage      | Yalnızca admin                                                                      |
| `/studio/kasifler/:explorerId`    | ExplorerDetailPage | Zaman çizelgesi, kit ilerlemeleri, sil                                              |
| `/studio/analitik`                | AnalyticsPage      | Tarih aralığı, kit karşılaştırma, CSV                                               |
| `/studio/medya`                   | MediaPage          |                                                                                     |
| `/studio/kullanicilar`            | UsersPage          | Yalnızca admin                                                                      |
| `/studio/ayarlar`                 | SettingsPage       | AI kotası, saklama süreleri, merkez cihazı kurulum kodu, önizleme cihazı bayrağı    |

**Coming-soon ile ilişki (F12):**

- `VITE_COMING_SOON=true` iken Kâşif rotaları açılış sayfasını gösterir, `/studio/**` çalışır.
- Coming-soon build'i `<html>`'i karanlık temaya sabitlediği için `StudioLayout` kendi kökünde
  `data-theme`'yi sistem tercihine göre ayarlar.
- Coming-soon eklentisinin satır içi `style`'ı bir sınıfa taşınır (CSP).
- **Önizleme cihazı:** Studio → Ayarlar → "Bu cihazda Kâşif'i önizle" cihaza `kasif:preview:v1`
  bayrağını yazar. Bayrak açıkken Kâşif rotaları coming-soon'u atlar ve olaylar `is_preview`
  işaretiyle gider (toplamlara girmez, 24 saatte silinir). Coming-soon bir güvenlik sınırı değildir
  (yayın dosyaları zaten herkese açıktır); bayrak yalnızca sunumu değiştirir. F12.10 ve gerçek cihaz
  testleri bu bayrakla yapılır.
- Coming-soon açıkken okutulan ekipman QR'ı "Yakında" sayfasında kodu (`KC-04`) gösterir.

### 3.4 İçerik modeli (`entities/kit`)

#### Kit belgesi

```ts
export const KIT_SCHEMA_VERSION = 1

export const kitDocumentSchema = z
  .object({
    schemaVersion: z.literal(KIT_SCHEMA_VERSION),
    id: z.uuid(),
    slug: slugSchema, // ^[a-z0-9-]{2,60}$ — ilk yayından sonra kilitli
    version: z.int().nonnegative(), // taslakta 0, yayında 1..n
    title: z.string().trim().min(3).max(60), // "Küçük Çiftçiler"
    tagline: z.string().max(120),
    description: richTextSchema, // kit açıklaması
    icon: iconSchema,
    cover: mediaRefSchema.optional(), // kapak görseli
    category: z.enum([
      'plants',
      'space',
      'water',
      'electricity',
      'robotics',
      'earth',
      'body',
      'other',
    ]),
    ageRange: z.object({ min: z.int().min(3), max: z.int().max(14) }),
    durationMinutes: z.int().min(1).max(180).optional(),
    theme: themeSchema, // { preset, accent?, font: 'playful'|'standard', motion: 'full'|'calm'|'minimal' }
    learningObjectives: z.array(z.string().max(140)).max(10),
    materials: z.array(materialSchema).max(30),
    safetyNotes: z.array(z.string().max(200)).max(10),
    qrPrefix: z.string().regex(/^[A-Z]{2,4}$/), // "KC" → kit QR'ı KC, kartlar KC-01… — ilk yayından sonra kilitli
    qrSequence: z.int().nonnegative(), // son atanan kart numarası; asla azalmaz (silinen numara geri gelmez)
    qrEntryMode: z.enum(['focused', 'full']),
    badge: badgeSchema,
    steps: z.array(stepSchema).min(1).max(30),
  })
  .superRefine(validateKit) // benzersiz id/slug/qrCode, yaş, sahne/medya referansları, vurgu rengi kontrastı
```

#### Kart (adım) = ortak alanlar + görsel alan + blok

```ts
export const iconSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('emoji'), value: emojiSchema }),
  z.object({ kind: z.literal('library'), id: libraryIconIdSchema }), // paketlenmiş bilim ikon seti
  z.object({ kind: z.literal('media'), assetId: z.uuid() }), // yüklenen PNG/WebP ya da AI SVG
])

export const visualSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('scene'), sceneId: sceneIdSchema /* durum eşlemeleri bloktan */ }),
  z.object({
    kind: z.literal('ai-scene'),
    states: z
      .array(z.object({ state: sceneStateSchema, assetId: z.uuid() }))
      .min(2)
      .max(8), // durum başına ayrı SVG; 'static' zorunlu
  }),
  z.object({ kind: z.literal('image'), assetId: z.uuid() }),
  z.object({ kind: z.literal('video'), source: videoSourceSchema }), // yalnızca URL: youtube (videoId) | mp4 (https URL); hasSpeech → altyazı
])

const stepBase = {
  id: z.string().regex(/^[a-z0-9-]{2,40}$/), // kalıcı kimlik; ilerleme, olaylar ve QR buna bağlı
  slug: stepSlugSchema, // slugSchema + rezerve kelimeler ('tamamlandi') reddedilir
  title: z.string().min(3).max(80), // "Tohum nedir?"
  icon: iconSchema,
  cardColor: cardColorSchema,
  answer: richTextSchema.optional(), // blok türüne göre zorunlu
  narration: z.string().max(600),
  audio: mediaRefSchema.optional(),
  hint: z.string().max(120).optional(),
  celebration: z.string().max(40).optional(),
  qrCode: z.string().regex(/^[A-Z]{2,4}-\d{2,3}$/), // kart eklenirken qrSequence'tan atanır; ilk yayından sonra kilitli
  required: z.boolean(),
  aiGenerated: aiProvenanceSchema.optional(), // hangi alanlar AI ile üretildi (inceleme onayı için)
}
export const stepSchema = z.discriminatedUnion('type', [/* 13 blok */])
```

- `mediaRef` yalnızca **asset kimliği** tutar, asla URL tutmaz. URL, yayın sırasında
  `publish-kit` tarafından anlık görüntüye çözülür.
- QR kodları kart **eklendiğinde** atanır: kit öneki + `qrSequence + 1`. Bu sayede admin
  yayından önce de "QR oluştur" diyebilir. `qrSequence` taslakta tutulduğu için yayından önce
  silinen kartın (belki basılmış) numarası da tekrar kullanılmaz.
- **Video yalnızca URL ile eklenir:** YouTube bağlantısı (`youtube.com`, `youtu.be` →
  `videoId`) ya da https üzerinden doğrudan MP4 bağlantısı. Supabase'e video yüklenmez.
  `hasSpeech: true` ise altyazı zorunludur: MP4'te VTT dosyası (küçük metin dosyası, `media`'da),
  YouTube'da "Türkçe altyazı var" onayı.

#### Blok kataloğu (13)

| `type`             | E-B-M / örnek plan       | Parametreler                                                                        | Tamamlanma                                                                | Erişilebilirlik                                                                   |
| ------------------ | ------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `info`             | Bilgi, Soru+cevap        | `visual?`, `body`                                                                   | Görüntülenince                                                            | —                                                                                 |
| `tap-reveal`       | Tohum                    | `visual` (scene/ai-scene: `before`/`after`), `tapLabel`, `revealMessage`            | İlk dokunuş                                                               | Gerçek `<button>`                                                                 |
| `stage-slider`     | Marul                    | `visual`, `stages[{label, emoji, state}]` (2–6)                                     | Son evre                                                                  | Native range, `aria-valuetext`                                                    |
| `explore-hotspots` | Sera                     | `visual`, `hotspots[{label, icon, color, message, state}]` (2–6)                    | Hepsi görülünce                                                           | `aria-pressed`, `aria-live`                                                       |
| `toggle-scene`     | Işık                     | `visual` (`off`/`on`), `onLabel`, `offLabel`, `onMessage`                           | İlk "açık"                                                                | `aria-pressed`                                                                    |
| `animated-scene`   | Su                       | `visual` (scene/ai-scene), `caption`, `staticCaption`                               | Görüntülenince                                                            | Görünür Durdur/Oynat (WCAG 2.2.2); azaltılmış harekette statik kare               |
| `choose-correct`   | Çimlenme                 | `visual` (`idle`/`success`), `options[{label, icon, color, correct, feedback}]`     | Tüm doğrular                                                              | Doğrularda ✓                                                                      |
| `compare-cards`    | Tohum/Fide               | `cards[{title, icon, text, detail, tone}]` (2–3)                                    | Hepsi görülünce                                                           | `<button>`, `aria-live`                                                           |
| `quiz`             | Quiz                     | `question`, `options[]` (2–4), `correctIndex`, `explanation`                        | Doğru cevap                                                               | `radiogroup`                                                                      |
| `sequence`         | Sıralama / sürükle-bırak | `items[{label, icon}]` (3–6, doğru sıra), `successMessage`                          | Doğru sıra                                                                | Dokun-seç-dokun-yerleştir + klavye; sürükleme ek                                  |
| `matching`         | Eşleştirme               | `pairs[{left, right}]` (2–5)                                                        | Tüm eşler                                                                 | Dokun-seç-eşle + klavye                                                           |
| `experiment`       | Deney                    | `materials[]`, `safety[]`, `steps[{text, visual?, timerSec?}]`, `observationPrompt` | Son adım                                                                  | Adım adım, sayaç `aria-live`                                                      |
| `video`            | Video                    | `visual` = video (YouTube ya da MP4 URL), `caption`, `questionAfter?`               | MP4: %80 izlenince; YouTube: "İzledim" (IFrame API betiği yüklenmez, CSP) | Konuşma varsa altyazı zorunlu; YouTube dokununca, `sandbox`'lı iframe'de yüklenir |

`blockCatalog`: her blok için etiket, ikon, açıklama, "E-B-M'deki karşılığı" ipucu,
`createDefaultStep(type)` ve AI sahnesinin taşıması gereken **durum listesi** (ör. `tap-reveal` →
`before`, `after`, `static`). 5 sn'den uzun ya da döngüsel animasyonlu her sahnede görünür
Durdur/Oynat butonu vardır (WCAG 2.2.2); Durdur, `static` kareyi gösterir.

#### Sahneler: kütüphane + yapay zekâ

- **Kütüphane sahneleri:** Elle çizilmiş, tipli React SVG bileşenleri: `seed-sprout`,
  `lettuce-growth`, `greenhouse`, `leaf-kitchen`, `water-journey`, `germination`, `emoji-stage`. Her
  biri `React.lazy` ile ayrı chunk'tır. Registry `satisfies Record<SceneId, …>` kullanır.
- **AI sahneleri** (F9): Edge Function'ın ürettiği, sunucuda **temizlenmiş**, **durum başına ayrı**
  SVG dosyalarıdır (ör. `before.svg`, `after.svg`, `static.svg`).
  - Sözleşme: kök `<svg viewBox="0 0 400 260">`, `<title>` ve `<desc>`, gömülü CSS keyframes
    (durumun giriş animasyonu), `prefers-reduced-motion` kuralı, dış referans yok, dosya başına
    ≤ 12 kB. `static` durumu animasyonsuzdur.
  - Kâşif'te çizim: her durum **`<img src>`** ile gösterilir. Görüntü bağlamındaki SVG'de betik ve
    dış yükleme çalışmaz, CSS animasyonu çalışır; sayfanın CSP'sinden etkilenmez. Durum geçişi
    `src` değişimi + çapraz geçiştir. Alt metin `desc`'ten gelir. `dangerouslySetInnerHTML` ve
    DOMPurify kullanılmaz; XSS yüzeyi yoktur.

#### Güvenlik, sürüm ve şablonlar

- `richText` yalnızca `**kalın**` ve `\n` kabul eder, React düğümlerine çevrilir.
- `migrateKit(raw)` eski `schemaVersion`'ı yükseltir. Daha yeni sürümlü belge içe aktarılırsa açık
  bir hata verir.
- Şablonlar (6): **Boş**, **7 kartlı keşif** (E-B-M iskeleti), **Deney kiti**, **Quiz kiti**,
  **Hikâye kiti** (info + animated-scene zinciri), **Örnek: Küçük Çiftçiler**.

### 3.5 Durum yerleşimi

| Veri                                             | Yer                                                                                                                                                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Katalog, kitler, Studio listeleri, analitik      | TanStack Query (key factory'ler), port'lar üzerinden                                                                                                                                                      |
| Studio filtre, sekme, seçili kart, tarih aralığı | URL search params (Zod)                                                                                                                                                                                   |
| Blok içi etkileşim                               | Blokta `useReducer`                                                                                                                                                                                       |
| Kâşif üyeliği: profil, avatar, ayarlar           | **Supabase** (`explorers`, `explorer_devices`) + TanStack Query. Cihazda yalnızca aktif üye kimliği (`localStorage` `kasif:active-explorer:v1`, `useSyncExternalStore`) ve çevrimdışı önbellek (ADR 0009) |
| İlerleme ve rozetler                             | **Supabase** (`explorer_kit_progress`, `explorer_badges`) kaynaktır; cihazda iyimser önbellek (IndexedDB `kasif-progress`), çevrimiçi olunca eşitlenir                                                    |
| Olay kuyruğu                                     | IndexedDB (`kasif-activity`), `client_event_id` ile tekrar gönderime dayanıklı                                                                                                                            |
| Studio formu                                     | React Hook Form + `zodResolver` (ADR 0010)                                                                                                                                                                |
| Otomatik kayıt yedeği                            | IndexedDB (`kasif-drafts`)                                                                                                                                                                                |
| Personel oturumu                                 | **Sekmeye bağlı `sessionStorage`** (`storage: sessionStorage`, `storageKey:'kasif:auth:staff'`): yenilemede korunur, sekme kapanınca biter (ADR 0011)                                                     |
| Kâşif cihaz oturumu (anonim, üyeye bağlı)        | `localStorage` (`storageKey:'kasif:auth:kid'`), düşük yetkili (ADR 0017)                                                                                                                                  |

### 3.6 Çevrimdışı ve önbellek (Workbox)

| Kaynak                                         | Strateji                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Uygulama kabuğu, fontlar (latin + latin-ext)   | Precache (`cacheId: 'kasif'`). `globIgnores`: Studio chunk'ları (`studio-*`), `__e2e__/**`          |
| `catalog.json`, `qr-index.json`, `latest.json` | NetworkFirst, 4 sn zaman aşımı (R16); sunucuda `max-age=0` (supabase-js `cacheControl: '0'`)        |
| `kits/{slug}/v{n}.json`                        | CacheFirst (değişmez, `max-age=31536000, immutable`)                                                |
| Görsel, ses, AI SVG                            | CacheFirst, en fazla 300 kayıt, 60 gün                                                              |
| Video (YouTube / MP4 URL)                      | Önbelleğe alınmaz; çevrimdışında "Video için internet gerekli" mesajı ve kartın geri kalanı çalışır |
| QR okuyucu (zxing-wasm)                        | `.wasm` self-host (`wasm/`), ilk kullanımda CacheFirst; CSP `'wasm-unsafe-eval'`                    |
| Üye verisi (profil, ilerleme, rozet)           | NetworkFirst → IndexedDB önbelleği; yazımlar olay kuyruğu üzerinden                                 |
| Olaylar                                        | IndexedDB kuyruğu → çevrimiçi olunca toplu `record_events`                                          |

**Güncelleme politikası (F13.4, ADR 0019):** Tek SW `registerType:'prompt'` ile kaydedilir. Kâşif'te
çocuk güncelleme uyarısına tıklamaz; yeni SW, Bilim Merkezi ekranına dönüşte kendiliğinden
etkinleşir. Studio'da `UpdateToast` gösterilir (oturum `sessionStorage`'da olduğu için yenileme
çıkış yaptırmaz). Katalog `minAppVersion` taşır; daha eski uygulama "Güncelleniyor…" ile SW'yi
yeniler. Canlıdaki coming-soon SW'sinden geçişte `cleanupOutdatedCaches` kullanılır.

**Kalıcı depolama:** İlk üyelikte `navigator.storage.persist()` istenir. iOS Safari'de (ana ekrana
eklenmemiş) 7 gün etkileşim olmazsa site verisi silinir; üyelik ve ilerleme Supabase'de olduğu için
Kâşif koduyla geri gelir, yalnızca çevrimdışı önbellek yeniden indirilir (§3.12).

**Önbellek onarımı (F13.5):** Aynı `github.io` kökenindeki başka bir sitenin service worker'ı
(ör. E-B-M) Kâşif önbelleklerini silebilir. Bu yüzden:

- Uygulama açılışta `kasif-precache` varlığını ve kit indirmelerinin bütünlüğünü denetler.
- Eksikse ve çevrimiçiyse service worker'ı yeniden kaydederek önbelleği onarır.
- "İnternetsiz hazır" rozeti bir bayrağa değil, gerçek önbellek içeriğine göre gösterilir.

### 3.7 Güvenlik ve KVKK

- **Ortak köken (github.io):** `erzurum-bilim-merkezi.github.io` altındaki tüm org siteleri
  (ör. `/E-B-M/`) aynı kökendedir. Bu sitelerden herhangi biri Kâşif'in localStorage,
  IndexedDB ve önbellek içeriğine erişebilir. Karar (ADR 0013):
  - Org'daki tüm repolar **güvenilir** kabul edilir; Pages yayınlama yetkisi org sahipleriyle sınırlanır.
  - Personel oturumu sekmeye bağlı `sessionStorage`'da tutulur (localStorage'a hiç yazılmaz).
  - Tüm anahtar ve önbellek adları `kasif:` / `kasif-` öneklidir.
  - Özel alan adına sonradan geçiş mümkündür: GitHub, eski adresi yol öneki (`/E-B-M-DIGITAL/`)
    düşürülmüş ama sorgu korunmuş şekilde yönlendirir; **basılı QR'lar çalışmaya devam eder**.
    Kurulu PWA'lar ve cihazdaki profiller ise taşınmaz. Bu nedenle özel alan adı isteniyorsa
    geçişin F12'den ve toplu QR basımından önce yapılması önerilir (§9).
- **Anahtarlar:**
  - Publishable key tarayıcı içindir. Env şeması `sb_secret_` önekli ya da `service_role`
    rolündeki anahtarı reddeder ve build'i kırar.
  - Secret key yalnızca Edge Function ortamındadır, GitHub'da tutulmaz.
  - **`GEMINI_API_KEY` yalnızca Edge Function secret'ıdır.** `VITE_GEMINI_API_KEY` kullanılmaz:
    `VITE_` değerleri build'de bundle'a gömülür ve GitHub Pages'te herkes okuyabilir. Google da
    anahtarın istemci koduna konmamasını, arka uç üzerinden çağrılmasını söyler. Env şeması
    `VITE_` önekli `*_API_KEY`/`*_SECRET` değişkenlerini, bundle taraması da `AIza…` (Google),
    `sk-ant-` ve `sb_secret_` desenlerini bulursa build'i kırar.
- **Personel kimliği:**
  - Kayıt kapalı. Roller `admin` ve `editor`. Admin için TOTP 2FA zorunlu (`aal2`,
    restrictive RLS politikaları).
  - Pasifleştirmede ban uygulanır ve RLS `active` kolonunu her sorguda kontrol eder.
  - Son admin korunur. JWT ömrü 30 dk.
  - **En az 2 aktif admin** (2FA kayıtlı) F12 kapı şartıdır; tek admin kaldığında panoda kırmızı
    uyarı. TOTP kaybında e-posta akışı olmadığı için onaylı `admin-mfa-reset` workflow'u (production
    Environment, secret key ile faktörü siler) ve runbook vardır.
- **Kâşif (çocuk) kimliği:**
  - Her cihaz anonim Supabase oturumu açar; bu oturum `explorer_devices` ile bir ya da daha çok
    **Kâşif üyesine** bağlanır. Anonim kullanıcıya **asla** personel profili açılmaz, çünkü
    `profiles` yalnızca `admin-users` fonksiyonu tarafından yazılır.
  - Anonim kullanıcılar Postgres'te `authenticated` rolündedir. Personel politikaları
    `private.app_role()`'e dayanır; bu fonksiyon anonim kullanıcı için `null` döner. pgTAP, anonim
    JWT'yi `authenticated`'a verilen her yetkiye karşı dener.
  - **Kâşif kodu** bir taşıyıcı kimlik bilgisidir: 8 karakter Crockford base32 (≈ 40 bit),
    sunucuda yalnızca özeti tutulur, `restore_explorer` uid ve IP başına hız sınırlıdır (5 hatalı
    denemede 15 dk bekleme). Kâşif kartı QR'ı URL değil `KASIF:<kod>` metnidir; telefon kamerası
    bir adres açmaz, yalnızca uygulama içi okuyucu tanır.
- **Edge Function CORS:** Canlıda yalnızca canlı köken (`ALLOWED_ORIGIN`); localhost yalnızca
  yerel yığında.
- **GitHub Pages sınırı:** HTTP başlığı tanımlanamaz. Önlemler:
  - Build'de `<head>`'in ilk öğesi olarak meta CSP üretilir (**F0.9'dan itibaren**; tüm E2E'ler bu
    CSP altında koşar). Tek kaynak `csp.config.ts`, nginx dosyası da buradan üretilir:
    `default-src 'self'`; `script-src 'self' 'wasm-unsafe-eval'` (yol kısıtlı; zxing-wasm);
    `style-src 'self' 'unsafe-inline'` (Radix/react-remove-scroll ve Sonner çalışma anında
    `<style>` ekler, statik sitede nonce yok; betikler kısıtlı olduğu için risk düşük, ADR 0013);
    `img-src 'self' data: blob:` + tam Supabase kökeni; `connect-src 'self'` + Supabase;
    `media-src https:` (MP4 URL'leri); `frame-src https://www.youtube-nocookie.com`;
    `worker-src 'self'`; `manifest-src 'self'`; `base-uri 'none'`; `object-src 'none'`.
  - `vite-plugin-pwa` kaydı için `injectRegister:false` + sanal modül kullanılır.
  - Studio iframe içinde render etmez. `Referrer-Policy` meta etiketi eklenir.
  - `frame-ancestors` meta ile verilemez; bu sınırlama ADR'de kayıtlıdır.
- **Girdi:**
  - Zod hem istemcide hem Edge Function'da çalışır.
  - Bucket'lar MIME ve boyut sınırlıdır. Kullanıcı SVG ve video yükleyemez; SVG'yi yalnızca
    `ai-generate` temizleyip `ai/` yoluna yazar.
  - Video URL'leri: yalnızca `https:`; YouTube bağlantısı `videoId`'ye çözülür, iframe
    `youtube-nocookie.com` üzerinden `sandbox="allow-scripts allow-same-origin allow-presentation"`
    ile (popup ve üst sayfa yönlendirmesi yok; çocuk youtube.com'a çıkamaz) ve `rel=0` ile açılır.
  - Takma adlar için uzunluk, karakter kümesi ve Türkçe küfür/uygunsuz kelime filtresi uygulanır.
- **Denetim:** `audit_log` durum, yayın, kullanıcı/rol, veri silme ve AI kullanımını kaydeder.
  Taslak kayıtları kit/kullanıcı başına saatte en fazla 1 kez, diff'siz yazılır. Kaydı yalnızca
  admin okur.

### 3.8 Veri erişim katmanı: port'lar ve adapter'lar (ADR 0015)

Tek Supabase ortamı canlı ortamdır. Bu yüzden geliştirme ve test **asla** ona bağlanmaz. Her feature
kendi port'unu ve iki adapter'ını (`*.mock.ts`, `*.supabase.ts`) tanımlar.

| Port                | Metotlar (özet)                                                                                                                                                                                | Feature        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `AuthService`       | `signIn`, `verifyTotp`, `enrollTotp`, `signOut`, `getSession`, `onChange`, `changePassword`                                                                                                    | auth           |
| `UserAdminService`  | `list`, `create → tempPassword`, `resetPassword → tempPassword`, `setRole`, `setActive`                                                                                                        | user-admin     |
| `KitRepository`     | `list(filter, page)`, `get(id)`, `create`, `update(id, draft, lockVersion)`, `rename(id, slug, qrPrefix)` (hiç yayınlanmamışsa), `duplicate`, `remove` (yayınlanmamışsa)                       | kit-studio     |
| `PublishingService` | `submitForReview`, `withdrawReview`, `requestChanges(note)`, `publish(notes, visibility, lockVersion)`, `setVisibility`, `archive`, `listVersions`, `restoreToDraft(v)`, `regenerateSnapshots` | kit-publishing |
| `QrRegistry`        | `listForKit(kitId)`                                                                                                                                                                            | qr-print       |
| `MediaRepository`   | `upload(file, meta)` (görsel, ses, VTT; video yok), `list(filter)`, `usage(id)`, `remove`, `quota()`                                                                                           | media-library  |
| `AiService`         | `generateScene`, `generateIcon`, `draftCardText`, `draftKit` (akışlı ilerleme), `quota()`                                                                                                      | ai-studio      |
| `ContentSource`     | `catalog()`, `qrIndex()`, `kit(slug)`, `kitVersion(slug, v)`                                                                                                                                   | kit-catalog    |
| `ExplorerService`   | `ensureDeviceSession`, `register(nickname, avatar)`, `restore(code)`, `listOnDevice`, `update`, `getProgress`, `getBadges`, `deleteMembership`, `activateCenterDevice(code)`                   | explorer       |
| `EventSink`         | `send(events[])` (idempotent)                                                                                                                                                                  | activity       |
| `AnalyticsReader`   | `dashboard(range)`, `kitStats(kitId, range)`, `explorers(filter, page)`, `explorerTimeline(id)`, `exportCsv(range)`                                                                            | analytics      |

- **`*.supabase.ts`:** supabase-js ya da `contentClient` kullanır. İstemci **enjekte edilir**,
  böylece testte her role ayrı istemci verilebilir. Her yanıt Zod ile ayrıştırılır.
- **`*.mock.ts`:** `shared/api/mock-db.ts` kullanır. Domain bilmeyen, **enjekte edilen**
  depolamaya (varsayılan `localStorage`; medya blob'ları IndexedDB'de) doğrudan okuyup yazan bir
  koleksiyon deposudur.
  - Gecikme varsayılanı 0'dır. Yükleme durumu testleri için kontrol edilebilir "bekle" kancası
    vardır.
  - Hata enjeksiyonu desteklenir.
  - Rol kontrollerini uygular.
  - `AiService` mock'u sabit fixture SVG'leri ve metinleri döndürür; kota dolu, zaman aşımı ve
    güvenlik filtresi engeli senaryoları enjekte edilebilir.
- **Seçim:** `VITE_BACKEND=mock|supabase`.
  - Geliştirme ve `e2e` modlarında varsayılan `mock`.
  - Üretim build'i `supabase` ister; mock seçiliyse **build kırılır**.
  - Geliştirici bilerek canlıya bağlanırsa Studio'da kırmızı "CANLI ORTAM" bandı görünür.
- **Sözleşme testleri (`*.contract.ts`):** Her port için tek bir paket yazılır. Aynı paket mock'a
  karşı her commit'te, Supabase'e karşı CI'da yerel yığınla çalışır.
- CLAUDE.md veri kuralı ADR 0015 ile güncellenir: "Veri erişimi feature'ın `api/` port'u
  üzerinden. Adapter'lar `apiClient`/`contentClient` veya `shared/api/supabase`'i kullanır. Yanıtlar
  Zod ile ayrıştırılır, sorgular `queryOptions` + key factory ile yapılır."

### 3.9 Supabase veri modeli ve RLS

Şema, **tüm fazların** ihtiyacını kapsayacak şekilde F4'te bir kerede tasarlanır. Tek kurum
olarak başlanır, ama `organization_id` kolonları şimdiden eklenir (v2'de çok kurumlu yapı için).

```sql
create type app_role       as enum ('admin', 'editor');
create type kit_status     as enum ('draft', 'in_review', 'published', 'archived');
create type kit_visibility as enum ('public', 'unlisted');   -- unlisted = katalogda yok; gizli değildir
create type activity_type  as enum ('qr_scan', 'kit_open', 'card_open', 'card_complete',
                                    'quiz_answer', 'kit_complete', 'badge_earned', 'certificate_view');

organizations        (id uuid pk, name text, created_at)                                -- tek satır: EBM
profiles             (id uuid pk → auth.users, organization_id, display_name, role app_role,
                      active bool, must_change_password bool, created_at)
kits                 (id uuid pk, organization_id, slug text unique, qr_prefix text unique,
                      status kit_status, visibility kit_visibility, draft jsonb,
                      published_version int, first_published_at, review_note text,
                      reviewed_lock_version int null, is_test bool default false,
                      lock_version int, owner_id, created_at, updated_at, updated_by,
                      check (draft->>'id' = id::text), check (draft->>'slug' = slug),
                      check (draft->>'qrPrefix' = qr_prefix))              -- slug/önek yalnızca rename_kit ile
kit_versions         (kit_id, version, document jsonb, content_sha256 text, notes, published_by,
                      published_at, finalized_at timestamptz null,
                      primary key (kit_id, version))   -- değişmez; yalnızca finalized_at bir kez yazılır
qr_codes             (code text pk, kit_id, step_id text null, active bool, created_at) -- asla silinmez/yeniden kullanılmaz
media_assets         (id uuid pk, organization_id, kind text check (kind in ('image','audio','captions',
                      'ai-scene','ai-icon','icon')), path, mime, bytes, width, height, duration_sec,
                      alt text, meta jsonb, source text, scene_group uuid null, created_by, created_at)
                                                        -- source: upload|ai; video yok (yalnızca URL)
explorers            (id uuid pk, organization_id, nickname text, avatar text, display_code text,
                      restore_code_hash text unique, settings jsonb, created_via text,  -- 'self'|'center'
                      created_at, last_seen_at)          -- display_code: "A7F2" (gösterim), üyelik kaydı
explorer_devices     (explorer_id → explorers on delete cascade, device_uid → auth.users on delete cascade,
                      linked_at, last_seen_at, primary key (explorer_id, device_uid))
explorer_events      (id bigint pk, explorer_id uuid → explorers on delete cascade, kit_id, step_id text,
                      type activity_type, data jsonb, client_event_id uuid unique, is_preview bool,
                      occurred_at,  -- istemciden; sunucuda [now−7 gün, now+5 dk] aralığına sınırlanır
                      received_at)  -- sunucu; 60 gün saklanır
explorer_kit_progress(explorer_id, kit_id, started_at, completed_at, completed_steps text[],
                      qr_scans int, total_duration_ms bigint, primary key (explorer_id, kit_id))
explorer_badges      (explorer_id, badge_id text, kit_id uuid null, earned_at,
                      primary key (explorer_id, badge_id))
center_devices       (id uuid pk, device_uid uuid null → auth.users, label text, setup_code_hash text,
                      setup_expires_at, pin_hash text, activated_at, revoked_at, created_by)
analytics_daily      (day date, kit_id, step_id text not null default '', type activity_type,
                      count int, sum_duration_ms bigint, correct int,
                      primary key (day, kit_id, step_id, type))   -- '' = kit düzeyi; süresiz, toplu
analytics_daily_uniques (day date, kit_key text not null default '', explorers int, new_explorers int,
                      devices int, primary key (day, kit_key))    -- '' = merkez geneli
app_settings         (key text pk, value jsonb, updated_by, updated_at)  -- AI kotası, saklama süreleri…
rate_limit_counters  (bucket text, subject text, window_start timestamptz, count int,
                      primary key (bucket, subject, window_start))    -- yalnızca definer RPC'ler
publish_state        (id smallint pk check (id = 1), generation bigint, written_generation bigint,
                      lease_holder uuid null, lease_expires_at timestamptz null)  -- yayın kiralaması
ai_usage             (id bigint pk, user_id, provider text, model text, kind text, input_tokens,
                      output_tokens, thinking_tokens, status text, created_at)   -- ücretsiz katman: 0 USD
client_errors_daily  (day, app text, route text, message_hash text, message text, count,
                      primary key (day, app, route, message_hash))
audit_log            (id bigint pk, actor, action, entity, entity_id, meta jsonb, at)
```

- **Aralık tekilleri:** Günlük tekiller toplanabilir değildir (günlüklerin toplamı aylık tekil
  vermez). Keyfi tarih aralığındaki tekil kâşif sayısı yalnızca ham olay saklama süresi (60 gün)
  içinde hesaplanır; daha eski dönemler için günlük tekiller gösterilir.

**Yetki modeli:**

- RLS açık, anon rolünün tablo yetkileri geri alınmış.
- Kolon bazlı `GRANT`: `kits` için yalnızca `draft` ve `lock_version` güncellenebilir. Tetikleyici
  `lock_version = old + 1`, `updated_by = auth.uid()` ve `updated_at` alanlarını kendisi yazar.

| Tablo / bucket                                          | select                                                             | yazma                                                                                                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| profiles                                                | kendisi + admin                                                    | yalnızca `admin-users` (çağıranın JWT'siyle definer RPC)                                                                                                                                                    |
| kits                                                    | aktif personel                                                     | admin: `draft`; editor: `draft` yalnızca `draft` durumunda (`in_review`'da kilitli; önce `withdraw_review`); insert personel; delete admin ve `first_published_at is null`; slug/önek yalnızca `rename_kit` |
| kit_versions, qr_codes                                  | aktif personel                                                     | yalnızca `publish-kit`                                                                                                                                                                                      |
| media_assets                                            | aktif personel                                                     | admin, editor; delete admin ve kullanımda değilse (taslaklar **ve** `kit_versions`)                                                                                                                         |
| explorers, explorer_devices                             | admin; cihaz kendi bağlı üyelerini                                 | yalnızca RPC: `register_explorer`, `restore_explorer`, `update_explorer`, `delete_membership` (bağlı cihaz) / `admin_delete_explorer`                                                                       |
| explorer_events, explorer_kit_progress, explorer_badges | admin; cihaz kendi bağlı üyelerinin ilerleme ve rozetlerini        | yalnızca `record_events` RPC                                                                                                                                                                                |
| center_devices                                          | admin                                                              | admin (kurulum kodu üretimi); etkinleştirme `activate_center_device` RPC                                                                                                                                    |
| analytics_daily, analytics_daily_uniques                | aktif personel                                                     | pg_cron toplama işi                                                                                                                                                                                         |
| app_settings                                            | aktif personel                                                     | admin                                                                                                                                                                                                       |
| rate_limit_counters, publish_state                      | yok                                                                | yalnızca definer RPC'ler                                                                                                                                                                                    |
| ai_usage                                                | admin; kullanıcı kendi satırları                                   | yalnızca `ai-generate`                                                                                                                                                                                      |
| client_errors_daily                                     | admin                                                              | `report_client_error` RPC (oturum zorunlu, hız sınırlı)                                                                                                                                                     |
| audit_log                                               | admin                                                              | yalnızca tetikleyiciler/RPC'ler                                                                                                                                                                             |
| storage `media`                                         | herkese açık okuma, **listeleme yok** (anon SELECT politikası yok) | admin, editor: webp/png/jpeg · mpeg/mp4 ses · VTT (video yok); boyut: görsel 300 kB (istemci hedefi 150 kB), ses 1 MB, VTT 100 kB · `ai/` yolu yalnızca `ai-generate`                                       |
| storage `published`                                     | herkese açık okuma                                                 | yalnızca `publish-kit`                                                                                                                                                                                      |

**RPC'ler:**

- Yardımcılar açığa çıkmayan `private` şemasındadır: `private.app_role()`,
  `private.is_active_staff()`, `private.is_aal2()`. Hepsi `stable security definer`,
  `set search_path = ''`.
- Varsayılan EXECUTE yetkileri `public, anon, authenticated`'dan geri alınır; her RPC'ye açıkça
  yetki verilir.

| RPC                                                                                 | Kim                       | Görev                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ping`                                                                              | anon                      | Keep-alive                                                                                                                                                                                                                                                                                   |
| `schema_version`                                                                    | anon                      | Son uygulanan migration sürümü (salt okunur); deploy kapısı (§3.10)                                                                                                                                                                                                                          |
| `submit_for_review`, `withdraw_review`, `request_changes`, `restore_to_draft`       | personel                  | Taslak durumu geçişleri; `submit_for_review` incelenen `lock_version`'ı `reviewed_lock_version`'a yazar, yayın yalnızca bununla yapılır                                                                                                                                                      |
| `rename_kit`                                                                        | personel                  | Slug ve QR öneki; yalnızca `first_published_at is null` iken, benzersizlik kontrolüyle                                                                                                                                                                                                       |
| `register_explorer`, `update_explorer`, `delete_membership`                         | anonim cihaz              | Takma ad doğrulama + filtre; Kâşif kodu üretimi (yalnızca bir kez düz metin döner); kişisel cihazda en fazla 10 bağlı üye, **merkez cihazında sınır yok**; silme üyeliği ve tüm verisini kaldırır                                                                                            |
| `restore_explorer(code)`                                                            | anonim cihaz              | Kod özeti eşleşirse üyeyi bu cihaza bağlar; uid ve IP başına hız sınırı (5 hatada 15 dk)                                                                                                                                                                                                     |
| `activate_center_device(code)`                                                      | anonim cihaz              | Tek kullanımlık kurulum kodu (24 saat) → cihaz merkez cihazı olur                                                                                                                                                                                                                            |
| `record_events(batch)`                                                              | anonim cihaz              | ≤ 50 olay; sabit tür listesi; kit/kart kimlikleri aktif `qr_codes`'ta olmalı; `occurred_at` [now−7 gün, now+5 dk] aralığına sınırlanır; üye bu cihaza bağlı olmalı; uid başına dakikada ≤ 120 olay (`rate_limit_counters`); ilerleme ve rozet upsert; `is_preview` olaylar toplamlara girmez |
| `report_client_error`                                                               | oturumlu (cihaz/personel) | Mesaj özeti + sayaç; kişisel veri temizlenir; uid/gün kotası                                                                                                                                                                                                                                 |
| `storage_usage`, `db_usage`                                                         | admin                     | Kota göstergeleri                                                                                                                                                                                                                                                                            |
| `dashboard_stats`, `kit_stats`, `explorer_list`, `explorer_timeline`, `export_rows` | admin (bazıları editor)   | Analitik okuma; `security invoker`                                                                                                                                                                                                                                                           |

**Edge Functions:** Her fonksiyon `auth.getUser(token)` + profil `active` + rol (+ admin için
`aal2`) kontrolü yapar. CORS canlıda yalnızca canlı kökene, yerel yığında localhost'a izin verir.
401/403 testleri vardır.

| Fonksiyon     | İşlem                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `publish-kit` | `action`: `publish`, `set-visibility`, `archive`, `unarchive`, `regenerate`. Edge Function DB'ye PostgREST üzerinden eriştiği için (her RPC ayrı transaction) advisory lock kullanılmaz. Akış: 1) `publish_state` üzerinde süreli **kiralama** (60 sn) RPC ile alınır; 2) taslak Zod ile doğrulanır, `reviewed_lock_version`/`lock_version` eşleşmesi kontrol edilir, medya referansları çözülür; 3) sürüm `kit_versions`'a `finalized_at = null` ile **ayrılır** (çağıranın JWT'siyle definer RPC, audit'te aktör görünür); 4) `v{n}.json` `upsert:false` ile yazılır, dosya zaten varsa ve hash aynıysa başarı sayılır; 5) sürüm kesinleştirilir, `generation` artar; 6) `latest.json`, `catalog.json` (yalnızca `public`, `is_test` hariç), `qr-index.json` **DB'den yeniden üretilir** (`cacheControl` 0 → `max-age=0`); yazımdan sonra `generation` değişmişse yeniden üretilir; 7) kiralama bırakılır. Yarıda kalan yayın aynı çağrıyla tamamlanır (idempotent). `regenerate`, yedekten dönüşte Storage'ı DB'den yeniden kurar |
| `admin-users` | Oluştur (geçici parola), parolayı sıfırla (72 saat geçerli geçici parola), rol, aktiflik (ban + çıkış), parola değişikliğini tamamla (bayrağı temizler). Son aktif admini düşürmeyi satır kilidiyle reddeder                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `ai-generate` | §3.13                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Zamanlanmış işler (pg_cron):**

- Saatlik: `explorer_events` → `analytics_daily` toplama. Zaman penceresine göre değil, son
  işlenen `id` işaretinden itibaren **artımlı** çalışır; böylece 7 güne kadar geç gelen çevrimdışı
  olaylar da sayılır. Her olay `occurred_at`'in **Europe/Istanbul** gününe upsert edilir.
  `is_preview` olaylar ve `is_test` kitler hariçtir. `analytics_daily_uniques` son 8 gün için
  yeniden hesaplanır.
- Günlük:
  - 60 günden eski ham olayların silinmesi (ziyaretçi eşiği aşılırsa 30 gün, `app_settings`).
  - 24 saatten eski `is_preview` olayların silinmesi.
  - 12 ay hareketsiz Kâşif üyeliklerinin silinmesi (tüm verisiyle).
  - 30 gün hareketsiz ve hiçbir üyeye bağlı olmayan anonim auth kullanıcılarının silinmesi.
  - 180 günden eski audit kayıtlarının silinmesi.
  - 24 saatten eski hız sınırı sayaçlarının ve süresi dolmuş kurulum kodlarının temizlenmesi.

### 3.10 Tek ortam: veritabanı değişiklik protokolü (ADR 0016)

> **3 kez planla, 1 kez uygula.** Migration dosyaları canlıya **ilk uygulanana kadar** serbestçe
> düzenlenir; her CI koşusu yerel Supabase'i sıfırdan kurar. Canlıya uygulama F12'de **bir kez**
> yapılır.

| Tur                   | Ne yapılır                                                                                                                                                                     | Çıktı                            | Onay                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------- |
| **Plan 1 · Tasarım**  | Tüm fazları kapsayan tablo, kolon, kısıt, indeks, enum, yetki (GRANT), RLS, RPC, Storage, Edge Function tasarımı; **boyut tahmini** (§3.11 formülü); isimlendirme              | `docs/database/schema.md`        | `frontend-architect` + kullanıcı            |
| **Plan 2 · İnceleme** | **Sorgu kataloğu**: her port metodu → SQL/RPC/Storage → izin veren politika/GRANT → indeks. Güvenlik kontrol listesi (§F4.2). Tehdit modeli: anonim cihaz, editör, ortak köken | `docs/database/query-catalog.md` | `security-auditor` + kullanıcı              |
| **Plan 3 · Prova**    | CI'da yerel Supabase: `db reset` ×2, `db lint`, pgTAP (RLS + GRANT matrisi), sözleşme testleri, Edge Function testleri, tam yığın E2E. F5–F11 boyunca her commit'te            | Yeşil CI + M2 altın yolculuğu    | Kapı kontrol listesi (F12.1)                |
| **Uygula · 1 kez**    | Şifreli yedek → `db push --dry-run` incelenir → onaylı workflow ile `db push` → `db diff --linked` boş → `db lint --linked` → Security Advisor → salt okunur duman testi       | Canlı şema = repo                | GitHub Environment `production` (kullanıcı) |

**Uygulamadan sonra:**

- Yalnızca **ekleyici** migration'lar yapılır (genişlet → taşı → daralt). Yıkıcı değişiklik ADR ve
  yedek olmadan yapılmaz.
- Her değişiklik aynı 3 turdan geçer ve `docs/database/change-log.md`'ye yazılır.
- Canlıya elle SQL çalıştırılmaz; `db push` yalnızca workflow ile yapılır.
- `db dump`, `db diff` ve `test db` Docker ister, bu yüzden yalnızca GitHub Actions'da çalışır.
- **Canlı DB bağlantısı:** Free'de doğrudan veritabanı adresi yalnızca IPv6'dır; GitHub
  runner'larında IPv6 yoktur. Tüm workflow'lar Supavisor **session pooler** bağlantı dizesini
  (port 5432, `SUPABASE_DB_URL`) kullanır; transaction pooler (6543) `pg_dump` ve migration için
  uygun değildir. F4.11'de workflow'lar bu dizeyle kurulur, F12.5'te ilk bağlantıda doğrulanır.
- **Deploy sırası (ADR 0019):** genişlet (migration) → Edge Functions → frontend → daralt.
  `deploy.yml` build'den önce canlı `schema_version()`'ı okur; repodaki son migration canlıdan
  yeniyse deploy durur ("önce `db-migrate`").
- **Geriye uyumluluk:** Kâşif uygulamaları service worker önbelleğinde haftalarca eski sürümde
  kalabilir. RPC imzası değişecekse yeni bir `_v2` RPC eklenir, eskisi en az 90 gün kalır. Kit
  `schemaVersion` artışında katalog `minAppVersion` taşır (§3.6).
- CI, `--linked` ile `reset`, `test` ya da `--include-seed`'i birlikte kullanan bir workflow
  görürse düşer.
- Vitest ve Playwright, localhost olmayan bir Supabase URL'si ya da yerel yığının varsayılanı
  olmayan bir anahtar görürse durur.

### 3.11 Supabase Free planına göre tasarım

| Free kısıtı (doğrulandı)                                   | Önlem                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Veritabanı 500 MB                                          | Ham olaylar 60 gün, sonra yalnızca günlük toplamlar; denetim kısıtlı; boyut formülü + pano uyarısı (%70/%85)                                                                                                                                                                     |
| Depo 1 GB, dosya ≤ 50 MB                                   | Görsel WebP ≤ 150 kB hedef / 1200 px, ses ≤ 1 MB, **video yüklenmez (yalnızca URL)**; QR görseli saklanmaz; sahneler kodda; AI SVG ≤ 12 kB/durum; kota göstergesi                                                                                                                |
| Çıkış trafiği 5 GB önbelleksiz + 5 GB önbellekli           | **Trafik formülü** (aşağıda, Plan 1'de kesinleşir); video yalnızca URL (trafik YouTube'da/kaynakta); değişmez dosyalar uzun önbellek; SW önbelleği; artımlı medya yedeği; pano "tahmini aylık trafik" göstergesi; aşılırsa B planı                                               |
| Temel CDN: üzerine yazınca önbellek temizlenmez, purge yok | Değişen dosyalar `max-age=0` (supabase-js `cacheControl` değeri `max-age` olarak yazılır); sürümlü dosyalar asla üzerine yazılmaz (`upsert:false`); CDN tazeliği F12.10'da ölçülür                                                                                               |
| Görsel dönüştürme yok                                      | Tarayıcıda küçültme                                                                                                                                                                                                                                                              |
| Edge Function: 150 sn toplam, 2 sn CPU, 256 MB             | AI akışı 120 sn'de kesilir; SVG sınırı; CPU yoğun iş (temizleme) küçük girdide                                                                                                                                                                                                   |
| 7 gün hareketsizlikte duraklama                            | 3 günde bir `ping` (publishable key) + ücretsiz dış uptime izleyici (Pages ve `ping`, 5 dk'da bir; e-posta uyarısı); zamanlanmış workflow'lar 60 gün repo hareketsizliğinde durur → aylık elle kontrol runbook'u                                                                 |
| Otomatik yedek yok                                         | Haftalık + migration öncesi **şifreli** döküm (roles, schema, data `--use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes`) + `media` bucket **artımlı** indirme (medya değişmez; yalnızca yeni dosyalar); 7 gün saklama; üç ayda bir geri yükleme provası |
| Uyarı kanalı yok (SMTP ekip dışına göndermez)              | Uptime izleyici e-postası + gece `quota-check` workflow'u: DB/depo/MAU %70 ve %85'te GitHub issue açar                                                                                                                                                                           |
| Dahili SMTP yalnızca ekip üyelerine, saatte 2              | E-postasız akış: geçici parola; özel SMTP isteğe bağlı                                                                                                                                                                                                                           |
| Anonim giriş: IP başına saatte 30                          | Panelden 300/saat'e yükseltilir (merkez ve okul NAT'ı); CAPTCHA yok (çocuklara üçüncü taraf betik yüklenmez), telafi kontrolleri §3.9                                                                                                                                            |
| MAU 50.000                                                 | Her çocuk cihazı bir MAU sayılır; pano göstergesi                                                                                                                                                                                                                                |
| Sızdırılmış parola koruması Pro'da                         | Güçlü parola politikası + admin 2FA                                                                                                                                                                                                                                              |
| Log saklama 1 gün (auth denetimi 1 saat)                   | Kritik olaylar `audit_log`'a; istemci hataları `client_errors_daily`'ye                                                                                                                                                                                                          |

**Veritabanı boyut formülü (Plan 1'de kesinleşir, `docs/database/capacity.md`):**
`ham olay boyutu ≈ günlük ziyaretçi × ziyaret başına olay (≈ 25) × 400 B × 60 gün`.

- 400 B; satır, tuple başlığı ve dört indeksi (pk, `client_event_id`, `(kit_id, occurred_at)`,
  `(explorer_id, occurred_at)`) kapsar.
- Örnek: günde 300 çocuk için ≈ 180 MB. Kalan her şey (kitler, sürümler, üyelikler, toplamlar)
  tahminen < 60 MB.
- **Auth şeması** (anonim kullanıcılar, oturumlar, refresh token'lar, auth denetim kaydı) ayrıca
  büyür. F4.10 bunu 10 bin anonim kullanıcıyla ölçer; panelde auth denetim kaydının veritabanına
  yazılması kapatılabiliyorsa kapatılır.
- Ziyaretçi sayısı 400'ü aşarsa saklama süresi otomatik olarak 30 güne iner (`app_settings`).

**Trafik formülü (Plan 1'de kesinleşir):**
`aylık trafik ≈ aylık yeni cihaz × ilk indirme (kit JSON + görseller + ses ≈ 1,2 MB/kit) + haftalık
artımlı medya yedeği + Studio kullanımı`.

- Örnek: günde 300 çocuğun yarısı yeni cihaz → 150 × 30 × 1,2 MB ≈ 5,4 GB/ay. Bu, 5 + 5 GB'lık
  Free sınırına yakın. Video URL olduğu için bu hesaba girmez.
- Görsel başına 150 kB × 7 kart ≈ 1 MB; ses isteğe bağlıdır (TTS varsayılan).
- **B planı** (formül sınırın %70'ini aşarsa): yayın anlık görüntüsü ve yayınlanmış medya,
  `publish-kit` sonrası `repository_dispatch` ile GitHub Pages'e kopyalanır (Pages'in yumuşak
  sınırı ~100 GB/ay). Supabase Storage yalnızca Studio'nun çalışma kopyası olur. Tetikleme için
  yalnızca bu repoda `actions:write` yetkili, ince taneli bir token Edge Function secret'ı olarak
  tutulur. ADR 0020'de ayrıntılandırılır.

### 3.12 Kâşif üyeliği, etkinlik takibi ve KVKK (ADR 0009, ADR 0017)

**Kullanıcı kararı (2026-09-24):** Veli izni ekranı yoktur; çocuklar uygulamayı eğitmen gözetiminde
kullanır. Her çocuk **Kâşif üyesi** olur ve tüm bilgisi (profil, ilerleme, rozet, ayarlar,
etkinlik) Supabase'de durur. Cihaz yalnızca oturum anahtarı ve çevrimdışı önbellek tutar.

**Akış:**

1. **İlk açılış** (`/hosgeldin`). Kâşif Robot "Merhaba! Ben Kâşif. Senin adın ne?" diye sorar.
   - Takma ad: 2–20 karakter, Türkçe harfler ve boşluk. Filtreden geçer. "Takma ad da olur" ipucu
     gösterilir.
   - 6 renkli maskot arasından **avatar** seçilir.
   - "🚀 Bilim Merkezine Gir" → üyelik açılır → "Hoş geldin Ayşe!" animasyonu → Bilim Merkezi.
     Altta "Aydınlatma metni" bağlantısı vardır.
   - "Kâşif kodum var" → `/giris`: kod yazılır ya da Kâşif kartındaki QR okutulur.
   - QR ile ilk kez gelindiyse akış en fazla 3 dokunuşla (ad → avatar → gir) karta döner.
2. **Üyelik ve cihaz.**
   - Cihaz ilk çevrimiçi anında anonim Supabase oturumu açar; `register_explorer` üyeliği
     oluşturur ve bu cihaza bağlar (`explorer_devices`). Bir cihaza birden çok üye bağlanabilir
     ("Kâşif değiştir").
   - Üye bir **Kâşif kodu** alır (ör. `KSF-7Q2M-X9`). Kod profil sayfasındaki **Kâşif kartında**
     gösterilir ve yazdırılabilir. Başka cihazda, başka tarayıcıda ya da veriler silindikten sonra
     kodla aynı üyeliğe dönülür.
   - Çevrimdışıyken üyelik yerelde (istemci UUID'siyle) başlar, çevrimiçi olunca sunucuda açılır;
     kuyruktaki olaylar sırayla gider.
3. **Kaydedilenler:** QR okutma (kaynak: kamera / uygulama içi / elle), kit ve kart açma, kart
   tamamlama (süre, deneme sayısı), quiz cevabı (doğru mu), kit tamamlama, rozet, sertifika.
   Admin kâşifi ad ve gösterim koduyla görür ("Ayşe #A7F2"). Konum, fotoğraf, cihaz modeli ve IP
   **kaydedilmez**. Supabase platformunun kendi logları IP'yi 1 gün tutar; bu bilgi aydınlatma
   metninde yer alır.
4. **Haklar:**
   - "Üyeliğimi ve verilerimi sil" üyeliği ve tüm verisini sunucudan siler (çevrimdışıysa
     kuyruğa alınır).
   - Admin panodan kâşif silebilir ve verisini dışa aktarabilir (erişim hakkı, KVKK m.11).
   - Saklama: 12 ay hareketsizlikte otomatik silme; ham olaylar 60 gün.
5. **Paylaşımlı cihaz (merkez tabletleri):**
   - **Merkez cihazı modu** Studio'daki tek kullanımlık kurulum koduyla açılır (`center_devices`).
     Bu cihazda bağlı üye sınırı yoktur.
   - 90 sn boşta kalınca "Hâlâ orada mısın?" sorulur, ardından karşılama ekranına dönülür (yeni
     ziyaretçi). Önceki üyenin cihaz bağlantısı kaldırılır; çocuk evde Kâşif koduyla devam eder.
   - Ekran kilitlenmez (wake lock); çıkış eğitmen PIN'iyle yapılır.
6. **iOS:**
   - Kameradan okutulan QR Safari'de açılır; kurulu PWA'nın oturumu orada görünmez. Kurulu
     uygulamada "QR Okut" birincil yoldur. Safari'de oturum yoksa "Kâşif uygulamanı açıp QR
     Okut'a dokun" ipucu, "Burada devam et" ve "Kâşif kodum var" seçenekleri gösterilir.
   - **Safari 7 gün kuralı:** Ana ekrana eklenmemiş Safari'de siteyle 7 gün etkileşim olmazsa
     localStorage, IndexedDB ve önbellek silinir. Üyelik Supabase'de olduğu için kaybolmaz; çocuk
     Kâşif koduyla geri girer. İlk üyelikte `navigator.storage.persist()` istenir ve iOS'ta "Ana
     ekrana ekle" önerilir.

**KVKK notu:** Çocuğun takma adı ve etkinliği kişisel veridir.

- **İşleme dayanağı:** Açık rıza ekranı kullanıcı kararıyla yoktur. Dayanak (KVKK m.5/2, ör.
  kurumun eğitim hizmetinin ifası ya da meşru menfaati) **kurumun KVKK sorumlusunca** yazılı
  belirlenir ve ADR 0017'ye işlenir. Sorumlu açık rıza gerektiğine karar verirse, karşılamaya
  eğitmen onayı adımı eklenir (F5.2'de bayrakla hazır tutulur).
- **Aydınlatma yükümlülüğü (m.10)** rızadan bağımsızdır: `/aydinlatma` sayfası karşılamada ve
  profilde bağlantılıdır; metin KVKK sorumlusunca onaylanmadan canlıya çıkılmaz (F12 kapısı).
- **Yurt dışına aktarım (m.9):** Supabase (proje bölgesi panelden okunup ADR 0017'ye yazılır),
  GitHub Pages ve YouTube yurt dışındadır. Aktarım dayanağı (standart sözleşme ve Kurul'a bildirim)
  ile VERBİS durumu kurumca netleştirilir (F12 kapısı).
- Gemini'ye kişisel veri gönderilmez (§3.13).
- Veri minimizasyonu uygulanır; silme ve saklama süreleri otomatiktir.
- Admin dışında kimse kâşif düzeyindeki veriyi görmez; editör yalnızca toplamları görür.

### 3.13 Yapay zekâ mimarisi: Gemini API (ADR 0018)

> **Hukuk kapısı (F0.10).** Gemini API Ek Kullanım Koşulları (son güncelleme 2026-04-28):
> _"You must be 18 years of age or older to use the APIs. You also will not use the Services as
> part of a website, application, or other service (collectively, 'API Clients') that is directed
> towards or is likely to be accessed by individuals under the age of 18."_ Kâşif çocuklara
> yöneliktir ve Studio ile aynı uygulamada, aynı adreste durur. Yapay zekâyı yalnızca yetişkin
> personel kullansa da bu madde projeyi kapsayabilir. Bu yüzden:
>
> - F0.11 spike'ından önce kurumun hukuk birimi yazılı görüş verir (gerekirse Google'a sorulur).
> - Görüş olumsuzsa `AI_PROVIDER=off` olur: F9 kapsamdan çıkar (−6 gün) ve platform hazır
>   sahneler, görseller ve video URL'leriyle tam çalışır. AI katmanı sağlayıcıdan bağımsız olduğu
>   için ileride başka bir sağlayıcı (ücretli Gemini katmanı ya da Claude API) tek adapter'la
>   eklenebilir.

**Ücretsiz katman kuralları (Gemini API koşulları ve fiyat sayfası, 2026-09-24):**

- Ücretsiz katmanda gönderilen içerik ve yanıtlar Google ürünlerini geliştirmek için kullanılır ve
  insanlar tarafından incelenebilir. Bu yüzden istemlere **kişisel veri girmez**: yalnızca kart
  içeriği gönderilir (kâşif ya da personel adı yok). İstem alanlarında "Kişisel veri yazmayın"
  uyarısı vardır; sunucu e-posta, telefon ve T.C. kimlik no desenlerini reddeder.
- AB/EEA, İsviçre ve Birleşik Krallık'taki kullanıcılara sunulan API istemcilerinde yalnızca
  ücretli katman kullanılabilir. Studio kullanıcıları Türkiye'dedir; kapsam değişirse ücretli
  katmana geçilir.
- Kotalar API anahtarı başına değil **proje başınadır** ve model başına RPM/TPM/RPD olarak
  uygulanır. Sayılar AI Studio'da görünür ve değişebilir; uygulama kendi sınırını bunun altında
  tutar.
- Ücretsiz katmanda Pro modeller yoktur; Flash ve Flash-Lite modelleri ücretsizdir.

**Anahtar:** Kullanıcı Google AI Studio'da oluşturur ve kendisi girer:
`supabase secrets set GEMINI_API_KEY=…` ya da panel → Edge Functions → Secrets. Anahtar AI
Studio'da yalnızca Gemini API ile kısıtlanır ve hiçbir dosyaya ya da repoya yazılmaz.
**`VITE_GEMINI_API_KEY` kullanılmaz** (§3.7). Yerel geliştirme ve CI `AI_PROVIDER=fake` ile çalışır,
anahtar gerekmez.

**Kapsam (yalnızca Studio):**

| İş               | Girdi                                                                                   | Çıktı                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **AI animasyon** | Kart başlığı, cevap, blok türü, istenen durumlar (ör. `before/after`), serbest açıklama | Durum başına temizlenmiş SVG (+ `static`) + `title`/`desc`; `media_assets(kind:'ai-scene', scene_group)` |
| **AI ikon**      | Kavram ("tohum", "mıknatıs"), kart rengi                                                | ≤ 4 kB SVG ikon                                                                                          |
| **Kart metni**   | Konu, yaş aralığı, blok türü                                                            | Soru, cevap (kalın vurgular), anlatım, ipucu, kutlama; quiz/choose-correct/sequence/matching seçenekleri |
| **Kit taslağı**  | "8 yaş için fotosentez, 7 kart"                                                         | Kit taslağı: kartlar, önerilen blok türleri, sahne açıklamaları (sahneler kart başına ayrıca üretilir)   |

**`ai-generate` Edge Function:**

- **Sağlayıcıdan bağımsız katman:** `AiProvider` arayüzü (`generateScene`, `generateIcon`,
  `draftCardText`, `draftKit`); adapter'lar `gemini` ve `fake`. Seçim `AI_PROVIDER=gemini|fake|off`
  ile yapılır; `off` iken Studio'daki AI butonları hiç görünmez.
- **Model ve ayarlar:**
  - Model secret'larla verilir, kodda sabit model adı yoktur: `GEMINI_MODEL` (varsayılan
    `gemini-3.8-flash`, 2026-09-24 itibarıyla ücretsiz katmandaki en güncel kararlı Flash) ve
    metin/ikon için `GEMINI_MODEL_LIGHT` (varsayılan `gemini-3.1-flash-lite`). Gemini model adları
    hızlı değişir (2.5 ailesi yeni projelere kapandı); F0 spike'ında ve üç ayda bir kontrol edilir.
  - Thinking Gemini 3.x'te kapatılamaz; `thinking_level` `low|medium|high` ile ayarlanır
    (varsayılan `medium`). Sahne `medium`, ikon ve metin `low`; F0 spike'ında ölçülür.
  - Çıktı `application/json` + **JSON şeması** ile yapılandırılır (API şemanın bir alt kümesini
    destekler). Ayrı ve sade bir "AI çıktı şeması" (`z.toJSONSchema`) kullanılır, ardından tam Zod
    doğrulaması yapılır.
- **İstek ve akış:**
  - Resmî SDK `npm:@google/genai` ile akışlı çağrı yapılır (çağrı biçimi F0 spike'ında SDK
    sürümüyle doğrulanır). Tarayıcıya ilerleme olayları (SSE) gönderilir.
  - Uzun sistem istemi (stil rehberi, palet, SVG sözleşmesi, 2 örnek, çocuk güvenliği kuralları)
    her istekte aynı önek olarak gönderilir.
  - **120 sn'de** `AbortController` ile kesilir (Free: 150 sn sınırı).
  - Hata eşlemesi: sağlayıcı 429 (`RESOURCE_EXHAUSTED`) → "Bugünkü ücretsiz kota doldu" ve
    mümkünse `GEMINI_MODEL_LIGHT`'a düşülür; güvenlik filtresi engeli → "Bu istek üretilemedi,
    istemi değiştir"; zaman aşımı → "Tekrar dene".
- **Güvenlik ve yayın kuralları:**
  - SVG sunucuda katı izin listesiyle (öğe/öznitelik, `url(` / `@import` / `href` harici yok,
    `<script>`, `on*`, `foreignObject` yok) yeniden kurulur. Kâşif'te ve Studio önizlemesinde
    yalnızca `<img>` ile gösterilir.
  - Üretilen her şey **taslaktır**: alanlar `aiGenerated` olarak işaretlenir. Yayın öncesi "AI
    içeriğini bilimsel doğruluk açısından kontrol ettim" onayı zorunludur. Çocuklar yapay zekâya
    hiç erişmez; üretimi yalnızca personel (admin için aal2) yapabilir.
- **Kota kontrolü (ücretsiz katman, maliyet 0 USD):**
  - `ai_usage` tablosu istek, model, token ve durumu kaydeder.
  - `app_settings`: proje geneli günlük üretim sınırı (varsayılan: AI Studio'daki RPD'nin %80'i,
    F0.11'de girilir) ve kullanıcı başına günlük 20 üretim.
  - Varsayılan olarak **1 öneri** üretilir; "Farklı bir öneri" her seferinde kotadan düşer (öneri
    sayısı ayarı 1–3).
  - Kota dolunca buton kapanır; açıklama ve sıfırlanma zamanı gösterilir.
  - Ücretli katmana geçiş aynı anahtarla faturalandırma açılarak yapılır. O durumda içerik
    eğitimde kullanılmaz ve `app_settings.monthly_budget_usd` devreye girer.
- **Test:**
  - Mock ve CI'da gerçek API **çağrılmaz**. Mock `AiService` ve yerel yığındaki fonksiyon
    `AI_PROVIDER=fake` ile fixture döndürür.
  - Gerçek API yalnızca F0.11 spike'ında (kullanıcı onayıyla, anahtar yalnızca kullanıcının kabuk
    ortam değişkeninde), canlıda ve onaylı elle değerlendirmede kullanılır.

### 3.14 Video: yalnızca URL

Supabase'e video yüklenmez; trafik ve depo kotası video izlenmelerinden etkilenmez.

| Seçenek     | Nasıl                                                                                                                                                                                                                             | Not                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **YouTube** | Bağlantıdan (`youtube.com/watch`, `youtu.be`, `shorts`) `videoId` çıkarılır. Kâşif'te önce yerel yer tutucu (kart rengi + ▶ + başlık) gösterilir; **dokununca** `youtube-nocookie.com` iframe'i `sandbox` ve `rel=0` ile yüklenir | Önerilen. Tamamlanma "İzledim" butonuyla (IFrame API betiği CSP'ye takılır, yüklenmez)   |
| **MP4 URL** | Yalnızca `https:`; Studio'da `<video>` ile süre ve oynatılabilirlik kontrolü; CSP `media-src https:`                                                                                                                              | Trafik kaynağın sunucusundadır; kaynak kaldırılırsa kart "Video kullanılamıyor" gösterir |

- **Altyazı:** Admin "Videoda konuşma var mı?" sorusunu yanıtlar. Evetse MP4 için VTT dosyası
  (`media`'ya yüklenir), YouTube için "YouTube'da Türkçe altyazı var" onayı zorunludur (WCAG 1.2.2).
- Yayından önce bağlantılar kontrol edilir: YouTube için oEmbed gerekmez, `videoId` biçimi
  doğrulanır; MP4 için Studio'da oynatma denenir.
- YouTube üçüncü taraftır ve aydınlatma metninde yer alır.

---

## 4. E2E test mimarisi

### 4.1 İlke: aynı spec, iki arka uç, canlıya asla

| Katman           | Arka uç                                                                                                                | Nerede      | Kapsam                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| **Mock E2E**     | `vite build --mode e2e` (`BASE_PATH=/E-B-M-DIGITAL/`, `VITE_BACKEND=mock`, örnek içerik `__e2e__/published/`)          | Yerel + CI  | Kâşif, Studio, yolculuklar, a11y                                   |
| **Supabase E2E** | Aynı spec'ler; `VITE_BACKEND=supabase` → CI'da `supabase start` yerel yığın (Edge Functions dahil, `AI_PROVIDER=fake`) | Yalnızca CI | Studio, yolculuklar, çevrimdışı + yalnızca Supabase'e özgü olanlar |

- Build'ler **GitHub Pages benzeri** statik sunucuyla (`scripts/pages-server.mjs`) sunulur: SPA
  yeniden yazma yoktur, bilinmeyen yolda `404.html` 404 durumuyla döner.
- `baseURL` sonda `/` ile verilir, spec'ler göreli yol kullanır (`goto('kit/…')`).
- `.env.e2e` tüm Supabase değişkenlerini localhost'a sabitler. Vite yapılandırması `e2e` modunda
  canlı URL görürse build'i durdurur.

### 4.2 `backend` fixture'ı

| Yetenek                                            | mock                                                                     | supabase                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `seed(spec)`                                       | `addInitScript` + **tek seferlik** seed kimliği (yenileme veriyi silmez) | Node tarafında yerel yığına (varsayılan yerel anahtar dışında reddeder)                                                |
| Dönüş değeri                                       | Oluşan kimlikler, slug'lar, QR kodları (spec'ler sabit kod yazmaz)       | Aynısı                                                                                                                 |
| `exportState(page)` / `importState(context, dump)` | Studio bağlamından Kâşif (mobil) bağlamına durum aktarımı                | İşlem yapmaz (veri zaten paylaşılır)                                                                                   |
| `loginAs(role)`                                    | E2E build'ine özel oturum enjeksiyonu (`window.__KASIF_E2E__`)           | Node'da işçi ve rol başına bir kez alınan oturum aynı kancayla enjekte edilir; admin için sabit TOTP sırrı (`otpauth`) |
| `publish(kit)`                                     | Mock                                                                     | Admin oturumuyla `publish-kit`                                                                                         |

- UI ile giriş yalnızca `studio/auth*.spec.ts` içinde yapılır.
- Yerel GoTrue hız sınırları `config.toml`'da yükseltilir.
- Üretim bundle taraması şu işaretleri arar: `__KASIF_E2E__`, `__e2e__`, mock işareti,
  `sb_secret_`, `AIza[0-9A-Za-z_-]{35}` (Google API anahtarı), `sk-ant-`.

### 4.3 Playwright projeleri

| Proje                                                           | Klasör          | Cihaz                                                                                                                      | Nerede     |
| --------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `kids-desktop` / `kids-mobile` / `kids-tablet`                  | `e2e/kids/`     | Desktop Chrome · Pixel 7 · 820×1180 dokunmatik                                                                             | yerel + CI |
| `studio-desktop` / `studio-tablet`                              | `e2e/studio/`   | 1440×900 · 1024×1366 dokunmatik                                                                                            | yerel + CI |
| `journeys`                                                      | `e2e/journeys/` | Studio masaüstü + Kâşif mobil bağlamı                                                                                      | yerel + CI |
| `a11y`                                                          | `e2e/a11y/`     | Desktop, açık ve koyu                                                                                                      | yerel + CI |
| `studio-supabase`, `journeys-supabase`, `kids-offline-supabase` | aynı klasörler  | aynı                                                                                                                       | CI         |
| `coming-soon`, `coming-soon-mobile`                             | mevcut          | mevcut (+ Studio'nun coming-soon'da açık olduğu testi)                                                                     | yerel + CI |
| `smoke-prod`                                                    | `e2e/smoke/`    | canlı site, **salt okunur**; anonim giriş (`/auth/v1/signup`), `register_explorer` ve `record_events` route ile engellenir | gece       |

- Hangi web sunucularının kalkacağı env değişkeniyle seçilir (Playwright her `webServer`'ı başlatır).
- CI'da `workers:1` yerine sharding kullanılır; build bir kez alınır.
- **CI süre bütçesi:** PR hattı ≤ 20 dk. PR'da mock projelerin tamamı + Supabase'te yalnızca
  birleştirmeyi engelleyen yolculuklar ve `supabase/**` değiştiyse ilgili projeler koşar. Tam
  `*-supabase` matrisi `main`'de ve gece koşar.
- `e2e/a11y/` klasörü CLAUDE.md'deki "`e2e/a11y.spec.ts`'e ekle" kuralını değiştirir; kural ADR
  0014 ile güncellenir.

### 4.4 Test altyapısı ve kurallar

```
e2e/
  fixtures/   media/ (gerçek fotoğraf big.jpg ≈ 3 MB, test.png, fake.pdf, voice.mp3, clip.mp4 ≈ 2 MB + clip.vtt;
              clip.mp4 "MP4 URL" testleri için test sunucusundan verilir),
              qr/ (kamera için .y4m), content/ (bozuk JSON), ai/ (sahne/ikon fixture'ları, kötü niyetli SVG'ler)
  support/    test.ts (fixture'lar), backend/{mock,supabase}.ts, speech.ts, qr.ts (jsqr + pngjs),
              camera.ts (sahte kamera argümanları), pdf.ts (sayfa sayımı), clock.ts
  pages/      Page Object'ler (KidsWelcome, ScienceCenter, KitHome, Step, QrScan, StudioLogin, Dashboard,
              KitWizard, KitEditor, CardEditor, AiPanel, MediaLibrary, QrPage, Explorers, KitAnalytics …)
  kids/ studio/ journeys/ a11y/ smoke/
```

- Seçiciler önce rol, sonra etiket ve metin. `data-testid` yalnızca rolü olmayan sahne öğelerinde
  kullanılır.
- `waitForTimeout` yasak.
- `noPageErrors` her testte açıktır: `pageerror` **ve** `console.error` testi düşürür (izin
  listesiyle). Meta CSP F0.9'dan itibaren tüm e2e build'lerinde olduğu için CSP ihlalleri de
  böylece yakalanır.
- Service worker varsayılan olarak **kapalıdır** (`serviceWorkers:'block'`).
  - Yalnızca pwa, offline ve slow-network spec'lerinde açılır.
  - Bu spec'lerde `navigator.serviceWorker.controller` beklenir ve `context.route` kullanılır.
  - Yavaş ağ testlerinde gecikme yerine **askıda kalan** route kullanılır.
- Analitik E2E'de varsayılan olarak kapalıdır. Yalnızca olay testleri init script bayrağıyla açar
  (`navigator.webdriver`'a güvenilmez). `smoke-prod`, `record_events`'i engeller.
- İndirmeler anchor tabanlıdır. Yazdırma testlerinde `window.print` stub'lanır ve sayfa sayısı
  `page.pdf({preferCSSPageSize:true})` ile ölçülür.
- Uygulama içi QR okuyucu CI'da (Linux'ta `BarcodeDetector` yok) zxing-wasm polyfill'iyle ve
  sahte kamera (`--use-fake-device-for-media-stream --use-file-for-fake-video-capture=qr.y4m`)
  ile test edilir.
- Paylaşılan Supabase veritabanında sayı ve boş durum testleri `@mock-only` etiketlidir. CI yığını
  her koşuda yeniden kurulduğu için temizlik yapılmaz.
- Yeni spec'ler `--only-changed --repeat-each=5` ile kararlılık kontrolünden geçer. Birleştirmeyi
  engelleyen yolculuklarda `failOnFlakyTests` açıktır. CI'da `retries: 2` ve ilk tekrarda trace
  alınır.

### 4.5 Birim testi ortamı

- `src/test/setup.ts`'e F1'de eklenir: `fake-indexeddb`, `ResizeObserver` / `matchMedia`
  polyfill'leri, sahte `speechSynthesis` yardımcısı.
- jsdom'da canvas yoktur. Bu yüzden QR matrisi, etiket satır kırma (enjekte edilen ölçüm
  fonksiyonu) ve küçültme boyut hesabı **saf** birim testlerle; PNG ve WebP işleme E2E'de test
  edilir.
- Sürükle-bırak birim testte test edilmez. Onun yerine "Yukarı/Aşağı taşı" butonları ve
  `Alt+↑/↓` test edilir; asıl sürükleme E2E'dedir.
- Ayrı **`contract-supabase` Vitest projesi**: `environment:'node'`, MSW yok,
  `fileParallelism:false`, localhost koruması, rol başına istemci, test başına önek.

### 4.6 CI hattı

```
push / PR
  ├─ quality            typecheck · lint · boundaries · format · unit + contract(mock) · coverage
  │                     build (üretim, meta CSP) + bundle taraması (AIza, sk-ant-, sb_secret_ …)
  │                     · sync:edge-schema farkı · workflow güvenlik taraması
  ├─ e2e-mock           kids-* · studio-* · journeys · a11y · coming-soon (sharded)       (needs: quality)
  ├─ supabase-rehearsal supabase start -x studio,imgproxy,realtime,logflare,vector,supavisor,mailpit
  │                     → db reset ×2 → db lint → supabase test db (pgTAP) → contract(supabase)
  │                     → build(supabase, CSP'de 127.0.0.1:54321) → *-supabase projeleri
  │                       (PR: yolculuklar; main + gece: tam matris)
  ├─ edge-functions     deno test (supabase/** değişince; AI_PROVIDER=fake)
  └─ audit              npm audit
main + hepsi yeşil + canlı schema_version() kapısı → Deploy (GitHub Pages; dist yeniden taranır)
workflow_dispatch     db-backup · db-restore-drill · db-migrate · functions-deploy · bootstrap-admin
                      · admin-mfa-reset   (Environment: production/backup; session pooler bağlantısı)
cron                  keep-alive (3 gün) · db-backup (haftalık, backup Environment) · smoke-prod (gece)
                      · quota-check (gece: DB/depo/MAU %70/%85 → GitHub issue) · supabase tam matris (gece)
```

- Actions commit SHA'sına sabitlenir.
- `SUPABASE_ACCESS_TOKEN` yalnızca bu projeye erişen ayrı bir Supabase hesabına aittir.
- `GEMINI_API_KEY` GitHub'da hiç tutulmaz; yalnızca Supabase Edge Function secret'ıdır.

---

## 5. Karar kayıtları (ADR)

| ADR  | Başlık                                                                                                                                                              | Faz |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 0004 | UI bileşen stratejisi → **kabul:** Studio'da shadcn/Radix; Kâşif'te kendi primitiflerimiz                                                                           | F0  |
| 0006 | `entities` katmanı ve saf modül kuralı                                                                                                                              | F0  |
| 0007 | İçerik modeli: 13 blok, görsel alan, sahne kütüphanesi + AI sahneleri, anlık görüntü yayını                                                                         | F0  |
| 0008 | Animasyon: CSS + WAAPI, azaltılmış hareket zorunlu                                                                                                                  | F0  |
| 0009 | Kâşif üyeliği: Supabase'de profil/ilerleme/rozet, cihaz↔üye bağlama, Kâşif kodu, merkez cihazı                                                                      | F0  |
| 0011 | Supabase Free, tek ortam; personel oturumu `sessionStorage`; admin 2FA, en az 2 admin, acil sıfırlama                                                               | F0  |
| 0013 | Barındırma: GitHub Pages, ortak köken güven varsayımı, meta CSP (`style-src 'unsafe-inline'`, `'wasm-unsafe-eval'`, tek kaynak), QR `?q=`, özel alan adı geçiş yolu | F0  |
| 0014 | E2E stratejisi: aynı spec iki arka uç; canlıya test yok; a11y klasörü; CI süre bütçesi                                                                              | F0  |
| 0015 | Veri erişimi: port/adapter, mock arka uç, sözleşme testleri                                                                                                         | F0  |
| 0016 | Tek ortam veritabanı değişiklik protokolü (session pooler bağlantısı)                                                                                               | F0  |
| 0017 | Kâşif kimliği ve KVKK: anonim cihaz oturumu (localStorage istisnası), rıza ekranı yok, işleme dayanağı, aydınlatma, yurt dışı aktarım, saklama                      | F0  |
| 0018 | Yapay zekâ: Gemini API ücretsiz katman, sağlayıcıdan bağımsız `AiProvider`, 18 yaş maddesi hukuk kapısı, taslak-onay, kota, SVG temizleme + `<img>`                 | F0  |
| 0020 | Medya ve trafik bütçesi: boyut sınırları, video yalnızca URL, trafik formülü, B planı (Pages)                                                                       | F0  |
| 0012 | Analitik: olay modeli, artımlı toplama, saklama, tekil sayımlar, kâşif düzeyi görünürlük                                                                            | F4  |
| 0019 | Sürüm uyumluluğu ve deploy sırası: `schema_version` kapısı, RPC sürümleme, `minAppVersion`, SW güncelleme politikası, yayın kiralaması                              | F4  |
| 0010 | Studio kütüphaneleri: React Hook Form + Zod; sıralama `@dnd-kit`; komut paleti `cmdk`; grafik kütüphanesi                                                           | F6  |

---

## 6. Fazlar

**Her adımın döngüsü:** plan → uygulama → birim testleri → E2E spec'i → `npm run validate` →
gözden geçirme → commit. Adım numarası (ör. F5.7) commit gövdesine yazılır.

**Premium kalite kapısı (arayüz içeren her faz)**

- `ui-designer` ekran görüntüsü turu: 375, 390, 414, 768, 1024 ve 1440 px; açık ve koyu tema
- Dört durum da tasarlanmış: iskelet ile yükleme, boş (maskotlu), hata + "Tekrar dene", başarı
- Hareket 150–250 ms, kit teması "hareket seviyesi" ve azaltılmış hareket tercihine uyar; CLS < 0.1
- Klavyeyle tam kullanım, görünür odak, axe temiz, Türkçe ve cümle düzeninde metinler
  (`lang="tr"`, İ/ı büyük-küçük harf dönüşümleri doğru)
- Yalnızca semantik token'lar, `dark:` yok; dokunma hedefleri Kâşif'te ≥ 56 px, Studio'da ≥ 44 px

**Onay gerektiren adımlar:** push, PR, secret veya repo değişkeni ekleme, canlı Supabase'e dokunan
her workflow, gerçek Gemini API çağrısı yapan her iş (spike, değerlendirme), lansman.

---

### F0 — Hazırlık, kararlar, marka, altyapı, hukuk kapısı ve spike'lar (6 gün)

| Adım  | İş                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Dosyalar                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| F0.1  | ADR 0004, 0006, 0007, 0008, 0009, 0011, 0013, 0014, 0015, 0016, 0017, 0018, 0020                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `docs/adr/`                                                                    |
| F0.2  | `entities` katmanı (boundaries script'i); `ARCHITECTURE.md`; `CLAUDE.md`: mimari, veri kuralı, a11y klasörü, yeni komutlar, **"canlı Supabase'e ve gerçek AI API'sine testte dokunma"** kuralı, **CSP'nin yeni yeri** (`csp.config.ts` → meta + nginx), "token localStorage'da olmaz" kuralına Kâşif anonim oturumu istisnası (ADR 0017), **`GEMINI_API_KEY` yalnızca Edge Function secret'ı**                                                                                                                                                                | `scripts/check-boundaries.mjs`, docs                                           |
| F0.3  | Marka brief'i: Kâşif / Kâşif Studio, sözlük (§0.1), maskot, logodan palet (çivit `#3B3486`/`#6C63FF`, turkuaz `#2BE0C8`, sarı `#FFD653`, turuncu `#FFB13D`, filiz yeşili `#6BC96F`), ses tonu                                                                                                                                                                                                                                                                                                                                                                 | `docs/DESIGN_SYSTEM.md`                                                        |
| F0.4  | Marka varlıkları (§2.2); manifest: `id` ve `start_url` = BASE_PATH, `scope`, `name`/`short_name` "Kâşif", `lang: tr`, `categories`, renkler                                                                                                                                                                                                                                                                                                                                                                                                                   | `public/`, `pwa-assets.config.ts`, `vite.config.ts`                            |
| F0.5  | Env (`add-env-var` skill): `VITE_BACKEND`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (secret/`service_role` red), `VITE_CONTENT_BASE_URL`, `VITE_PUBLIC_SITE_URL` (varsayılan canlı adres), `VITE_STUDIO_ENABLED`; `.env.e2e` (localhost, commit edilir); e2e modunda canlı URL koruması. Env şeması `VITE_` önekli `*_API_KEY`/`*_SECRET` değişkenlerini (ör. `VITE_GEMINI_API_KEY`) reddeder                                                                                                                                                     | `env.schema.ts`, `vite-env.d.ts`, `.env.example`, `.env.e2e`, `vite.config.ts` |
| F0.6  | `npx supabase init`; `config.toml` (kayıt kapalı, anonim giriş açık, yerel hız sınırları yüksek, JWT 1800 sn, yerel site URL localhost); `supabase/functions/.env.example` (`AI_PROVIDER=fake`, `GEMINI_MODEL`, `GEMINI_MODEL_LIGHT`; anahtar satırı boş)                                                                                                                                                                                                                                                                                                     | `supabase/`                                                                    |
| F0.7  | E2E altyapısı (§4): projeler, `pages-server.mjs`, e2e build modu (base path + örnek içerik), fixture iskeletleri, `noPageErrors`, localhost korumaları; `jsqr`, `pngjs`, `otpauth`, `fake-indexeddb` geliştirme bağımlılıkları                                                                                                                                                                                                                                                                                                                                | `playwright.config.ts`, `e2e/`, `scripts/`                                     |
| F0.8  | CI işleri iskeleti (§4.6), workflow güvenlik taraması (`--linked` + reset/test/seed yasağı), bundle tarama script'i (`AIza…`, `sk-ant-`, `sb_secret_`, E2E kancaları)                                                                                                                                                                                                                                                                                                                                                                                         | `.github/workflows/`, `scripts/`                                               |
| F0.9  | **Meta CSP** (§3.7): `csp.config.ts` → build eklentisi `<head>`'in ilk öğesi olarak yazar ve `docker/nginx/security-headers.conf`'u üretir; coming-soon satır içi `style`'ı sınıfa taşınır; tüm e2e build'leri CSP'li                                                                                                                                                                                                                                                                                                                                         | `csp.config.ts`, `vite.config.ts`, `docker/`                                   |
| F0.10 | **Hukuk ve KVKK ön kontrolü** (kurum; teknik taslakları biz hazırlarız): Gemini koşullarındaki 18 yaş maddesi için yazılı görüş; KVKK işleme dayanağı (rıza ekranı yok); yurt dışı aktarım ve VERBİS; Supabase proje bölgesinin kaydı. Olumsuz AI görüşünde `AI_PROVIDER=off` ve F9 düşer                                                                                                                                                                                                                                                                     | `docs/legal/` (görüş özetleri), ADR 0017/0018                                  |
| F0.11 | **Spike 1 · AI sahne (Gemini)** (F0.10 olumluysa; onaylı, gerçek API; kullanıcı `GEMINI_API_KEY`'i yalnızca kendi kabuğunda ortam değişkeni olarak verir, dosyaya yazılmaz): 10 örnek kart için durum başına SVG. Ölçülenler: p50/p95 süre (< 120 sn), SVG boyutu (≤ 12 kB/durum), temizleme sonrası görsel kalite, durum sözleşmesine uyum, `thinking_level` etkisi, `gemini-3.8-flash` ile `gemini-3.1-flash-lite` karşılaştırması, AI Studio'daki RPM/RPD ve günde kaç sahne üretilebildiği, `@google/genai` çağrı biçimi. **Git/Gitme kararı** ADR 0018'e | `scripts/spikes/ai-scene.mjs`, `docs/spikes/ai-scene.md`                       |
| F0.12 | **Spike 2 · QR okuyucu:** BarcodeDetector + self-host zxing-wasm, **üretim CSP'si altında** (`'wasm-unsafe-eval'`); iPhone Safari, Android Chrome, kurulu PWA; basılı 40 mm QR ile okuma mesafesi ve ışık koşulları; Kâşif kartı QR'ı (`KASIF:<kod>`)                                                                                                                                                                                                                                                                                                         | `docs/spikes/qr-scan.md`                                                       |

**Birim testleri:**

- `env.test.ts`:
  - Üretimde `VITE_BACKEND=mock` build'i kırar.
  - `sb_secret_` ve `service_role` JWT reddedilir.
  - `VITE_GEMINI_API_KEY` (ve `VITE_*_API_KEY`) tanımlıysa build kırılır.
  - `e2e` modunda canlı URL reddedilir.
  - URL normalizasyonu doğru çalışır.
- Boundaries fixture testi.
- Bundle tarama script'inin kendi testi: `AIza…` ve diğer işaretli desenler yakalanır.
- `csp.config.ts`: meta ve nginx çıktısı aynı yönergeleri içerir.

**E2E:**

- `smoke/infra.spec.ts`: Base path altında açılır; bilinmeyen yol 404 + SPA; `backend.seed()`
  çalışır; CI'da `ping` yanıt verir.
- `smoke/csp.spec.ts`: Meta CSP `<head>`'in ilk öğesi; yönergeler beklenen listeyle aynı;
  vitrin ve coming-soon sayfasında CSP ihlali yok.
- `kids/pwa-manifest.spec.ts`: Manifest alanları, 4 ikon, maskable ikonlar.

**Kabul:**

- CI işlerinin hepsi yeşil; meta CSP tüm e2e build'lerinde etkin.
- Hukuk görüşleri alındı (F0.10). Gemini için görüş olumsuzsa `AI_PROVIDER=off` kararı ADR 0018'e
  yazıldı ve F9 plandan çıkarıldı.
- İki spike raporu yazıldı. AI için "git" kararı verildi; kalite ya da kota yetersizse F9 yalnızca
  metin ve ikon üretimiyle daraltılır.

---

### F1 — Tasarım sistemi: Kâşif ve Studio (5 gün)

**Amaç:** İki görsel dil kurmak:

- **Kâşif:** Logodaki gece-uzay çividi ile turkuaz/sarı vurgular, maskotlu. E-B-M sıcaklığında
  oyunsu ama rafine.
- **Studio:** Linear/Vercel düzeyinde sakin bir yönetim arayüzü.

`ui-designer` ajanı ve `premium-ui` + `frontend-design` skill'leriyle yapılır.

| Adım  | İş                                                                                                                                                                                                                                                                                     | Dosyalar                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| F1.1  | Fontlar (self-host, **latin + latin-ext** alt kümeleri: ş, ğ, ı, İ): Kâşif için Fredoka Variable ("oyunsu"), sistem ("standart"); Studio için Bricolage (başlık) + sistem                                                                                                              | `package.json`, `global.css` |
| F1.2  | Kâşif token'ları: marka paleti, zemin (gündüz gökyüzü / gece uzayı), kart, metin, 8 kart rengi (AA), 5 kit teması + vurgu rengi değişkeni (`[data-kit-theme]`), hareket seviyesi değişkenleri, sahne paleti, `--radius-kid`                                                            | `src/app/styles/kids.css`    |
| F1.3  | Studio token'ları: marka (çivit), `success`/`warning`/`info` açık-koyu çiftleri, durum rozetleri, grafik paleti (`dataviz` skill'i)                                                                                                                                                    | `global.css`                 |
| F1.4  | Studio primitifleri (shadcn/Radix): Button, IconButton, Input, Textarea, Select, Combobox, Checkbox, Switch, RadioGroup, Field, Dialog, AlertDialog, Sheet, DropdownMenu, Tabs, Tooltip, Toast (Sonner), Badge, Card, Skeleton, EmptyState, Table, Pagination, Kbd, StatTile, Progress | `src/shared/ui/`             |
| F1.5  | Kâşif primitifleri: KidButton (56–72 px), KidIconButton, KidInput (büyük, tek alan), AvatarPicker, SpeakButton, SpeechBubble, HintText, StepChip, ProgressRing, Celebration + `useCelebrate`, **MotionToggle** (Durdur/Oynat, WCAG 2.2.2), **Mascot** (pozlar)                         | `src/shared/ui/kid/`         |
| F1.6  | `useSpeech` (R3–R4) + genel sessiz ayarı desteği                                                                                                                                                                                                                                       | `src/shared/hooks/`          |
| F1.7  | `RichText`, `slugifyTr` (İ/ı dönüşümleri), `contrast`                                                                                                                                                                                                                                  | `src/shared/lib/`            |
| F1.8  | `KidsLayout` (güvenli alan, yıldız/bulut dekoru, üstte profil avatarı + ses + ayarlar, odak `h1`'e) ve `StudioLayout` (kenar çubuğu: Pano, Kâşif Kitleri, Kâşifler, Analitik, Medya, Kullanıcılar, Ayarlar; üst bar; mobilde Sheet; "içeriğe atla"; iframe koruması)                   | `src/app/layouts/`           |
| F1.9  | Tasarım sistemi vitrini `/_tasarim` (yalnızca development ve e2e build'lerinde)                                                                                                                                                                                                        | `src/pages/design-system/`   |
| F1.10 | Test kurulumu: `fake-indexeddb`, `ResizeObserver` polyfill'i, sahte ses motoru yardımcısı                                                                                                                                                                                              | `src/test/`                  |

**Birim testleri:**

- Her primitif için davranış testi.
- `useSpeech`: tüm dallar ve genel sessiz ayarı.
- `Celebration`: `aria-live`, azaltılmış hareket, DOM temizliği.
- `RichText`: HTML metin olarak kalır.
- `slugifyTr`: "IŞIK" → `isik`, "İnsan" → `insan`.
- `kids-tokens.test.ts`: tüm kart renkleri ve temalar için kontrast ≥ 4.5.

**E2E**

| Spec                             | Senaryo                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `a11y/design-system.spec.ts`     | Vitrin açık ve koyu temada axe temiz                                            |
| `kids/design-system-kbd.spec.ts` | Dialog odak tuzağı ve ESC, menü ok tuşları, Tabs, Toast                         |
| `kids/speech.spec.ts`            | "Dinle → Dur"; motor yokken "🔇 Ses yok"; genel sessiz açıkken buton devre dışı |
| `kids/reduced-motion.spec.ts`    | Azaltılmış harekette konfeti yok, mesaj duyurulur                               |
| `studio/iframe-guard.spec.ts`    | Studio bir iframe içinde yüklenince içerik render edilmez                       |

---

### F2 — İçerik modeli, olay şemaları ve örnek kitler (4 gün)

| Adım | İş                                                                                                                                                                                                                                 | Dosyalar                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| F2.1 | Temel şemalar: slug, kart slug'ı (rezerve `tamamlandi`), emoji, icon, visual (AI sahnesi durum listesi, video URL + altyazı kuralı), media ref, rich text, material, badge, theme (vurgu rengi kontrast doğrulamalı), `qrSequence` | `src/entities/kit/model/`        |
| F2.2 | 13 blok şeması + `stepSchema`; blok başına zorunlu alanlar                                                                                                                                                                         | `src/entities/kit/model/blocks/` |
| F2.3 | Sahne kataloğu, bilim ikon kataloğu (kimlik + etiket), `kitDocumentSchema`, `catalogSchema`, `qrIndexSchema`                                                                                                                       | `src/entities/kit/model/`        |
| F2.4 | `blockCatalog` (+ AI sahnesi durum sözleşmesi), `createDefaultStep`, `migrateKit`, Türkçe hata mesajları (`z.config(z.locales.tr())` + alan etiketleri)                                                                            | `src/entities/kit/model/`        |
| F2.5 | Yardımcılar: `getStepBySlug`, `getAdjacentSteps`, `requiredStepIds`, `resolveQrCode`, `nextQrCode(kit)` (`qrSequence`'tan), `parseVideoUrl`, `parseExplorerCardQr`                                                                 | `src/entities/kit/lib/`          |
| F2.6 | **Olay şemaları** (`activity` entity): tür listesi, olay yükleri, toplu gönderim şeması, sınırlar                                                                                                                                  | `src/entities/activity/`         |
| F2.7 | Şablonlar (6)                                                                                                                                                                                                                      | `src/entities/kit/templates/`    |
| F2.8 | Örnekler: `kucuk-ciftciler.json` (7 kart) ve `blok-vitrini.json` (13 blok)                                                                                                                                                         | `content/samples/`               |
| F2.9 | Fabrikalar: `buildKit()`, `buildStep(type, overrides)`, `buildEvent(type)`                                                                                                                                                         | `src/test/fixtures/`             |

**Birim testleri:**

- Her blok ve görsel türü: geçerli örnek geçer; sınırlar ve eksik alanlar reddedilir; hata yolu
  doğrudur.
- Yinelenen `id`, `slug` ve `qrCode` reddedilir.
- AI sahnesinin durum listesi blok sözleşmesini karşılamazsa ya da `static` durumu yoksa
  reddedilir.
- Vurgu rengi kontrastı düşükse reddedilir.
- `tamamlandi` kart slug'ı reddedilir.
- Video: `https:` olmayan URL, tanınmayan YouTube bağlantısı ve `hasSpeech: true` iken altyazısız
  video reddedilir; `youtu.be`, `watch?v=`, `shorts/` biçimleri `videoId`'ye çözülür.
- `nextQrCode` silinmiş numarayı yeniden kullanmaz (`qrSequence` hiç azalmaz); `KC-99`'dan sonra
  `KC-100` gelir.
- `resolveQrCode` tüm dalları kapsar.
- Olay şemalarında kişisel alan yoktur (anahtar listesi testi).
- İçerik sözleşme testi: örnekler ve şablonlar şemadan geçer.
- Kapsam: `entities/**` için klasör bazlı branch eşiği ≥ %90.

**E2E:** Yok (saf katman).

---

### F3 — Veri erişim katmanı, mock arka uç ve Studio girişi (5 gün)

| Adım | İş                                                                                                                                                                                                                                                                  | Dosyalar                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| F3.1 | `mock-db` (enjekte edilen depolama, IndexedDB blob deposu, gecikme = 0 + "bekle" kancası, hata enjeksiyonu, sıfırlama)                                                                                                                                              | `src/shared/api/`                  |
| F3.2 | `supabase.ts`: iki lazy istemci. `staffClient` (`persistSession:true`, `storage: sessionStorage`, `storageKey:'kasif:auth:staff'`), `kidsClient` (kalıcı, `localStorage`, `storageKey:'kasif:auth:kid'`). `createHttpClient` + `contentClient`                      | `src/shared/api/`                  |
| F3.3 | Port tipleri (§3.8), adapter seçimi (`api/index.ts`)                                                                                                                                                                                                                | `src/features/*/api/`              |
| F3.4 | **Tüm port'ların mock adapter'ları**                                                                                                                                                                                                                                | `src/features/*/api/*.mock.ts`     |
| F3.5 | **Sözleşme test paketleri** (`*.contract.ts`); bu fazda mock'a karşı                                                                                                                                                                                                | `src/features/*/api/*.contract.ts` |
| F3.6 | `features/auth`: `useSession`, `RequireRole` (loader guard; `donus` regex doğrulaması), MFA: kayıt (QR + kurtarma uyarısı) ve doğrulama, `ChangePasswordForm`, oturum düşünce yerel yedekle geri dönüş, çıkışta Query önbelleği ve taslak yedeklerinin temizlenmesi | `src/features/auth/`               |
| F3.7 | `LoginPage`, `MfaPage`, ilk girişte parola değiştirme; mock modda "Deneme ortamı" bandı, canlıya bağlıyken kırmızı "CANLI ORTAM" bandı                                                                                                                              | `src/pages/studio/`                |
| F3.8 | `user-admin` + `UsersPage`: liste, "Kullanıcı ekle" (geçici parola bir kez gösterilir), "Parolayı sıfırla", rol, pasifleştir (son admin koruması; açıklamalı hata); aktif admin sayısı 2'nin altındaysa uyarı bandı                                                 | `src/features/user-admin/`, pages  |
| F3.9 | E2E: mock `backend` fixture'ı, oturum enjeksiyon kancası (yalnızca e2e modu)                                                                                                                                                                                        | `e2e/support/`, `src/app/`         |

**Birim testleri:**

- Sözleşme paketleri mock'a karşı çalışır.
- Guard: yönlendirme; `donus=//evil.com` ve `donus=https://…` reddedilir; yanlış rolde 403;
  `must_change_password` iken Studio kapalı; admin `aal1` iken 2FA'ya yönlenir.
- Personel oturumu localStorage'a yazılmaz; yalnızca `sessionStorage`'daki
  `kasif:auth:staff` anahtarındadır. Çocuk oturumu yalnızca `kasif:auth:kid` anahtarına yazılır.
- Son admin korunur.

**E2E (mock; F4'ten sonra Supabase'te de)**

| Spec                            | Senaryo                                                                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studio/auth.spec.ts`           | Doğru giriş → 2FA → pano; yanlış parola → hata, alan odakta; yanlış TOTP; oturumsuz derin bağlantı → giriş → geri dönüş; `?donus=//evil.com` → pano; **yenilemede oturum korunur, yeni sekmede giriş istenir**; çıkış |
| `studio/first-login.spec.ts`    | Admin kullanıcı oluşturur → geçici parolayla giriş → parola değiştirme zorunlu → pano                                                                                                                                 |
| `studio/users.spec.ts`          | Rol değişikliği; parola sıfırlama; pasifleştirilen kullanıcı oturum açıkken bir sonraki işlemde düşer; editör `/studio/kullanicilar`'da 403; son admin pasifleştirilemez                                              |
| `studio/session-expiry.spec.ts` | Düzenleme sırasında oturum düşer → yeniden giriş → yerel yedekten geri yükleme önerilir                                                                                                                               |
| `a11y/studio-auth.spec.ts`      | Giriş, 2FA, parola değiştirme, kullanıcılar                                                                                                                                                                           |

---

### F4 — Supabase: şema tasarımı ve prova · 3 kez planla (14 gün)

> Bu fazda canlı Supabase'e **hiçbir şey uygulanmaz**. Çıktı, CI'da kanıtlanmış bir migration setidir.

| Adım  | Tur    | İş                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Dosyalar                                               |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| F4.1  | Plan 1 | Şema dokümanı (§3.9 eksiksiz): tablolar, kısıtlar, indeksler (ör. `explorer_events (kit_id, occurred_at)`, `(explorer_id, occurred_at)`), FK silme davranışları, GRANT matrisi, RLS, RPC imzaları, Storage kuralları, Edge Function sözleşmeleri, pg_cron işleri; **boyut ve trafik formülleri** (`capacity.md`); ADR 0012 ve 0019                                                                                                                                                        | `docs/database/schema.md`, `docs/database/capacity.md` |
| F4.2  | Plan 2 | Sorgu kataloğu (§3.8'deki her metot) + güvenlik kontrol listesi: RLS her tabloda; anon yetkileri geri alınmış; kolon bazlı GRANT; `private` şeması; `search_path=''`; **anonim (`is_anonymous`) JWT'nin `authenticated`'a verilen her yetkiye karşı denenmesi**; aal2 politikaları; son admin; slug/önek kilidi ve `rename_kit`; değişmezlik tetikleyicileri; yayın kiralaması; Kâşif kodu kaba kuvvet sınırı; `report_client_error` oturum zorunluluğu; audit hacmi. **Kullanıcı onayı** | `docs/database/query-catalog.md`                       |
| F4.3  | Plan 3 | Migration'lar: `0001_types_tables`, `0002_constraints_indexes`, `0003_grants_rls`, `0004_private_helpers_rpc`, `0005_explorer_rpc` (üyelik, Kâşif kodu, merkez cihazı), `0006_activity_rpc`, `0007_publishing_rpc` (kiralama, sürüm ayırma, `rename_kit`, `withdraw_review`), `0008_settings_ratelimit`, `0009_audit_triggers`, `0010_cron`, `0011_storage`                                                                                                                               | `supabase/migrations/`                                 |
| F4.4  | Plan 3 | `seed.ci.sql` (yalnızca yerel: admin + editor, sabit TOTP sırrı)                                                                                                                                                                                                                                                                                                                                                                                                                          | `supabase/`                                            |
| F4.5  | Plan 3 | pgTAP (aşağıda)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `supabase/tests/`                                      |
| F4.6  | Plan 3 | Edge Functions: `publish-kit` (kiralama + sürüm saga'sı), `admin-users`, `ai-generate` (`AiProvider`: `fake` + `gemini` adapter iskeleti, `AI_PROVIDER=fake\|gemini\|off`), paylaşılan: yetki kontrolü, CORS (canlıda yalnızca canlı köken), `svg-sanitize`, PII deseni filtresi, `kit-model` (`sync:edge-schema`); `deno test`                                                                                                                                                           | `supabase/functions/`                                  |
| F4.7  | Plan 3 | **Tüm port'ların Supabase adapter'ları**; `contract-supabase` Vitest projesi                                                                                                                                                                                                                                                                                                                                                                                                              | `src/features/*/api/*.supabase.ts`, `vitest.*`         |
| F4.8  | Plan 3 | E2E `backend` fixture'ının Supabase implementasyonu; F3 spec'leri `studio-supabase`'de                                                                                                                                                                                                                                                                                                                                                                                                    | `e2e/support/backend/supabase.ts`                      |
| F4.9  | Plan 3 | Kâşif akışı: `kidsClient.signInAnonymously`, `register_explorer`, `restore_explorer`, `activate_center_device`, `record_events` sözleşme testleri                                                                                                                                                                                                                                                                                                                                         | aynı                                                   |
| F4.10 | Plan 3 | Performans provası: 200 bin sentetik olay + 10 bin anonim kullanıcıyla analitik RPC'lerinin süresi (< 500 ms), tablo ve **auth şeması** boyutu → boyut formülünün (≈ 400 B/olay) doğrulanması                                                                                                                                                                                                                                                                                             | `supabase/tests/perf/`                                 |
| F4.11 | —      | Workflow'lar (henüz canlıya karşı çalıştırılmaz; hepsi **session pooler** bağlantısıyla): `db-backup` (`age` ile şifreli, 7 gün, medya artımlı), `db-restore-drill` (yalnızca `workflow_dispatch`, satır yazdırmaz), `db-migrate` (dry-run → onay → push → diff/lint), `functions-deploy`, `bootstrap-admin` (admin yoksa çalışır, tek kullanımlık), `admin-mfa-reset` (onaylı, acil durum), `quota-check` (gece); `deploy.yml`'a `schema_version()` kapısı                               | `.github/workflows/`                                   |

**pgTAP (CI):**

- **Anonim cihaz:**
  - Yalnızca `ping`, `schema_version`, Kâşif RPC'leri ve `record_events` çalışır; yalnızca kendi
    bağlı üyelerinin profil, ilerleme ve rozetlerini okuyabilir; başka hiçbir tabloyu okuyamaz.
  - `authenticated`'a verilen personel yetkilerinin hiçbirini kullanamaz (`is_anonymous` JWT).
  - Başka cihaza bağlı üyeye olay yazamaz.
  - Bilinmeyen kart kimliği ve 8 günlük olay reddedilir; `occurred_at` gelecekteyse sınırlanır.
  - Dakikada 121. olay reddedilir.
  - Kişisel cihazda 11. üye reddedilir; merkez cihazında sınır yoktur.
  - `restore_explorer`: doğru kod üyeyi bağlar; 5 hatalı denemeden sonra doğru kod da 15 dk
    reddedilir.
  - `report_client_error` oturumsuz çağrılamaz.
- **Editör:**
  - `kits.status/visibility/slug` kolonlarını güncelleyemez; yayınlanmış ya da `in_review`
    durumundaki kitin taslağını güncelleyemez.
  - `explorers` ve `explorer_events`'i okuyamaz.
  - `kit_versions` ve `qr_codes`'a yazamaz.
  - `rename_kit` yayınlanmış kitte reddedilir.
- **Admin:**
  - `aal1` iken yönetim işlemleri reddedilir.
  - Yayınlanmış kit silinemez.
  - Son admin pasifleştirilemez.
- **Değişmezlik:** `kit_versions` update/delete reddedilir (yalnızca `finalized_at` bir kez
  yazılır); `qr_codes` silinemez.
- **Toplama:** 6 gün önce gerçekleşmiş, bugün gelen olay doğru güne eklenir; gün sınırı
  Europe/Istanbul'a göredir (UTC 21:30 olayı ertesi güne düşer); kit düzeyi olay (`step_id = ''`)
  PK hatası vermez; `is_preview` olaylar ve `is_test` kitler toplamlara girmez.
- **Storage:** `published` bucket'a istemciden yazılamaz; `media`'da `image/svg+xml`,
  `text/html`, `video/*` ve boyut aşımı reddedilir; anonim kullanıcı dosya listeleyemez.
- **GRANT listesi:** Beklenen yetki listesi bire bir karşılaştırılır.

**Edge Function testleri:**

- Token yok, anon key ya da süresi dolmuş token → 401.
- Editör yayın → 403. Eski `lock_version` → 409. İncelenenden farklı `lock_version` → 409.
  Geçersiz taslak → 422.
- **İki eşzamanlı yayının ikisi de katalogda görünür** (kiralama + nesil sayacı).
- **Yarıda kalan yayın:** `v{n}.json` yazıldıktan sonra süreç kesilir → aynı çağrı tekrarlanınca
  yayın tamamlanır, dosya çakışması hata vermez.
- `unlisted` kit katalogda yoktur ama `qr-index`'tedir.
- Arşiv, katalog ve `qr-index`'i günceller. `regenerate` Storage'ı DB'den yeniden kurar.
- `ai-generate` (`AI_PROVIDER=fake`):
  - Uygulama günlük kotası aşımı → 429 (açıklamalı); sağlayıcı kota hatası → hafif modele düşme,
    o da doluysa 429; güvenlik filtresi engeli → 422; `AI_PROVIDER=off` → 404.
  - İstemde e-posta, telefon ya da T.C. kimlik no deseni → 422.
  - Kötü niyetli SVG fixture'ları temizlenir ya da reddedilir: `script`, `onload`,
    `javascript:`, harici `use`, CSS `url()`/`@import`, `foreignObject`, 12 kB üstü.
  - 120 sn'de kesilme.

**Kabul:**

- Plan 1 ve Plan 2 dokümanları onaylandı; ADR 0012 ve 0019 yazıldı.
- Boyut ve trafik formülleri Free sınırlarının %70'inin altında; değilse B planı (ADR 0020)
  kararlaştırıldı.
- Supabase provası CI'da yeşil: pgTAP, sözleşme, fonksiyon, performans, E2E.
- Migration'lar hâlâ düzenlenebilir.

---

### F5 — Kâşif: üyelik, Bilim Merkezi, etkinlik kaydı ve oynatıcı (14 gün) → **M1**

| Adım  | İş                                                                                                                                                                                                                                                                                                                                                                                                                   | Dosyalar                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| F5.1  | `explorer` feature (ADR 0009): **Kâşif üyeliği** (`register`, cihaz↔üye bağlama, aktif üye `kasif:active-explorer:v1`), karşılama akışı (ad → avatar → "Bilim Merkezine Gir"), "Kâşif kodum var" (`/giris`, kod yazma), `ensureDeviceSession` (çevrimiçi olunca), çevrimdışı başlayan üyeliğin eşitlenmesi, `navigator.storage.persist()`; eğitmen onayı adımı bayrakla kapalı hazır (KVKK sorumlusu gerekirse açar) | `src/features/explorer/`                     |
| F5.2  | `WelcomePage` (maskot animasyonu, tek alanlı büyük giriş, takma ad filtresi geri bildirimi, "Kâşif kodum var"), `RestorePage` (`/giris`), `PrivacyPage` (`/aydinlatma`)                                                                                                                                                                                                                                              | `src/pages/kids/`                            |
| F5.3  | `activity` feature: IndexedDB kuyruğu, `client_event_id`, toplu gönderim (çevrimiçi olunca, en fazla 50, üstel geri çekilme), aktif üyenin `explorer_id`'si, istemci `occurred_at`; önizleme/E2E'de kapalı, önizleme cihazında `is_preview`                                                                                                                                                                          | `src/features/activity/`                     |
| F5.4  | `kit-catalog`: `ContentSource` üzerinden sorgular (Zod + `migrateKit`, `offlineFirst`)                                                                                                                                                                                                                                                                                                                               | `src/features/kit-catalog/`                  |
| F5.5  | Oynatıcı sözleşmesi: `BlockProps<T> = { step; onComplete(meta); onInteraction(evt); celebrate(msg) }`, registry `satisfies`                                                                                                                                                                                                                                                                                          | `src/features/kit-player/blocks/registry.ts` |
| F5.6  | `StepRenderer`, `StepShell` (🏠, "Kart 3 / 7", SpeakButton, `h1`, görsel alan, ipucu, cevap, "Sıradaki ➜", son kartta "🎉 Bitirdim!")                                                                                                                                                                                                                                                                                | `src/features/kit-player/components/`        |
| F5.7  | Görsel alan: 7 kütüphane sahnesi; `AiSceneRenderer` (durum başına **`<img>`**, `src` değişimi + çapraz geçiş, `static` kare, alt metin `desc`'ten; DOMPurify yok); `ImageVisual`; `VideoPlayer` (YouTube: yer tutucu → dokununca `sandbox`'lı nocookie iframe, "İzledim"; MP4 URL: `<video>`, VTT altyazı, %80 izleme algılama; kaynak yoksa "Video kullanılamıyor")                                                 | `src/features/kit-player/visuals/`           |
| F5.8  | 13 blok (`useReducer`; `onComplete` ve kutlama tek sefer; `sequence`/`matching` için dokun-seç-yerleştir + klavye + sürükleme; döngüsel/uzun animasyonlarda `MotionToggle`)                                                                                                                                                                                                                                          | `src/features/kit-player/blocks/`            |
| F5.9  | Sayfalar: `ExploreHomePage` = **Bilim Merkezi** ("Merhaba Ayşe!", kitler, "QR Okut" butonu (F11'de bağlanır), rozetler kısayolu), `KitHomePage` (R1), `StepPage` (bileşim: player + progress + activity), `KitCompletePage`, `ProfilePage` (Kâşif değiştir, Kâşif kartım, ayarlar, üyeliğimi sil); ilerleme ve rozetler sunucudan (cihazda önbellek)                                                                 | `src/pages/kids/`                            |
| F5.10 | Router: ilk açılışta aktif üye yoksa `/hosgeldin?donus=` (yalnızca `/` ile başlayan iç yol; `//` ve `\` yasak); `KidsLayout`; belge başlıkları; rota değişiminde konuşma durur                                                                                                                                                                                                                                       | `src/app/router/`                            |
| F5.11 | Dostça hata ekranları (maskotlu)                                                                                                                                                                                                                                                                                                                                                                                     | pages                                        |
| F5.12 | Performans: başlangıç JS ≤ 170 kB (gzip); blok, sahne ve video chunk'ları ≤ 50 kB (gzip); DOMPurify yok                                                                                                                                                                                                                                                                                                              | —                                            |

**Birim testleri:**

- **Karşılama ve üyelik:**
  - Ad doğrulama (Türkçe harfler, uzunluk, filtre).
  - Üyelik açılınca Kâşif kodu bir kez gösterilir, sonra yalnızca Kâşif kartında görünür.
  - Kâşif kodu biçimi ve büyük/küçük harf duyarsızlığı; kart QR'ı `KASIF:<kod>` çözümlemesi.
  - Çevrimdışında üyelik yerelde başlar, çevrimiçi olunca sunucuda açılır ve kuyruk sırayla gider.
  - Eğitmen onayı adımı bayrak kapalıyken görünmez, açıkken zorunludur.
- **Kuyruk:** Çevrimdışında birikir; tek gönderim; `client_event_id` tekrarında çift kayıt olmaz;
  sınır aşımında en eski olaylar düşer.
- **Bloklar:** Her blok için tamamlanma tek sefer, kutlama tekrarlanmaz, klavyeyle oynanabilir,
  azaltılmış hareket ve yanlış seçim davranışları.
- **`AiSceneRenderer`:** Yalnızca `<img>` üretir (`dangerouslySetInnerHTML` yok); durum geçişi
  `src` değişimiyle olur; Durdur ve azaltılmış hareket `static` kareyi gösterir.
- **`VideoPlayer`:** YouTube iframe'i dokunmadan yüklenmez; iframe `sandbox` özniteliğinde
  `allow-popups` ve `allow-top-navigation` yoktur; MP4'te altyazı izi eklenir.
- **Sayfalar:** Dört durumun her biri.

**E2E (mock; kids-desktop/mobile/tablet)**

| Spec                                                                           | Senaryo                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kids/welcome.spec.ts`                                                         | İlk açılış → ad "Ayşe" → avatar → "Bilim Merkezine Gir" → "Merhaba Ayşe!"; uygunsuz ad → nazik uyarı; yenilemede karşılama tekrar gelmez; aydınlatma metni bağlantısı çalışır                                                     |
| `kids/welcome-from-qr.spec.ts`                                                 | Profil yokken `?q=KC-04` → karşılama (≤ 3 dokunuş) → doğrudan o kart                                                                                                                                                              |
| `kids/profiles.spec.ts`                                                        | İkinci kâşif ekle → Kâşif değiştir → ilerlemeler ayrı; "Üyeliğimi sil" → karşılamaya döner ve sunucuda üyelik yok                                                                                                                 |
| `kids/restore.spec.ts`                                                         | Üye olunur → Kâşif kodu alınır → **yeni tarayıcı bağlamı** → "Kâşif kodum var" → kod → aynı ad, ilerleme ve rozetler; yanlış kod 5 kez → bekleme mesajı                                                                           |
| `kids/explore.spec.ts`                                                         | Bilim Merkezi, kitler, filtre URL'de, boş katalogda maskotlu boş durum                                                                                                                                                            |
| `kids/play-reference-kit.spec.ts`                                              | Küçük Çiftçiler'in 7 kartı: her etkileşim ve kutlama → "Bitirdim" → tamamlandı; konsol hatası yok                                                                                                                                 |
| `kids/blocks.spec.ts`                                                          | Blok vitrini: 13 bloğun her biri tamamlanır (blok başına bir test)                                                                                                                                                                |
| `kids/visuals.spec.ts`                                                         | AI sahnesi `<img>` ile render olur ve durum değiştirir, DOM'da satır içi `<svg>` yok; Durdur `static` kareyi gösterir; MP4 URL'li video oynar ve %80'de tamamlanır; YouTube kartı dokunmadan iframe yüklemez, iframe `sandbox`'lı |
| `kids/activity.spec.ts` (analitik açık)                                        | Kart tamamla → `record_events` isteği doğru alanlarla (`explorer_id`, `occurred_at`); çevrimdışında birikir, çevrimiçiyken bir kez gider                                                                                          |
| `kids/navigation.spec.ts`, `kids/errors.spec.ts`, `kids/speech-routes.spec.ts` | Gezinme, hata durumları, konuşmanın rota değişiminde durması                                                                                                                                                                      |
| `a11y/kids.spec.ts`                                                            | Karşılama (her adım), Kâşif koduyla giriş, aydınlatma, Bilim Merkezi, kit, 13 blok (öncesi/sonrası), profil, tamamlandı, bulunamadı                                                                                               |
| `kids/*` `@supabase` projesi                                                   | Anonim oturum + üyelik + Kâşif koduyla ikinci cihaza bağlama + olay yazımı yerel yığında                                                                                                                                          |

**M1 kabulü:**

- R1, R3–R12 ve R14 karşılandı.
- Üyelik, Kâşif koduyla geri giriş ve etkinlik kaydı iki arka uçta çalışıyor.
- Premium kalite kapısı geçildi.
- `code-reviewer` ve `accessibility-auditor` raporları temiz.

---

### F6 — Studio: Pano ve Kâşif Kitleri yönetimi (6 gün)

| Adım  | İş                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F6.1  | ADR 0010; `react-hook-form`, `@hookform/resolvers`, `@dnd-kit/*`, `idb-keyval`, `cmdk`, grafik kütüphanesi (ADR 0010'da seçilir: bundle boyutu, SVG çıktısı, tablo alternatifi)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| F6.2  | `studioKitKeys` + queryOptions + mutasyonlar (iyimser güncelleme, `ConflictError`, geri alma)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| F6.3  | **`DashboardPage` (Studio ana sayfası):** KPI kutuları (Bugün aktif kâşif, Son 15 dk aktif, Bugün QR okutma, Bu hafta tamamlanan kit), **Kâşif Kitleri tablosu** (ikon, ad, durum rozeti, kart sayısı, 7 günlük QR okutma, tamamlama oranı, son güncelleme, hızlı eylemler), 30 günlük aktif kâşif trendi, en çok okutulan kartlar, canlı etkinlik akışı ("Ayşe #A7F2 'Tohum nedir?' kartını tamamladı · 2 dk önce"), "İncelemeni bekleyenler", kota kutuları (DB, depo, **tahmini aylık trafik**, AI günlük kotası, MAU), tek admin uyarısı; 30 sn'de bir yenileme; editör kâşif adlarını görmez |
| F6.4  | `KitListPage`: tablo/kart, arama, durum filtresi, sayfalama (URL), satır menüsü (düzenle, çoğalt, arşivle, sil (yalnızca hiç yayınlanmamışsa) + onay), boş durum (maskot + "İlk Kâşif Kitini oluştur")                                                                                                                                                                                                                                                                                                                                                                                            |
| F6.5  | **"Yeni Kâşif Kiti" sihirbazı** (`KitCreatePage`): 1) şablon (6) ya da "Yapay zekâyla taslak" (F9'da bağlanır); 2) ad ("Küçük Çiftçiler") → Türkçe slug + QR öneki önerisi (benzersiz), kit ikonu; 3) açıklama, kapak, kategori, yaş, süre → "Oluştur ve kartları ekle"                                                                                                                                                                                                                                                                                                                           |
| F6.6  | `KitEditorPage` iskeleti: kit adı, durum rozeti, kayıt durumu, Önizle, Analiz, Yayınla; sekmeler URL'de                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F6.7  | **Genel** sekmesi: tüm kit alanları (hedefler, malzemeler, güvenlik notları sıralanabilir listeler), QR giriş modu; slug ve önek ilk yayından önce `rename_kit` ile değişir, sonra salt okunur (açıklamalı)                                                                                                                                                                                                                                                                                                                                                                                       |
| F6.8  | **Tema** sekmesi: 5 ön ayar, vurgu rengi (canlı kontrast göstergesi, AA altında kaydedilmez), yazı tipi (oyunsu/standart), hareket seviyesi (tam/sakin/minimal), canlı mini önizleme; **Rozet** sekmesi                                                                                                                                                                                                                                                                                                                                                                                           |
| F6.9  | Otomatik kayıt (800 ms debounce, durum göstergesi, IndexedDB yedeği, `beforeunload`, `Ctrl/Cmd+S`), çakışma diyaloğu                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| F6.10 | **Komut paleti** (`Ctrl/Cmd+K`): kit ara/aç, yeni kit, kart ekle, QR oluştur, kâşif ara, kullanıcı ara                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

**Birim testleri:**

- Mutasyonlar: iyimser güncelleme ve geri alma.
- Slug ve önek önerileri: Türkçe karakterler, benzersizlik.
- Tema vurgu rengi kontrastı.
- `useAutosave`: tüm dallar.
- Pano KPI hesapları: sıfır veri, bölme hatası olmaması.
- Editör rolünde kâşif alanlarının gizlenmesi.

**E2E (mock + supabase)**

| Spec                              | Senaryo                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studio/dashboard.spec.ts`        | Seed edilmiş kitler ve olaylar → KPI'lar, kit tablosu durumları, etkinlik akışı doğru; tablodan kite gitme; boş durum `@mock-only`                                              |
| `studio/kit-wizard.spec.ts`       | "Yeni Kâşif Kiti" → Boş şablon → "Küçük Çiftçiler" → slug `kucuk-ciftciler`, önek `KC` → açıklama + kapak → editör açılır                                                       |
| `studio/kits-crud.spec.ts`        | Genel bilgiler → otomatik kayıt → yenile → duruyor; çoğalt; arşivle; yayınlanmamış kit silinir, yayınlanmış kitte "Sil" yok; yayından önce slug/önek değişir, sonra salt okunur |
| `studio/theme.spec.ts`            | Düşük kontrastlı vurgu reddedilir; hareket seviyesi "minimal" → önizlemede animasyon yok                                                                                        |
| `studio/kit-list.spec.ts`         | Arama, filtre, sayfalama URL'de; geri tuşu                                                                                                                                      |
| `studio/conflict.spec.ts`         | **Aynı bağlamda iki sayfa** aynı kiti düzenler → çakışma diyaloğu → kopya olarak kaydet                                                                                         |
| `studio/autosave-offline.spec.ts` | Çevrimdışı → "Kaydedilemedi" + yerel yedek → çevrimiçi → kayıt; kaydedilmemiş değişiklikle çıkış → `beforeunload`                                                               |
| `studio/command-palette.spec.ts`  | `Ctrl+K` → "Küçük" → kit açılır; klavyeyle gezinme                                                                                                                              |
| `a11y/studio-kits.spec.ts`        | Pano, liste, sihirbaz adımları, editör sekmeleri, komut paleti                                                                                                                  |

---

### F7 — Medya kütüphanesi: görsel, ses, video URL, ikon (4 gün)

| Adım | İş                                                                                                                                                                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F7.1 | `imageResize`: WebP, ≤ 1200 px, ≤ 150 kB hedef, EXIF temizliği; WebP desteklenmezse JPEG'e düşer (Safari); hedef boyuta inilemezse açıklamalı hata. `audioProbe`: süre ve boyut (≤ 1 MB), aşımda açıklamalı red                                                                                            |
| F7.2 | `videoUrl`: YouTube bağlantısı → `videoId` (`watch?v=`, `youtu.be`, `shorts/`); MP4 URL: yalnızca `https:`, Studio'da `<video>` ile oynatılabilirlik ve süre kontrolü; "Videoda konuşma var mı?" → evetse VTT yükleme (MP4) ya da "YouTube'da Türkçe altyazı var" onayı (zorunlu). Video dosyası yüklenmez |
| F7.3 | `MediaPage`: sürükle-bırak yükleme (görsel, ses, VTT), ilerleme, **alt metin zorunlu** (görsel), tür filtresi (Görsel/Ses/Altyazı/AI/İkon), arama, kullanım yeri ("2 kitte kullanılıyor", yayınlanmış sürümler dahil) + silme engeli, kota çubuğu ve tahmini aylık trafik                                  |
| F7.4 | `MediaPicker` diyaloğu (kütüphaneden seç / yükle / **video bağlantısı**: YouTube ya da MP4 URL)                                                                                                                                                                                                            |
| F7.5 | **`IconPicker`**: sekmeler Emoji (arama), **Bilim ikonları** (paketlenmiş ~80 ikon, Kâşif stili, kart rengine boyanır), Yükle (kare kırpma, ≤ 200 kB), **Yapay zekâ** (F9'da bağlanır)                                                                                                                     |

**Birim testleri:**

- Küçültme boyut hesabı (saf).
- `videoUrl`: YouTube biçimleri, `https:` zorunluluğu, altyazı kuralı; `audioProbe` sınırları
  (metadata enjekte edilir).
- `IconPicker` sekme ve klavye davranışı.
- Kullanım yeri sayımı.

**E2E (mock + supabase)**

| Spec                         | Senaryo                                                                                                                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studio/media-image.spec.ts` | 3 MB fotoğraf → WebP ≤ 150 kB; alt metin boşken kaydet kapalı; PDF reddedilir; 3 MB ses reddedilir; kullanımdaki görsel silinemez                                                                                                                              |
| `studio/media-video.spec.ts` | YouTube bağlantısının üç biçimi kimliğe çözülür; geçersiz bağlantı ve `http:` MP4 reddedilir; test sunucusundaki MP4 URL'si oynatılır; "konuşma var" seçiliyken altyazısız kaydedilemez; video dosyası sürüklenince "Videoları bağlantı olarak ekleyin" mesajı |
| `studio/icon-picker.spec.ts` | Emoji ara-seç; bilim ikonu seç; PNG yükle → kare kırp; kart listesinde ikon görünür                                                                                                                                                                            |
| `a11y/studio-media.spec.ts`  | Medya (boş/dolu), yükleme, MediaPicker, IconPicker                                                                                                                                                                                                             |

---

### F8 — Kart editörü ve canlı önizleme (11 gün)

| Adım  | İş                                                                                                                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F8.1  | **Kartlar** sekmesi: solda kart listesi, ortada editör, sağda önizleme (≥ 1280 px); dar ekranda önizleme Sheet'te                                                                                                                                                |
| F8.2  | `StepList`: ikon + kart rengi + başlık + tür + QR kodu, `@dnd-kit/sortable` + "Yukarı/Aşağı taşı" + `Alt+↑/↓`, çoğalt, sil (geri al toast'ı), seçili kart URL'de                                                                                                 |
| F8.3  | `AddStepMenu` ("+ Kart ekle"): 13 blok; ikon, ad, açıklama, "E-B-M'deki karşılığı"; yeni karta QR kodu otomatik atanır                                                                                                                                           |
| F8.4  | `StepBaseFields`: başlık (soru), **ikon** (IconPicker), kart rengi, cevap (kalın butonlu mini editör), anlatım + "Dinle" önizlemesi, hazır ses (MediaPicker), ipucu, kutlama, zorunlu mu                                                                         |
| F8.5  | **Görsel alan editörü**: Hazır sahne (küçük resimli liste, durum eşlemesi) · **Yapay zekâ animasyonu** (F9; `AI_PROVIDER=off` iken gizli) · Görsel · **Video** (YouTube ya da MP4 bağlantısı + altyazı kuralı) — blok türünün desteklediği seçenekler gösterilir |
| F8.6  | 13 blok editörü (`blockEditorRegistry satisfies …`), dizi alanları (`useFieldArray`, sınırlar şemadan)                                                                                                                                                           |
| F8.7  | Canlı önizleme (sayfada bileşim; etkinlik kaydı kapalı; telefon/tablet çerçevesi; "Sıfırla")                                                                                                                                                                     |
| F8.8  | `KitPreviewPage`: kit akışının tamamı (karşılama atlanır, "Önizleme Kâşifi"), "Studio'ya dön"                                                                                                                                                                    |
| F8.9  | `ValidationPanel` (Türkçe hatalar, "Git", sekmede ve Yayınla'da sayaç): AI içeriği için "kontrol edilmedi" uyarıları, eksik altyazı, AI sahnesinde eksik `static` kare, erişilemeyen video bağlantısı                                                            |
| F8.10 | Kısayollar (`Ctrl/Cmd+S`, `Ctrl/Cmd+Shift+P`, `Alt+↑/↓`, `?`); içe/dışa aktar (JSON; yeni `schemaVersion` açık hata)                                                                                                                                             |

**Birim testleri:**

- Her blok editörü: değer güncellenir, dizi sınırları uygulanır, hata alana bağlıdır.
- Registry eksiksiz.
- `StepList`: butonlar ve kısayollar (sürükleme değil).
- Görsel alan editöründe yalnızca uyumlu seçenekler görünür.
- İçe/dışa aktarma gidiş-dönüşü aynı belgeyi verir.

**E2E (mock + supabase; studio-desktop, studio-tablet)**

| Spec                           | Senaryo                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `studio/card-editor.spec.ts`   | 13 türün her biri: kart ekle → doldur → **önizleme güncellenir** (etkileşim tamamlama `kids/blocks`'ta test edilir) |
| `studio/card-visual.spec.ts`   | Hazır sahne seç + durum eşle; MP4 bağlantısı ekle → önizlemede oynar; YouTube bağlantısı ekle → yer tutucu görünür  |
| `studio/reorder.spec.ts`       | Sürükle-bırak ve `Alt+↓` → yenile → sıra korunur; QR kodları değişmez                                               |
| `studio/validation.spec.ts`    | Doğru seçeneksiz `choose-correct` → hata, Yayınla kapalı → "Git" → düzelt                                           |
| `studio/preview.spec.ts`       | Önizlemede tüm kit oynanır; olay isteği gönderilmez; "Studio'ya dön" oturumu korur                                  |
| `studio/import-export.spec.ts` | Gidiş-dönüş; bozuk JSON; daha yeni şema sürümü                                                                      |
| `a11y/studio-editor.spec.ts`   | Kartlar sekmesi, 13 editör, görsel alan editörü, doğrulama paneli, kısayol diyaloğu                                 |

---

### F9 — Yapay zekâ stüdyosu: Gemini (6 gün; F0.10 hukuk görüşü olumluysa)

| Adım | İş                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F9.1 | `ai-studio` feature: `AiService` (SSE ilerleme, iptal), **kota** sorgusu (proje ve kullanıcı günlük), hata eşlemesi (429 uygulama ya da sağlayıcı kotası + sıfırlanma bilgisi, 422 güvenlik filtresi / kişisel veri deseni, 504/zaman aşımı); `AI_PROVIDER=off` iken tüm AI girişleri gizli                                                                                                                                                                                                                   |
| F9.2 | **AI animasyon paneli** (görsel alan editöründe): istem (kart başlığı ve cevabından ön doldurulur; "Kişisel veri yazmayın" notu), stil (Kâşif çizgisi, sabit), blok türünün gerektirdiği durumlar + `static` (salt okunur) → "Oluştur" → ilerleme ("Çiziliyor… 45 sn") → **1 öneri** (ayarla 1–3) → canlı önizlemede `<img>` durum geçişleri → "Kullan" / "Farklı bir öneri" (kotadan düşer) / "İstemi düzenle". Seçilen durum dosyaları aynı `scene_group` ile `media_assets`'e AI kaynağı olarak kaydedilir |
| F9.3 | **AI ikon** (IconPicker'ın Yapay zekâ sekmesi): kavram → 2 öneri (tek istekte) → seç                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F9.4 | **AI kart metni**: kart editöründe "✨ Yapay zekâyla doldur" → soru, cevap, anlatım, ipucu, kutlama, seçenekler (türe göre) → alan bazında kabul et/değiştir; kabul edilen alanlar `aiGenerated` işaretlenir                                                                                                                                                                                                                                                                                                  |
| F9.5 | **AI kit taslağı** (sihirbazda): konu, yaş aralığı, kart sayısı → kartlar + önerilen blok türleri + sahne açıklamaları → taslak kit (sahneler kart başına sonra üretilir)                                                                                                                                                                                                                                                                                                                                     |
| F9.6 | Yönetişim: yayın öncesi "AI içeriğini bilimsel doğruluk açısından kontrol ettim" onayı (AI alanı varsa zorunlu); `SettingsPage`'de günlük kota ayarları (proje, kullanıcı, öneri sayısı) ve kullanım grafiği; `ai_usage` listesi (admin)                                                                                                                                                                                                                                                                      |
| F9.7 | İstem mühendisliği (Gemini): sistem istemi (stil, palet, SVG sözleşmesi, durum başına dosya, erişilebilirlik, çocuk güvenliği, bilimsel doğruluk, Türkçe dil düzeyi), 2 altın örnek, 20 örnekli değerlendirme seti (`docs/ai/eval-set.md`); canlıda elle, onaylı değerlendirme (ücretsiz kotadan)                                                                                                                                                                                                             |

**Birim testleri:**

- SSE ayrıştırma ve iptal.
- Hata eşlemesi.
- Kota dolunca butonların kapanması ve sıfırlanma bilgisi.
- `AI_PROVIDER=off` iken AI girişlerinin hiç render edilmemesi.
- `aiGenerated` işaretleri ve yayın onayı kuralı.
- AI sahnesi önizlemesi yalnızca `<img>` ile render edilir.

**E2E (mock + supabase `AI_PROVIDER=fake`)**

| Spec                             | Senaryo                                                                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `studio/ai-scene.spec.ts`        | `tap-reveal` kartında "Yapay zekâ animasyonu" → oluştur → öneri → önizlemede `<img>` ile `before → after` geçişi → "Kullan" → kaydedilir ve Kâşif'te `<img>` ile render olur                                                   |
| `studio/ai-guardrails.spec.ts`   | Günlük kota dolu (seed) → buton kapalı, açıklama ve sıfırlanma bilgisi var; fake sağlayıcı zaman aşımı → "Tekrar dene"; güvenlik filtresi engeli → açıklama; istemde e-posta → uyarı; kötü niyetli fixture → reddedildi mesajı |
| `studio/ai-off.spec.ts`          | `AI_PROVIDER=off` → AI butonları, sekmeleri ve sihirbaz seçeneği görünmez; kit oluşturma, hazır sahne ve video akışları çalışır                                                                                                |
| `studio/ai-text-icon.spec.ts`    | "Yapay zekâyla doldur" → alanlar önerilir → kabul → işaretli; AI ikon seçimi                                                                                                                                                   |
| `studio/ai-kit-draft.spec.ts`    | Sihirbazda "fotosentez, 8 yaş, 5 kart" → 5 kartlı taslak kit açılır                                                                                                                                                            |
| `studio/ai-publish-gate.spec.ts` | AI alanı olan kitte onay kutusu işaretlenmeden Yayınla kapalı                                                                                                                                                                  |
| `a11y/studio-ai.spec.ts`         | AI panelleri (boş, üretiliyor, sonuç, hata)                                                                                                                                                                                    |

---

### F10 — Yayın ve sürümler (5 gün)

| Adım  | İş                                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F10.1 | `kit-publishing` mutasyonları (`publish-kit` action'ları: kiralama, sürüm ayırma → dosya → kesinleştirme; yarıda kalan yayını tekrar deneme) + invalidation                                                        |
| F10.2 | **Yayın** sekmesi (admin): görünürlük (Herkese açık / Liste dışı: "katalogda görünmez, gizli değildir"), yayın notu, AI onayı, "Yayınla"; yayında olmayan değişiklikler rozeti                                     |
| F10.3 | Editör akışı: "İncelemeye gönder" (taslak editöre kilitlenir) → panoda bekleyenler → admin "Yayınla" (incelenen `lock_version` ile) / "Değişiklik iste" (not); editör "İncelemeden geri çek" ile düzenlemeye döner |
| F10.4 | `KitVersionsPage`: v1…vN, önizle, "Taslağa geri yükle"; arşiv/arşivden çıkar; "Yayın dosyalarını yeniden üret" (admin)                                                                                             |

**Birim testleri:**

- Rol × durum eylem matrisi.
- Görünürlük seçimi.
- Hata durumları: 409, 422 (alan listesi görünür).

**E2E (mock + supabase)**

| Spec                                       | Senaryo                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`journeys/create-publish-play.spec.ts`** | **Altın yolculuk (§0.4):** giriş + 2FA → pano → "Yeni Kâşif Kiti" → Küçük Çiftçiler → 7 kart (ikonlar; 1 AI animasyon, 1 video bağlantısı, hazır sahneler) → önizle → yayınla → `exportState` → **mobil bağlam**: karşılama "Ayşe" → üyelik → Bilim Merkezi'nde kit → 7 kart → tamamlandı + rozet → Studio panosunda Ayşe'nin etkinliği ve sayılar |
| `journeys/editor-review.spec.ts`           | Editör kit hazırlar → incelemeye gönderir → incelemedeki taslağı değiştiremez → admin not ile değişiklik ister → editör düzeltir → admin yayınlar                                                                                                                                                                                                  |
| `studio/visibility.spec.ts`                | Liste dışı: katalogda yok, bağlantı ve QR ile açılır; herkese açığa çevrilince katalogda                                                                                                                                                                                                                                                           |
| `studio/versions.spec.ts`                  | v1 → v2 → Kâşif v2'yi gösterir (`max-age=0`) → v1'i geri yükle ve yayınla (v3); yayın dosya yazımından sonra kesilir (enjekte) → "Tekrar dene" → tamamlanır                                                                                                                                                                                        |
| `studio/archive.spec.ts`                   | Arşiv → katalogdan çıkar; kartın QR'ı "artık yayında değil" gösterir; arşivden çıkar → geri gelir                                                                                                                                                                                                                                                  |
| `studio/permissions.spec.ts`               | Editörde Yayınla yok; URL ile yetkisiz eylem → 403                                                                                                                                                                                                                                                                                                 |
| `a11y/studio-publishing.spec.ts`           | Yayın sekmesi (her durum), sürümler                                                                                                                                                                                                                                                                                                                |

---

### F11 — Dinamik QR: oluşturma, ekipman etiketleri, uygulama içi okuyucu (6 gün) → **M2**

**"QR oluştur" akışı:**

1. Her kartın kalıcı bir kodu vardır (`KC-01`…), kitin kodu `KC`'dir. Kod kart eklenirken atanır,
   ilk yayından sonra kilitlenir.
2. Admin **QR oluştur** dediğinde görseller tarayıcıda anlık üretilir ve hiçbiri saklanmaz. QR
   içeriği `https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/?q=KC-01` olur.
3. Admin etiketleri basar ve **ekipmana yapıştırır**. Her etiketin altında elle yazılabilir kod
   (`KC-01`) bulunur.
4. Çocuğun QR'a ulaştığı üç yol vardır:
   - Telefon kamerası → tarayıcıda `?q=`.
   - Kâşif'teki **"QR Okut"**.
   - Kodu elle yazma.

   Her durumda kod `qr-index.json` ile **çalışma anında** güncel karta çözülür. Okutma olayı
   kaydedilir.

5. Yayında olmayan bir kitin kodu okutulursa "Bu kart henüz etkin değil" mesajı gösterilir.

| Adım  | İş                                                                                                                                                                                                                                                                                                                                                                                      | Dosyalar                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| F11.1 | `qr-entry`: kökte `?q=` ve `/q/:code` → `resolveQrCode(qrIndex)` → `replace`; kit kodu → kit sayfası; pasif / bilinmeyen / yayında değil mesajları; aktif üye yoksa karşılamaya `donus` ile; `qr_scan` olayı (kaynak: `camera-link` / `in-app` / `manual`)                                                                                                                              | `src/features/qr-entry/`, `QrEntryPage` |
| F11.2 | **`QrScanPage`**: kamera izni açıklaması, vizör, BarcodeDetector ya da **self-host zxing-wasm polyfill** (lazy, CSP `'wasm-unsafe-eval'`), fener (destekleniyorsa), "Kodu yaz" (büyük tuş takımı, `KC-01` biçimi), izin reddinde yönlendirme; kendi alan adımıza (ve §3.7'deki olası özel alan adına) ait kit QR'larını ve **Kâşif kartı QR'ını** (`KASIF:<kod>` → `/giris`) kabul eder | `src/pages/kids/`, `qr-entry`           |
| F11.3 | Odak modu (R2): `focused` iken 🏠 ve "Sıradaki" gizli, "Bu kitteki diğer kartlar" bağlantısı görünür                                                                                                                                                                                                                                                                                    | `StepShell`                             |
| F11.4 | `qr-print` lib: `buildQrUrl(code)` (hep `VITE_PUBLIC_SITE_URL`), QR matrisi (hata düzeltme M), `renderQrPng` (1024 px, sessiz bölge 4, etiket), `renderQrSvg`                                                                                                                                                                                                                           | `src/features/qr-print/lib/`            |
| F11.5 | `KitQrPage`: kodlar tablosu (kit + kartlar; ikon, başlık, kod, hedef URL kopyala); **"QR oluştur"** → önizleme ızgarası; tek tek PNG/SVG; "Tümünü indir (ZIP)"; PDF için yazdırma sayfasından tarayıcının "PDF olarak kaydet" seçeneği; yayında değilse "Kartlar yayınlanınca etkinleşir" bandı                                                                                         | pages                                   |
| F11.6 | `KitQrPrintPage` şablonları: **Kart** (85×55 mm, A4'te 2×5), **Ekipman etiketi** (40/50/70 mm kare; A4 etiket kâğıdı için satır/sütun/kenar boşluğu ayarlanabilir), **Kit kutusu** (A6). Her birinde: QR, kart ikonu, "Kart 3", başlık, elle yazılacak kod, "Kâşif ile okut"; kesim çizgileri; arka yüz notu; `@media print` + `@page`                                                  | pages                                   |
| F11.7 | **Önizleme cihazı** (§3.3): Studio → Ayarlar → "Bu cihazda Kâşif'i önizle" (`kasif:preview:v1`); bayrak açıkken coming-soon atlanır ve olaylar `is_preview` ile gider; Kâşif'te "Önizleme cihazı" rozeti                                                                                                                                                                                | `src/features/pwa/`, `SettingsPage`     |

**Birim testleri:**

- `buildQrUrl` her zaman canlı adresi üretir.
- QR matrisi: bilinen girdi → bilinen modül sayısı.
- Etiket satır kırma (enjekte edilen ölçüm).
- `qr-entry`: tüm dallar.
- Elle kod girişi: biçim ve büyük/küçük harf.
- Okuyucu: yabancı alan adlı QR reddedilir.

**E2E**

| Spec                         | Proje           | Senaryo                                                                                                                                                                                                                                                                         |
| ---------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kids/qr-entry.spec.ts`      | mock            | `?q=KC-04` → kart, odak modu; `?q=kc-04`; `?q=KC` → kit; bilinmeyen / pasif / yayında değil mesajları; geri tuşu döngüye girmez                                                                                                                                                 |
| `kids/qr-scan.spec.ts`       | mock (Chromium) | Sahte kamera (QR `.y4m`) → okuyucu kodu tanır → kart açılır; kamera izni reddedilir → "Kodu yaz" → `KC-02` → kart; başka alan adına ait QR → uyarı; Kâşif kartı QR'ı → üyelik bu cihaza bağlanır; CSP ihlali yok                                                                |
| `studio/qr-generate.spec.ts` | mock + supabase | Taslak kitte "QR oluştur" + bant; yayınla → ZIP → 8 PNG; her PNG `jsqr` ile çözülür → canlı adres + doğru `?q=`                                                                                                                                                                 |
| `studio/qr-print.spec.ts`    | mock            | Üç şablon: `page.pdf` sayfa sayısı (7 kart + kit → 2 sayfa kart şablonu), etiket ızgarası ayarı, `window.print` stub'ı çağrılır                                                                                                                                                 |
| `journeys/qr-scan.spec.ts`   | mock + supabase | Yayınla → PNG → çöz → köke test sunucusu konur → mobil bağlamda açılır → karşılama → kart → Studio'da `qr_scan` olayı; kartları yeniden sırala ve yayınla → **aynı QR** yine doğru kartı açar; coming-soon açıkken QR "Yakında" + kodu gösterir, önizleme cihazında kart açılır |
| `a11y/qr.spec.ts`            | mock            | QR sayfası, yazdırma sayfaları, okuyucu (izin öncesi/sonrası), QR hata sayfaları                                                                                                                                                                                                |

**M2 kabulü:**

- Altın yolculuk, editör yolculuğu ve QR yolculuğu iki arka uçta yeşil, `--repeat-each=5` ile
  kararlı.
- R2 ve R17 karşılandı.
- Premium kalite kapısı geçildi.

---

### F12 — Canlı ortam kapısı: tek seferlik uygulama (3 gün) → **G**

> Tek Supabase ortamına ilk ve tek toplu uygulama. Her adım kullanıcı onayıyla yapılır.

| Adım   | İş                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F12.1  | **Kapı kontrol listesi:**<br>• M2 yeşil; son 10 CI koşusunda Supabase provası kesintisiz yeşil<br>• `schema.md`, `query-catalog.md` ve `capacity.md` onaylı; trafik formülü sınırın %70'inin altında (değilse B planı)<br>• F13–F14'ün tabloları şemada ve sözleşme testleri yeşil<br>• **KVKK: işleme dayanağı yazılı, aydınlatma metni onaylı, yurt dışı aktarım dayanağı ve VERBİS netleşmiş, proje bölgesi kayıtlı**<br>• **Gemini 18 yaş maddesi için hukuk görüşü** (olumsuzsa `AI_PROVIDER=off`)<br>• AI spike'ı "git" (ya da AI kapalı)<br>• en az 2 aktif admin planlandı (F12.8)<br>• özel alan adı kararı verildi |
| F12.2  | Migration'lar sabitlenir; `change-log.md`'ye "v1 şema"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| F12.3  | GitHub Environment'lar ve değişkenler (**kullanıcı ekler**):<br>• `production` (onaylayıcı: kullanıcı): `SUPABASE_ACCESS_TOKEN` (yalnızca bu projeye erişen hesap), `SUPABASE_DB_URL` (**session pooler**, 5432), `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `SUPABASE_SECRET_KEY` (yalnızca `admin-mfa-reset`)<br>• `backup` (yalnızca main, onaysız): session pooler bağlantısı + `age` açık anahtarı (özel anahtar kullanıcıda, çevrimdışı)<br>• Repo Variables (deploy build'i): `VITE_BACKEND=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_CONTENT_BASE_URL`, `VITE_STUDIO_ENABLED`      |
| F12.4  | `db-backup` (boş başlangıç dökümü)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F12.5  | `db-migrate`: session pooler bağlantısı doğrulanır → `link` → `db push --dry-run` (özet) → **onay** → `db push` → `db diff --linked` boş → `db lint --linked` → `schema_version()` repo ile aynı                                                                                                                                                                                                                                                                                                                                                                                                                             |
| F12.6  | Fonksiyon secret'ları (**kullanıcı girer**; `supabase secrets set` ya da panel → Edge Functions → Secrets): `GEMINI_API_KEY` (Google AI Studio'da oluşturulur, yalnızca Gemini API ile kısıtlanır), `AI_PROVIDER` (`gemini`; hukuk görüşü olumsuzsa `off`), `GEMINI_MODEL`, `GEMINI_MODEL_LIGHT`, `ALLOWED_ORIGIN` (canlı köken); `functions-deploy` (onaylı). AI Studio'daki RPD `app_settings`'e girilir                                                                                                                                                                                                                   |
| F12.7  | Panel ayarları (runbook ile, kullanıcı): kayıt kapalı, **anonim giriş açık**, anonim giriş hız sınırı 300/saat/IP, Site URL ve yönlendirme listesi (tam yol), parola politikası, MFA (TOTP) açık, JWT 1800 sn, bucket sınırları, Security Advisor temiz                                                                                                                                                                                                                                                                                                                                                                      |
| F12.8  | İlk admin: `bootstrap-admin` workflow'u (onaylı, admin yoksa çalışır) → ilk girişte parola değiştir + 2FA kaydı → **ikinci admin** Studio'dan eklenir ve 2FA'sını kaydeder                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| F12.9  | Deploy: `VITE_BACKEND=supabase`, `VITE_STUDIO_ENABLED=true`; coming-soon **Kâşif için açık kalır**, Studio çalışır                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F12.10 | Doğrulama **ilk gerçek kitle** yapılır (deneme kiti açılmaz; yayınlanan kit silinemez ve slug/önek kalıcıdır): admin girişi + 2FA → ilk kit **liste dışı** yayınlanır → QR oluştur → **önizleme cihazı** bayraklı telefonla okut → karşılama → kart → panoda `is_preview` olay → ikinci yayında `latest.json`'ın CDN'de tazelendiği ölçülür → önizleme üyeliği silinir. Keep-alive, haftalık yedek, uptime izleyici ve `quota-check` açılır                                                                                                                                                                                  |

**Testler:** `db-migrate` workflow'u CI'da yerel yığına karşı prova edilir. Canlıda yalnızca salt
okunur doğrulama ve F12.10'daki önizleme cihazıyla elle doğrulama yapılır.

**Kabul:**

- `db diff --linked` boş, `schema_version()` repo ile aynı, Security Advisor uyarısız.
- İki admin canlı Studio'da 2FA ile çalışıyor.
- AI durumu (`gemini` ya da `off`) hukuk görüşüyle uyumlu; `GEMINI_API_KEY` yalnızca Supabase
  secret'larında.
- Ziyaretçi hâlâ "yakında" sayfasını görüyor; önizleme cihazı Kâşif'i açabiliyor.

---

### F13 — İlerleme, rozetler, sertifika, Kâşif kartı, PWA/çevrimdışı ve merkez cihazı modu (7 gün)

| Adım  | İş                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F13.1 | `progress`: üye başına ilerleme **Supabase'den** (`explorer_kit_progress`), cihazda iyimser önbellek ve çevrimdışı birleştirme, ✓ işaretleri, ilerleme halkası, "Baştan başla"                                                                                                                                                                                                                          |
| F13.2 | Rozetler (`explorer_badges`): kit rozeti + genel rozetler ("İlk QR'ım", "3 kit bitirdim: Bilim Kâşifi", "Quiz ustası"); rozet kazanma animasyonu (maskot); `BadgesPage`                                                                                                                                                                                                                                 |
| F13.3 | **Sertifika** (`CertificatePage`): kâşif adı, kit, tarih, rozet, Kâşif markası; yazdırma (A4 yatay) ve paylaşma (Web Share API, desteklenmiyorsa PNG indirme)                                                                                                                                                                                                                                           |
| F13.4 | Workbox (§3.6), `cacheId:'kasif'`, `registerType:'prompt'`; Kâşif'te yeni SW Bilim Merkezi'ne dönüşte kendiliğinden etkinleşir, Studio'da `UpdateToast`; `minAppVersion` kontrolü; canlıdaki coming-soon SW'sinden geçiş (`cleanupOutdatedCaches`); `InstallPrompt` (R15; iOS rehberi, Safari 7 gün notu)                                                                                               |
| F13.5 | Çevrimdışı: `OfflineIndicator`, "Bu kiti internetsiz kullan" (JSON + görsel/ses; video URL olduğu için dahil değil, bu açıkça gösterilir), **önbellek bütünlük kontrolü ve onarımı**, `qr-index.json` açıkça önbelleğe alınır                                                                                                                                                                           |
| F13.6 | **Merkez cihazı modu**: Studio → Ayarlar → kurulum kodu üret (`center_devices`, tek kullanımlık, 24 saat) → cihazda "Merkez cihazı kur" + kod (`activate_center_device`); bağlı üye sınırı yok; 90 sn boşta → "Hâlâ orada mısın?" (20 sn, WCAG 2.2.1) → karşılama ekranı (yeni ziyaretçi; önceki üyenin cihaz bağlantısı kaldırılır); wake lock; tam ekran; çıkış eğitmen PIN'iyle (PIN özeti sunucuda) |
| F13.7 | Ayarlar (`ProfilePage`, üyelikte `settings` olarak Supabase'de): genel ses açık/kapalı, animasyonları azalt, yazı boyutu (normal/büyük)                                                                                                                                                                                                                                                                 |
| F13.8 | **Kâşif kartı** (`ProfilePage` ve üyelik sonrası ekran): takma ad, avatar, Kâşif kodu ve `KASIF:<kod>` QR'ı; yazdır (A6) ya da PNG indir; "Kodumu yenile" (eski kod geçersiz olur); merkez cihazında karşılamaya dönmeden önce kart gösterilir                                                                                                                                                          |

**Birim testleri:**

- İlerleme birleştirme: çevrimdışı yerel önbellek ve sunucu; çakışmada birleşim kümesi alınır.
- Rozet kuralları.
- `useIdleTimer`, `useWakeLock`.
- `InstallPrompt` dalları.
- `UpdateToast` (yalnızca Studio) ve Kâşif'te güvenli anda kendiliğinden güncelleme; `minAppVersion`.
- Önbellek onarım karar mantığı.
- Kâşif kartı: kod gösterimi, "Kodumu yenile" sonrası eski kodun reddi.

**E2E (mock; çevrimdışı olanlar Supabase'te de)**

| Spec                         | Senaryo                                                                                                                                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kids/progress.spec.ts`      | 3 kart → yenile → ✓ ve "3 / 7"; **site verisi temizlenir → Kâşif koduyla giriş → ilerleme ve rozetler geri gelir**; kiti bitir → rozet → sertifika adla görünür → yazdır stub'ı; "Baştan başla" iptal/onay |
| `kids/offline.spec.ts`       | SW aktif → "İnternetsiz kullan" → çevrimdışı → yenile → kit ve kartlar çalışır; **`?q=` çevrimdışında çalışır**; olaylar birikir, çevrimiçi olunca gider                                                   |
| `kids/cache-repair.spec.ts`  | Önbellekler silinir (başka sitenin SW'si taklit edilir) → çevrimdışı: "İnternetsiz hazır değil" dürüst mesajı → çevrimiçi yenile → onarılır → tekrar çevrimdışı çalışır                                    |
| `kids/slow-network.spec.ts`  | `catalog.json` askıda → 4 sn'de önbellekten açılır                                                                                                                                                         |
| `kids/center-device.spec.ts` | Kurulum kodu → merkez modu → 11 ziyaretçi üst üste üye olabilir; `page.clock` 90 sn → uyarı → 20 sn → Kâşif kartı → karşılama ekranı; önceki üye bu cihazda görünmez; çıkış yanlış PIN'le olmaz            |
| `kids/pwa.spec.ts`           | SW kaydı, yükleme butonu (sentetik `beforeinstallprompt`)                                                                                                                                                  |
| `a11y/kids-progress.spec.ts` | Rozetlerim, sertifika, Kâşif kartı, ayarlar, merkez modu uyarısı, yükleme rehberi                                                                                                                          |

---

### F14 — Analitik panoları: Kâşifler ve kitler (6 gün) → **M3**

| Adım  | İş                                                                                                                                                                                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F14.1 | ADR 0012. Analitik RPC'leri (`security invoker`) ve `AnalyticsReader` sorguları; tarih aralığı URL'de; 30 sn yenileme (pano); `dataviz` skill'i                                                                                                                                           |
| F14.2 | **`ExplorersPage`** (admin): liste (avatar, takma ad + gösterim kodu, ilk/son görülme, başladığı/bitirdiği kit sayısı, rozet, QR okutma, kayıt yeri: kendi cihazı / merkez), arama, filtre (tarih, kit, tamamladı mı), sayfalama; önizleme üyelikleri görünmez                            |
| F14.3 | **`ExplorerDetailPage`**: zaman çizelgesi ("10:42 KC-01 QR'ını okuttu → 'Tohum nedir?' → 45 sn'de tamamladı → quiz: doğru"), kit ilerlemeleri, rozetler, bağlı cihaz sayısı; "Verilerini dışa aktar" (JSON, KVKK m.11) ve "Kâşifi sil" (onay, audit)                                      |
| F14.4 | **`KitAnalyticsPage`**: kart hunisi (açılış → tamamlama), kart başına QR okutma (kamera / uygulama içi / elle), ortalama süre, quiz başarı oranı, en çok bırakılan kart, saat × gün ısı haritası, 30 günlük trend                                                                         |
| F14.5 | **`AnalyticsPage`**: kit karşılaştırma, merkez geneli (tekil kâşif, yeni/tekrar gelen: `analytics_daily_uniques`'ten; keyfi aralık tekili yalnızca ham olay saklama süresi içinde, açıklamalı), ortalama ziyaret süresi, CSV dışa aktarma (takma adlı; tarih aralığıyla; audit'e yazılır) |
| F14.6 | Hata izleme: `ErrorFallback` ve global hata dinleyicisi → `report_client_error` (oturumlu; özet + sayaç; mesajdaki kişisel veri desenleri temizlenir); Studio'da "Uygulama hataları" kartı                                                                                                |
| F14.7 | Saklama ve KVKK işleri: pg_cron işlerinin Studio'da görünür durumu (son çalışma), ayarlanabilir saklama süreleri (izin verilen aralıklarda)                                                                                                                                               |

**Birim testleri:**

- Grafik veri dönüşümleri (boş gün doldurma, saat dilimi `Europe/Istanbul`).
- Huni oranları (sıfıra bölme olmaz).
- CSV üretimi (Türkçe karakter + BOM).
- Sayfaların dört durumu.
- Editörün kâşif sayfalarına erişememesi.

**E2E**

| Spec                                 | Proje           | Senaryo                                                                                                                                                                                                |
| ------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `studio/explorers.spec.ts`           | mock + supabase | Seed edilmiş kâşifler → liste, arama "Ayşe" → detay zaman çizelgesi doğru sırada → sil → listeden kalkar                                                                                               |
| `studio/kit-analytics.spec.ts`       | mock            | Seed edilmiş olaylar → huni, kart başına sayılar, quiz oranı, ısı haritası hücreleri; veri tablosu alternatifi                                                                                         |
| `studio/analytics-export.spec.ts`    | mock            | Tarih aralığı → CSV indir → başlıklar ve satır sayısı; kâşif verisi JSON dışa aktarımı                                                                                                                 |
| `journeys/scan-to-dashboard.spec.ts` | mock + supabase | Mobil bağlam: karşılama "Can" → 2 QR okut → 1 kart tamamla → Studio: Kâşifler'de "Can", zaman çizelgesinde 2 okutma + 1 tamamlama, kit analitiğinde sayılar arttı                                      |
| `journeys/member-restore.spec.ts`    | mock + supabase | Mobil bağlam: üye "Ece" → 1 kart tamamla → Kâşif kodu → **ikinci mobil bağlam** (başka cihaz) → kodla giriş → ilerleme sürer → 1 kart daha → Studio: Kâşifler'de tek "Ece", 2 bağlı cihaz, 2 tamamlama |
| `a11y/studio-analytics.spec.ts`      | mock            | Kâşifler, detay, kit analitiği, genel analitik (grafiklerin tablo alternatifleri)                                                                                                                      |

**M3 kabulü:**

- R13, R15 ve R16 karşılandı.
- Kâşif düzeyi ve kit düzeyi analitik iki arka uçta doğru; geç gelen çevrimdışı olaylar doğru
  güne düşüyor.
- Kâşif kartıyla başka cihazda devam ve merkez cihazı modu iki arka uçta çalışıyor.
- KVKK işleri (saklama, silme, erişim için dışa aktarma) çalışıyor.
- Premium kalite kapısı geçildi.

---

### F15 — Sertleştirme ve lansman (5 gün) → **M4**

| Adım  | İş                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F15.1 | Meta CSP (F0.9'dan beri etkin) son gözden geçirme: yönerge listesi, ihlal yok; Studio `noindex`; Kâşif için başlık, açıklama ve genel OG görseli                                                                                                                                                                                                           |
| F15.2 | Güvenlik denetimi (`security-auditor`): bağımlılıklar, bundle taraması (`AIza…` yok), RLS/GRANT yeniden gözden geçirme, Security Advisor, anonim kullanıcı büyüme izleme, Kâşif kodu kaba kuvvet sınırı, AI kotası ve `GEMINI_API_KEY`'in yalnızca secret'ta olması                                                                                        |
| F15.3 | Performans (`performance-engineer`): bundle bütçeleri CI'da; Lighthouse CI (Kâşif: Performans ≥ 90, Erişilebilirlik 100, En iyi uygulamalar ≥ 95); **kurulabilirlik** Playwright + CDP `Page.getInstallabilityErrors` ile (Lighthouse 12'de PWA kategorisi yok); düşük seviye Android'de INP < 200 ms                                                      |
| F15.4 | Erişilebilirlik (`accessibility-auditor`): tüm rotalar + TalkBack ve VoiceOver manuel tur                                                                                                                                                                                                                                                                  |
| F15.5 | Yedekten geri yükleme provası: canlı dökümü CI'da yerel yığına yüklenir → `regenerate` → sözleşme testleri (canlıya dokunulmaz)                                                                                                                                                                                                                            |
| F15.6 | `smoke-prod` (gece, salt okunur; anonim giriş, üyelik ve olay kaydı route ile engelli): Bilim Merkezi, kit, `?q=` girişi, Studio giriş sayfası                                                                                                                                                                                                             |
| F15.7 | Runbook'lar: kit oluşturma ve yayınlama, QR basma ve ekipmana uygulama, kullanıcı ekleme ve parola sıfırlama, **admin 2FA acil sıfırlama**, merkez cihazı kurulumu, Kâşif kodu kaybı, KVKK talepleri (erişim ve silme), proje duraklarsa, kota ya da trafik dolarsa (B planı), **Gemini anahtarı yenileme ve kota**, yedekten dönüş, özel alan adına geçiş |
| F15.8 | Lansman: `VITE_COMING_SOON=false`, deploy, `CHANGELOG`, `v1.0.0` etiketi (onaylı)                                                                                                                                                                                                                                                                          |

**Testler:**

- `quality-gate` skill'i eksiksiz.
- Lighthouse CI eşikleri.
- `smoke-prod` yeşil.
- Gerçek cihaz kontrol listesi (önizleme cihazı bayrağıyla; olaylar `is_preview`): Android
  telefon ve tablet, iPhone ve iPad. Kontrol edilenler:
  - Kurulum, karşılama, kamera ile QR ve uygulama içi QR okutma, basılı etiket okuma mesafesi.
  - Kâşif kartı QR'ıyla başka cihazda devam; iOS Safari ile kurulu PWA arasında geçiş.
  - Uçak modu, TTS, YouTube ve MP4 video kartları.
  - Merkez cihazı modu.

---

### F16 — v2 yol haritası (öncelik sırasıyla)

1. Yeni hazır sahneler (uzay, elektrik, su döngüsü, insan vücudu) ve maskot pozları
2. Öğretmen/sınıf modu: eğitmen hesabı, sınıf için toplu Kâşif kartı basımı, sınıf bazlı
   raporlar
3. Ücretli AI sağlayıcısı (Gemini ücretli katmanı ya da Claude API), `AiProvider` adapter'ı ile
4. Çok kurumlu yapı UI'ı (şema F4'te hazır) ve beyaz etiket
5. Çok dilli içerik
6. Tarayıcıda ses kaydı (MediaRecorder; iOS/Android format uyumluluğu çözüldükten sonra)
7. Serbest sahne düzenleyici (AI SVG'yi görsel olarak düzenleme)
8. Realtime "şu an merkezde" haritası

---

## 7. Test özeti

| Seviye               | Araç                                                | Ne zaman                                   | Hedef                                                                   |
| -------------------- | --------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| Şema ve sözleşme     | Vitest                                              | Her commit                                 | Şemalar, şablonlar, örnekler, olay şemaları; `entities/**` branch ≥ %90 |
| Port sözleşmeleri    | Vitest `*.contract.ts`                              | Her commit (mock) · CI (Supabase)          | İki adapter'ın aynı davranması                                          |
| Birim ve bileşen     | Vitest + RTL + MSW                                  | Her commit                                 | Dört durum; global ≥ %70; `progress`, `activity`, `kit-player` ≥ %85    |
| Veritabanı güvenliği | pgTAP                                               | CI                                         | RLS + GRANT + Storage matrisi                                           |
| Edge Function        | `deno test`                                         | CI                                         | publish-kit, admin-users, ai-generate (fake), SVG temizleme             |
| Performans (DB)      | pgTAP/perf script'i                                 | CI (haftalık)                              | Analitik RPC'leri < 500 ms, 200 bin olayda                              |
| E2E mock             | Playwright (7 cihaz profili)                        | Yerel + CI                                 | Kâşif, Studio, yolculuklar, a11y                                        |
| E2E Supabase         | Playwright + yerel Supabase                         | CI                                         | Studio, yolculuklar, çevrimdışı, anonim oturum                          |
| Yapay zekâ kalitesi  | 20 örnekli değerlendirme seti                       | Elle, onaylı (canlı Gemini, ücretsiz kota) | Sözleşmeye uyum, görsel kalite, bilimsel doğruluk                       |
| Güvenlik (CSP)       | Meta CSP + `noPageErrors`                           | F0.9'dan itibaren her E2E                  | CSP ihlali yok; bundle'da anahtar yok                                   |
| Performans (web)     | Bundle bütçesi + Lighthouse CI + CDP kurulabilirlik | F15'ten itibaren                           | Eşikler                                                                 |
| Canlı duman testi    | `smoke-prod`                                        | Gece                                       | Salt okunur                                                             |
| Gerçek cihaz         | Kontrol listesi                                     | Her kilometre taşında                      | Android/iOS, QR, çevrimdışı, TTS                                        |

- **Kapsam dışı dosyalar:** `*.contract.ts`, `*.supabase.ts` (quality işinde çalışmaz) ve `/_tasarim`
  vitrini kapsam hesabından çıkarılır.
- **Birleştirmeyi engelleyen yolculuklar:** `create-publish-play`, `editor-review`, `qr-scan`,
  `scan-to-dashboard`, `member-restore`. Hepsi iki arka uçta çalışır.

---

## 8. Riskler

| Risk                                                        | Olasılık | Etki   | Önlem                                                                                                                                                                                             |
| ----------------------------------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tek ortamda hatalı migration                                | Düşük    | Yüksek | §3.10: 3 tur plan, CI provası, dry-run, onaylı workflow, şifreli yedek, yalnızca ekleyici değişiklik                                                                                              |
| KVKK: çocuk verisinin hukuki uygunluğu (rıza ekranı yok)    | Orta     | Yüksek | Takma ad, veri minimizasyonu, saklama/silme, erişim için dışa aktarma; **işleme dayanağı, aydınlatma, yurt dışı aktarım ve VERBİS F12 kapı şartı**; gerekirse eğitmen onayı adımı bayrakla açılır |
| Gemini koşulları: 18 yaş / çocuklara yönelik hizmet maddesi | Yüksek   | Yüksek | F0.10 hukuk görüşü; olumsuzsa `AI_PROVIDER=off`, platform AI'sız tam çalışır; sağlayıcıdan bağımsız katman (v2'de ücretli sağlayıcı)                                                              |
| Ücretsiz katmanda içerik Google tarafından kullanılır       | Kesin    | Düşük  | Yalnızca kart içeriği gönderilir; kişisel veri yok; PII deseni filtresi; uyarı notu                                                                                                               |
| AI animasyon kalitesi/süresi beklentiyi karşılamaz          | Orta     | Orta   | F0 spike'ı ve git/gitme kararı; hazır sahne ve video alternatifi; kapsamı metin ve ikonla daraltma seçeneği                                                                                       |
| Ücretsiz AI kotası yetersiz ya da değişir                   | Orta     | Orta   | Uygulama içi günlük sınır, varsayılan 1 öneri, hafif modele düşme, AI Studio'dan izleme; gerekirse ücretli katman (aynı anahtar)                                                                  |
| Gemini model adları değişir                                 | Yüksek   | Düşük  | Model adı secret'ta, kodda sabit değil; üç ayda bir kontrol                                                                                                                                       |
| Test/deneme verisinin canlıya karışması                     | Düşük    | Orta   | Mock varsayılan; localhost korumaları; "CANLI ORTAM" bandı; önizleme cihazı + `is_preview`; deneme kiti yok                                                                                       |
| Mock ile Supabase davranışlarının ayrışması                 | Orta     | Orta   | Aynı sözleşme paketleri ve aynı E2E spec'leri iki arka uçta                                                                                                                                       |
| Veritabanı dolar (olay hacmi, auth şeması)                  | Orta     | Yüksek | 60 günlük ham olay, toplamlar, boyut formülü (≈ 400 B/olay + auth), pano uyarısı, `quota-check`, otomatik saklama kısaltma                                                                        |
| Çıkış trafiği kotayı tüketir                                | Orta     | Yüksek | Trafik formülü, video yalnızca URL, görsel ≤ 150 kB, ses ≤ 1 MB, artımlı yedek, B planı (Pages)                                                                                                   |
| Deploy/sürüm kayması (frontend DB'den önce çıkar)           | Orta     | Yüksek | `schema_version()` kapısı, geriye uyumlu RPC'ler, `minAppVersion`, Kâşif SW'sinin kendiliğinden güncellenmesi                                                                                     |
| Kâşif kodu tahmin edilir ya da kaybolur                     | Düşük    | Orta   | ≈ 40 bit, özet saklanır, uid+IP hız sınırı; "Kodumu yenile"; kayıpta admin detay sayfasından yeni kod                                                                                             |
| Admin 2FA cihazını kaybeder                                 | Orta     | Yüksek | En az 2 admin; onaylı `admin-mfa-reset` workflow'u + runbook                                                                                                                                      |
| Ortak github.io kökeni                                      | Kesin    | Orta   | Güven varsayımı ADR'de, anahtar önekleri, personel oturumu `sessionStorage`'da, önbellek onarımı, özel alan adı seçeneği                                                                          |
| iOS'ta QR → Safari; Safari 7 gün veri silme                 | Kesin    | Orta   | Uygulama içi okuyucu birincil yol; Safari'de ipucu; üyelik Supabase'de, Kâşif koduyla geri giriş; `storage.persist()`                                                                             |
| Anonim giriş istismarı (CAPTCHA yok)                        | Düşük    | Orta   | Hız sınırları, RPC doğrulaması, uid kotası, anonim kullanıcı temizliği, büyüme izleme; gerekirse Turnstile                                                                                        |
| Free proje duraklar / zamanlanmış işler durur               | Orta     | Yüksek | Keep-alive, uptime izleyici, aylık elle kontrol runbook'u, SW önbelleği                                                                                                                           |
| Edge Function 150 sn sınırı                                 | Orta     | Orta   | 120 sn kesme, SVG sınırı, `thinking_level` ayarı, spike ölçümü                                                                                                                                    |
| Tahmin: ~123 gün tek geliştiriciyle uzun                    | Orta     | Orta   | %15 tampon dahil; kilometre taşları bağımsız değer üretir; F9 ve F14 gerekirse ikinci geliştiriciye paralellenebilir                                                                              |

---

## 9. Açık sorular (varsayılan kararlarla)

| #   | Soru                                                                                           | Varsayılan (itiraz edilmezse geçerli)                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Gemini API anahtarı** (F0.11 spike'ı ve canlı için)                                          | Kullanıcı Google AI Studio'da oluşturur ve yalnızca Supabase secret'ı `GEMINI_API_KEY` olarak girer; spike'ta yalnızca kendi kabuğunda ortam değişkeni |
| 2   | Gemini 18 yaş maddesi hukuk görüşü                                                             | Kurum hukuk birimi F0.10'da; görüş gelene kadar F9 bekler, olumsuzsa AI kapalı                                                                         |
| 3   | Günlük ziyaretçi ve yeni cihaz oranı (DB ve trafik boyutlandırması)                            | 300 çocuk/gün, %50 yeni cihaz; ham olay saklama 60 gün                                                                                                 |
| 4   | KVKK işleme dayanağı ve aydınlatma metni (rıza ekranı yok)                                     | Teknik taslağı biz hazırlarız; kurumun KVKK sorumlusu dayanağı belirler ve onaylar (F12 şartı)                                                         |
| 5   | Eğitmen kim?                                                                                   | Bilim merkezi görevlisi (Studio personeli); ayrı eğitmen/öğretmen hesabı v2                                                                            |
| 6   | Video kaynakları                                                                               | YouTube bağlantısı önerilir; MP4 yalnızca `https:` bağlantısıyla                                                                                       |
| 7   | Özel alan adı                                                                                  | Şimdilik github.io; geçiş yolu açık (QR'lar çalışmaya devam eder), karar F12'den önce                                                                  |
| 8   | Studio'daki buton metni: "Yeni Kâşif Kiti" mi, "Yeni Kâşif" mi? (çocuklara da "kâşif" deniyor) | "Yeni Kâşif Kiti"                                                                                                                                      |
| 9   | Canlı ortam kapısının zamanı                                                                   | M2'den hemen sonra (admin lansmandan önce içerik üretir)                                                                                               |

---

## 10. Çalışma şekli

- **Dal ve commit:** Her faz ayrı dalda (`feat/f5-kasif-experience`). Adımlar Conventional Commits
  ile işlenir.
- **Faz sonu:** `quality-gate` skill'i ve `code-reviewer` ajanı. Arayüz fazlarında `ui-designer` ve
  `accessibility-auditor`. F3, F4, F9, F12 ve F15'te `security-auditor`.
- **Ajan ve skill eşlemesi:**

  | Faz            | Ajan ve skill'ler                                                       |
  | -------------- | ----------------------------------------------------------------------- |
  | F0, F4         | `frontend-architect`, `security-auditor`                                |
  | F1             | `ui-designer`, `premium-ui`, `frontend-design`, `new-component`         |
  | F2, F3         | `new-feature` şablonu, `test-engineer`                                  |
  | F5–F8, F10–F11 | `senior-frontend-engineer`, `new-page`, `api-endpoint`, `test-engineer` |
  | F9             | Gemini API dokümanı (ai.google.dev), `security-auditor`                 |
  | F14            | `dataviz`, `performance-engineer`                                       |
  | F15            | `performance-engineer`, `accessibility-auditor`, `quality-gate`         |

- **Her adımın Definition of Done'u:**
  - Katı tipler, `any` yok.
  - Birim testleri dört durumu kapsıyor.
  - E2E spec'i ve a11y girişi var.
  - Veri erişimi varsa sözleşme testi var.
  - `npm run validate` ve `npm run build` yeşil.
  - Mimari karar varsa ADR yazıldı.
  - Arayüz metni Türkçe, kod İngilizce.
- **Canlı Supabase'e ve gerçek Gemini API'sine dokunan her iş** yalnızca onaylı workflow ya da açık
  kullanıcı onayıyla yapılır. Claude canlı ortama komut, SQL, seed ya da test çalıştırmaz ve
  `GEMINI_API_KEY`'i hiçbir dosyaya, loga ya da commit'e yazmaz; anahtarı kullanıcı kendisi girer.
