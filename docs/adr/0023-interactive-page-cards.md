# 0023. Etkileşimli sayfa kartı: yapay zekâ ile three.js sayfası ya da hazır bağlantı

- **Durum:** Kabul edildi
- **Tarih:** 2026-10-05
- **Karar vericiler:** Serdar Kul

## Bağlam

“Yeni Kâşif Kiti” sihirbazına bir seçenek daha istendi. Editör, yapay zekâya three.js ile bir
HTML sayfası tasarlatabilmeli ya da hazır bir bağlantı verebilmeli. Çocuk da bu sayfayı Kâşif'te
açıp keşfedebilmeli.

Kısıtlar:

- Site `github.io` kökenini başka sitelerle paylaşır. Çocuğun cihaz oturumu `localStorage`'dadır
  (ADR 0013, 0017).
- Ana CSP satır içi betiğe izin vermez (`script-src 'self'`).
- Çocuklara üçüncü taraf betik yüklenmez.
- Taslak kit veritabanında 1 MiB ile sınırlıdır (`assert_draft`).
- Yapay zekâ çağrısı Edge Function'ın süresine sığmalıdır.

## Değerlendirilen seçenekler

1. **Yeni kit türü.** Kit belgesine, kataloğa ve tablolara bir tür alanı eklenir. QR, ilerleme,
   rozet ve yayın her tür için ayrı ayrı ele alınmak zorunda kalır.
2. **Yeni kart türü.** QR, ilerleme, rozet, sürüm ve yayın olduğu gibi çalışır. Sayfa başka kitlere
   de kart olarak eklenebilir.
3. **Sayfayı `srcdoc` ya da `blob:` çerçevesinde çalıştırmak.** Bu çerçeveler ana sayfanın CSP'sini
   devralır, satır içi betik çalışmaz. CSP'yi gevşetmek ise tüm uygulamayı zayıflatır.
4. **Ayrı bir koşturucu sayfa.** Uygulamanın yanında duran ayrı bir dosyadır ve kendi CSP'si vardır.

## Karar

### Model

- Yeni kart türü `interactive-page`. Alanları `instructions` ve `source` (`html` | `url`).
- HTML sayfa başına en fazla 40.000, kit başına toplam 240.000 karakterdir (`MAX_PAGE_HTML`,
  `MAX_KIT_PAGE_HTML`).
- Sihirbazdaki “Etkileşimli sayfa” seçeneği tek kartlık bir kit oluşturur (şablon `page`).
- Yapay zekâ ile üretilen sayfa `aiGenerated.fields` içinde `page` ile işaretlenir. Yayında
  “bilimsel doğruluğu kontrol ettim” onayı istenir.

### HTML sayfası

- **Koşturucu:** `page-runner.html` (`src/shared/config/page-runner.ts`) içinde çalışır.
- **Koşturucunun kendini koruması:** dosya herkese açık ve uygulamanın (paylaşılan github.io)
  kökeninde duruyor. Başka bir site onu sandbox'sız çerçeveleyip bir sayfa gönderirse, o sayfa
  Kâşif'in kökeninde çalışırdı (güvenlik denetimi, kritik). Koşturucu bu yüzden yalnızca opak
  kökendeyken (`self.origin === 'null'`) ve yalnızca bu sitenin kökeninden gelen mesajla çalışır.
  E2E bunu gerçek tarayıcıda sınar: koruma kaldırılınca test düşer.
- **Sandbox:** çerçeve `sandbox="allow-scripts"` ile açılır, **asla** `allow-same-origin` almaz.
  Sayfa opak bir kökende çalışır; Kâşif'in belgesine ve depolamasına erişemez.
- **Koşturucunun CSP'si:** `default-src 'none'`, `connect-src 'none'`. Betikler yalnızca satır içi
  ve `blob:` olabilir. Görsel, yazı tipi ve medya yalnızca `data:`/`blob:` olabilir. Çerçeve, form
  ve eklenti yoktur. DNS önceden çözümleme kapalıdır. nginx'te `frame-ancestors 'self'` ve
  `X-Frame-Options SAMEORIGIN` eklenir.
- **Ağ: fetch, XHR, WebSocket ve dış kaynak kapalı, ama “tamamen kapalı” değil.** CSP'nin
  kapatamadığı iki yol kalır:
  - Çerçevenin kendini bir `https` adrese götürmesi. Ana CSP'nin `frame-src 'self' https:` kuralı
    buna izin verir; aşağıdaki tespit katmanı çerçeveyi o anda kaldırır, ama giden ilk istek gider.
  - WebRTC. Tarayıcıların çoğu `webrtc` CSP yönergesini desteklemiyor.
    Bu yollar, gizlenmiş kodla `checkPageHtml`'den geçebilir. Kalan risk bilinçli kabul edildi:
    sayfaları yalnızca personel yazar ya da onaylar. Yapay zekâ çıktısı yayından önce önizlenir.
    Sayfa opak kökende olduğu için ulaşabileceği bir Kâşif verisi yoktur. Daha sıkı bir seçenek
    (koşturucunun sayfayı `frame-src 'none'` altında ikinci bir sandbox çerçevesinde çalıştırması)
    izleyen iş olarak duruyor.
