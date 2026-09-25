# 0021. Supabase uygulaması: plandan farklar ve kesinleşen kararlar

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-25

## Bağlam

F4'te Supabase şeması, RLS, RPC'ler, Edge Function'lar ve adapter'lar yazıldı. Planın §3.9 taslağı
mock arka ucun gerçek davranışıyla karşılaştırıldı. İki kaynağın ayrıştığı yerlerde **mock'un
test edilmiş davranışı** esas alındı; plandan ayrılan kararlar burada kayıtlıdır.

## Karar

- **Veri modeli mock'u izler:**
  - `explorer_secrets` ayrı tablodur: Kâşif kodu özeti, `explorers` üzerindeki hiçbir politikayla
    okunamaz.
  - `qr_prefix_reservations` eklendi: bir QR öneki yeniden adlandırma ya da silmeden sonra da başka
    kite verilmez.
  - `app_settings` tek bir JSON belgesidir (`AppSettings`).
  - Merkez tableti **tek koltukludur** (ADR 0009); planın "sınırsız" ifadesi geçersizdir.
- **Yazma yalnızca RPC ile:**
  - `anon` rolünün hiçbir tabloda yetkisi yoktur.
  - Oturumlu kullanıcılar yalnızca RLS altında okur; her yazma `security definer` bir RPC'den geçer.
  - Yardımcı fonksiyonlar dışarı açılmayan `private` şemasındadır. `PUBLIC`'in fonksiyon
    çalıştırma yetkisi global olarak geri alınmıştır.
  - Hatalar `KSxxx` SQLSTATE kodlarıyla döner ve adapter'da `AppError`'a çevrilir.
  - Deneme sayacı tutan RPC'ler (Kâşif kodu, PIN, kurulum kodu, mevcut parola) hatayı değer
    olarak döndürür; sayaç böylece geri alınmaz.
- **Geçici parola:** Değiştirilene kadar personel verisine erişim kapalıdır
  (`private.staff_role()`); mock'un kuralıyla aynıdır.
- **Yayın akışı Edge Function değil, admin'in Studio'sudur:**
  - Adımlar: kiralama, sürüm ayırma, değişmez `v<n>.json`, kesinleştirme, ardından katalog,
    QR dizini ve `latest.json`'ın veritabanından yeniden üretilmesi.
  - Kesilen yayın aynı sürüm numarasıyla tamamlanır.
  - Doğrulama aynı `entities/kit` koduyla yapılır.
  - `published` klasörüne yalnızca 2FA'lı admin yazabilir. Admin zaten en yetkili roldür.
  - Bir Edge Function ve deploy adımı eksilir.
- **Edge Function'lar** yalnızca sunucu gerektiren işler içindir:
  - `admin-users`: Auth yönetim API'si. Veritabanı adımlarını admin'in kendi JWT'siyle çalıştırır.
  - `ai-generate`: Gemini anahtarı sunucudadır.
  - `entities` modeli Deno'ya kopyalanır (`npm run sync:edge`); CI kopyanın güncel olduğunu
    denetler.
- **Analitik** v1'de ham olaylardan RPC'lerle hesaplanır; günlük özet tablosu ve saatlik
  toplama v2'ye kalır. Bir test paketi her RPC'yi aynı satırlar üzerinde mock'un saf
  hesaplamalarıyla karşılaştırır.
- **Oturum kilidi:** Supabase Auth hesap bazlı kilit sunmaz. Giriş denemeleri GoTrue'nun IP
  sınırlarıyla sınırlanır; admin için TOTP zorunludur. Mevcut parola kontrolü ve Kâşif kodu ise
  kendi 5 hata / 15 dakika kilidini uygular (IP başına ek sınır).
- **Yapay zekâ çizimleri ayrı `ai` bucket'ındadır:**
  - Yalnızca `ai-generate` fonksiyonu servis rolüyle yazar. Personel kendi SVG'sini hiçbir
    bucket'a yükleyemez (`media` SVG kabul etmez).
  - Dosya yolları `scenes/<grup>/<durum>.svg` ve `icons/<id>.svg` biçimindedir.
  - `checkAiSvg` bir izin listesidir: yalnızca çizim öğeleri ve öznitelikleri kabul edilir.
    Ad alanı öneki, `xmlns:` bildirimi, DOCTYPE/ENTITY/CDATA ve dış bağlantı reddedilir. SVG
    doğrudan açılsa bile betik çalışamaz.
  - Kota, sağlayıcı çağrılmadan önce veritabanında tek adımda ayrılır (`ai_reserve`). Paralel
    istekler günlük sınırı aşamaz.
