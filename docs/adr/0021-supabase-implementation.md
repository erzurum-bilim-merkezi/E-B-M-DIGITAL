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