- **three.js:** r186 ve OrbitControls build sırasında tek, küçültülmüş bir modüle dönüştürülür
  (`page-runtime/three-<sürüm>.js`, gzip'le yaklaşık 220 KB).
  - Uygulama bu modülü kendi kökeninden `apiClient` ile alır ve koşturucuya mesajla verir.
  - Koşturucu modülü bir `blob:` adresine çevirir ve import map ile sayfaya sunar.
  - CDN, CORS ya da sandbox içinde `'self'` belirsizliği yoktur.
  - Modül her cihaza ön-önbelleklenmez, ilk kullanımda önbelleğe alınır.
- **Çerçevenin başka adrese gitmesi:**
  - Koşturucu çerçevesi Chromium ve WebKit'te tam iki kez yüklenir: önce koşturucu, sonra onun
    üzerine yazılan sayfa (2026-10-05 deneyi).
  - Üçüncü bir yükleme, sayfanın çerçevesini başka bir adrese götürdüğü anlamına gelir. Uygulama
    o anda çerçeveyi kaldırır ve “Bu sayfa kapatıldı” der.
  - Ana CSP'deki `frame-src 'self' https:`, çerçevenin `data:`, `blob:` ya da `http:` adreslere
    gitmesini zaten engeller.
- **Denetim katmanları:** `checkPageHtml` üç yerde çalışır: yapay zekâ çıktısı için Edge Function'da,
  her sayfa için Studio'da ve Kâşif oynatıcısında (yayın RPC'si sayfayı denetlemediği için). Dış
  adres, bağlantı, form, iframe, ağ ve depolama API'leri, yönlendirme, `eval`, Kâşif'e erişim ve
  izin listesi dışı `import` içeren sayfayı **reddeder, düzeltmez** (SVG politikasıyla aynı,
  ADR 0018).

### Bağlantı

- Yalnızca `https` kabul edilir; uygulamanın kendi kökeni reddedilir (Studio'da ve oynatıcıda).
- Çocuk dokunana kadar siteden hiçbir şey istenmez.
- Çerçeve `allow-scripts allow-same-origin` ile açılır: açılır pencere, form ve üst sayfa
  yönlendirmesi yoktur, `referrer` gönderilmez.
- Çerçeve `credentialless` yüklenir. Chromium'da site önceki çerez ve depolamasını göremez,
  sonrasına da bir şey bırakamaz. Sitenin kendi tam ekran izni yoktur; tam ekranı Kâşif'in düğmesi
  yönetir. Sitenin alan adı çerçevenin üstünde yazar.
- Bağlantılı site, kendi içinden başka https sitelerine gidebilir. Bunu yalnızca onaylı bir site
  listesi kapatır (`frame-src` ve `checkPageUrl` aynı listeyi kullanır). Bu bir ürün kararıdır ve
  sahibine soruldu; karar gelene kadar herhangi bir https sitesi kabul edilir.
- Yayında, sitenin çocuklara uygun ve reklamsız olduğunu hatırlatan bir uyarı gösterilir.
- Aydınlatma metnine genel bir madde eklendi.

### Diğer

- **Ana CSP:** `frame-src` artık `'self' https:`. Çerçeve izni bu belgeye betik hakkı vermez;
  sandbox öznitelikleri bileşenlerde sabittir.
- **Tamamlanma:** sayfa görününce “Keşfettim” düğmesi çıkar. Çapraz kökenli sayfada etkileşim
  ölçülemez; davranış YouTube'daki “İzledim” ile tutarlıdır.
- **Yapay zekâ:** `ai-generate` Edge Function'ına `page` eylemi eklendi
  (`maxOutputTokens: 16384`).
  - `ai_usage.kind` kısıtına `page` eklendi (migration `20261005120000`).
  - Sayfa üretimi günlük kotadan bir hak düşer. Denetimde reddedilen sayfa da düşer
    (`kind = 'page'`, `status = 'blocked'`): 16.384 token'a kadar harcar ve sık reddedilir, bir hesap
    ücretsiz katmanı herkes için tüketemesin. Diğer türlerde yalnızca başarılı üretim sayılır.
- **Sürüm:** `MIN_APP_VERSION` 1'den 2'ye çıktı. Kâşif düzeni (`useAppUpdateReload`) daha yeni bir
  uygulama isteyen kataloğu görünce, o sürüm için oturum başına bir kez yenilenir (ADR 0019).

## Sonuçlar

- Canlıya alma sırası: **DB migrate (live)**, ardından **Edge Functions deploy (live)**, ardından
  **Deploy**. Deploy, migration uygulanmadan zaten durur.
- Bu özellikten önce yayınlanmış ve açık kalmış eski bir Kâşif sekmesi yeni kart türünü
  ayrıştıramaz. Yenileme kancası bu sürümle geldiği için bu sekme bir kez elle yenilenmelidir.
  Service worker (`autoUpdate`) bir sonraki açılışta yeni sürümü zaten getirir.
- Bağlantıdaki sitenin çerçeve içinde açılmayı reddedip reddetmediği güvenilir biçimde
  algılanamaz. Studio önizlemesi bunu editöre gösterir.
- Sayfa dış veri kullanamaz (fetch ve dış kaynak kapalı). Gerekirse veri sayfanın içine yazılır.