- **Arşivlenen kit adresinden açılmaz:** Yeniden üretim, arşivdeki kitin `latest.json` dosyasını
  siler; kit kataloğa ve QR dizinine "arşivde" olarak düşer. Değişmez `v<n>.json` dosyaları
  kalır. Adresleri tahmin edilebilir, ama hiçbir yerden bu dosyalara bağlantı verilmez.
- **Oturum anahtarları** `kasif:sb-auth:staff` ve `kasif:sb-auth:kid`'dir. Mock'un
  `kasif:auth:*` değerleri, mock sürümü çalıştırmış bir tablette supabase-js'e oturum diye
  verilmez.
- **Kâşif çevrimdışı da açılır:**
  - Kişisel cihazda üyeler, ilerleme ve rozetler `localStorage`'da saklanır
    (`kasif:kids-queries`). Anlık görüntü her derlemede geçersizleşir ve 30 günden eskisi silinir.
  - Merkez tabletinde ve Studio verisinde hiçbir şey saklanmaz. Kit dosyaları service worker
    önbelleğinden gelir.
  - Süresi dolmuş ama çevrimdışı yenilenemeyen cihaz oturumu "oturum yok" sayılmaz, ağ hatası
    sayılır. Ekrandaki üyeler ve ilerleme kalır, yeni bir anonim cihaz açılmaz.
- **Supabase Auth üzerinden yapılan doğrudan değişiklikler de kayda geçer:** Parola değişimi ve
  doğrulayıcı ekleme/silme `audit_log`'a yazılır. Bir hesapta en fazla 2 doğrulayıcı olabilir.
- **Bilinerek kabul edilen riskler (v2'de ele alınır):**
  - Kâşif kodu, PIN ve kurulum kodu tuzsuz SHA-256 özetiyle saklanır. Özetler yalnızca
    `security definer` fonksiyonlarca okunur; API'den hiçbir yolla dönmez. Denemeler 5 hata /
    15 dakika ile kilitlenir. Risk, ancak veritabanı dökümü sızarsa doğar: o durumda sızan
    zaten tüm veridir, kod yalnızca takma adlı bir üyeye cihaz bağlamaya yarar. Vault'ta
    saklanan bir sırla HMAC'e geçiş v2'ye kalır.
  - CAPTCHA kapalıdır. Uygulama henüz CAPTCHA jetonu göndermez; açılırsa çocuk cihazlarının
    anonim girişi bozulur. GoTrue'nun IP başına sınırları geçerlidir.
  - E-postayla kendi kendine kayıt kapatılamaz. Anonim giriş genel kayıt ayarına bağlıdır;
    Email sağlayıcısını kapatmak ise personelin e-posta + parola girişini de kapatır. Kaydolan
    yabancı hesap RLS nedeniyle hiçbir veri göremez. Personel hesapları yalnızca `admin-users`
    ile açılır. Bir personel e-postası önceden kaydedilmişse runbook'taki adım uygulanır.
  - 2FA sıfırlama ve oturum kapatma, hesabın yenileme oturumlarını hemen siler. Elde kalan
    erişim jetonu ise süresi dolana kadar (en çok 30 dakika, `jwt_expiry`) geçerlidir. Pasife
    alınan hesap bundan etkilenmez: her istekte `is_active_staff` denetlenir.
  - Depo herkese açık olduğu için Actions log'ları da açıktır. Canlı workflow'lara girilen
    e-posta ve ad, ilk adımda maskelenir; log'da `***` görünür.
- **Test yapısı:**
  - DB testleri PGlite'ta (Docker'sız) ve CI'da gerçek yerel yığında aynı paketle koşar.
  - Adapter'lar MSW ile birim testlidir.
  - Altın yolculuk CI'da yerel Supabase'e karşı çalışır. Canlı proje hiçbir testin hedefi olamaz;
    betikler localhost dışını reddeder.

## Sonuçlar

- `VITE_BACKEND=supabase` ile aynı arayüz canlı arka uçla çalışır. Mock yerel geliştirme, demo ve
  hızlı E2E için kalır.
- Canlıya uygulama `db-migrate` → `functions-deploy` → deploy sırasıyla yapılır. Deploy, canlı
  `schema_version()` depodaki son migration'dan geride ise durur.
