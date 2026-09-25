# 0013. Barındırma ve güvenlik: GitHub Pages, ortak köken, meta CSP, QR `?q=`

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-24

## Bağlam

Site GitHub Pages'te `/E-B-M-DIGITAL/` altında yayınlanır: HTTP başlığı tanımlanamaz, SPA yeniden
yazma yoktur ve aynı `github.io` kökeni org'daki diğer sitelerle paylaşılır.

## Karar

- **CSP tek kaynaktan**: `src/shared/config/csp.ts`. Build, CSP'yi `<head>`'de charset'ten hemen
  sonra `<meta>` olarak yazar; `npm run csp:nginx` aynı kaynaktan
  `docker/nginx/security-headers.conf`'u üretir (birim testi eşitliği denetler). Canlı arka uç kökeni
  her ikisinde de `CSP_BACKEND_ORIGIN` ortam değişkeninden eklenir.
  `script-src 'self'` (satır içi betik, eval ve WebAssembly yok; QR çözümleyici wasm eklenirse
  `'wasm-unsafe-eval'` onunla birlikte açılır), `style-src 'unsafe-inline'`
  (Radix/Sonner çalışma anında stil ekler; statik sitede nonce yok), `object-src 'none'`,
  `base-uri 'none'`, `frame-src https://www.youtube-nocookie.com`. `frame-ancestors` yalnızca
  başlıkla verilebilir (nginx).
- **Permissions-Policy** (nginx): `camera=(self)` — uygulama içi QR okuyucu.
- **QR içeriği** site kökü + `?q=KOD`: derin yollar Pages'te 404 döner (404.html yedeği uygulamayı
  yine açar). Özel alan adına geçişte basılı QR'lar çalışmaya devam eder.
- **Ortak köken**: org repoları güvenilir kabul edilir; tüm anahtarlar `kasif:` önekli; personel
  oturumu `sessionStorage`'da.
- **Gizli anahtarlar**: `VITE_*` değerleri bundle'a gömülür. `env.ts` yalnızca bilinen anahtarları
  okur; `vite.config.ts` gizli görünümlü `VITE_*` değişkenlerinde CI'da build'i kırar, yerelde uyarır.
- Coming-soon modunda Kâşif rotaları açılış sayfasını gösterir (okutulan QR kodu da yazılır);
  önizleme cihazı bayrağı (`kasif:preview:v1`) Kâşif'i açar. Mock Studio demosu hiçbir zaman
  yayınlanmaz; Studio coming-soon arkasında yalnızca canlı arka uçla çalışır.

## Sonuçlar

- E2E testleri Pages benzeri sunucuda (`scripts/pages-server.mjs`) ve CSP altında koşar; CSP ihlali
  konsol hatası olarak testi düşürür.
