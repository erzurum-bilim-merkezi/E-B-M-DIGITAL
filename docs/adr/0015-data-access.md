# 0015. Veri erişimi: port/adapter ve mock arka uç

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-24

## Bağlam

Supabase şeması ve canlı ortam kapısı (F4/F12) tamamlanmadan tüm ürün geliştirilip test
edilebilmelidir; sunucu kuralları (roller, kotalar, iyimser kilit) UI'dan bağımsız doğrulanmalıdır.

## Karar

- Her özellik bir **port** (TypeScript tipi) tanımlar: `KitRepository`, `PublishingService`,
  `QrRegistry`, `ExplorerService`, `EventSink`, `AnalyticsReader`, `SettingsService`, `AiProvider`…
- **Mock adapter'lar** tarayıcıda çalışır: `localStorage` tabloları (`kasif:mockdb:v1:*`, her okumada
  Zod ile doğrulanır), `IndexedDB` blobları (`mock-media:<id>`), `mockGate` ile gecikme / tek seferlik
  hata / bekletme (test kontrolleri), RLS benzeri politika denetimleri (`requireStaff`,
  `requireDevice`) ve denetim kaydı.
- TanStack Query yalnızca port'ları çağırır (`queryOptions` fabrikaları, `studio`/`kids` kökleri);
  kalıcı hatalar (izin, doğrulama, çakışma) yeniden denenmez.
- Sayfalar özellikleri birleştirir: kart editörü medya kütüphanesini, yapay zekâyı ve oynatıcı
  önizlemesini `EditorServicesProvider` ile alır; özellikler birbirinin iç dosyalarına bakmaz.

## Sonuçlar

- `BACKEND_MODE` tek bir anahtardır; Supabase adapter'ları aynı port'ları uygulayacaktır.
- E2E ve demo verisi aynı mock servisler üzerinden seed edilir, böylece aynı kurallara uyar.
