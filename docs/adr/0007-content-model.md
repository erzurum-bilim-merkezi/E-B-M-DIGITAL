# 0007. İçerik modeli: 13 blok, görsel alan, sahne kütüphanesi, anlık görüntü yayını

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-24

## Bağlam

E-B-M referans deneyimindeki etkileşimler (dokun-keşfet, evre kaydırıcı, keşif butonları, deney…)
kod yazmadan Studio'da üretilebilmelidir. Basılı QR'lar yıllarca çalışmalı, yayınlanmış bir kit
editörde değişirken çocukların gördüğü içerik bozulmamalıdır.

## Karar

- **Kit belgesi** (`kitDocumentSchema`, `schemaVersion: 1`): kimlik (slug, QR öneki), tema, rozet,
  malzemeler, güvenlik notları ve 13 blok türünden kartlar (Zod ayrık birleşimi). Taslakta görseller
  isteğe bağlıdır; yayın doğrulaması (`validateKitForPublish`) engelleyici sorunları listeler.
- **Görsel alan**: kütüphane sahnesi (7 SVG sahne, durum başına kare), yapay zekâ sahnesi (durum
  başına temizlenmiş SVG, `<img>` ile), görsel ya da video URL'si.
- **QR kodları** `ÖNEK-NN` biçimindedir ve kitin hiç azalmayan `qrSequence` sayacından verilir;
  silinen kartın kodu başka karta verilmez. QR içeriği site kökü + `?q=KOD` olup çalışma anında
  `qr-index` ile çözülür (sıra ve ad değişiklikleri basılı etiketi bozmaz).
- **Yayın** değişmez anlık görüntüdür (`v{n}`): rezervasyon → anlık görüntü yazımı → sonlandırma;
  yarıda kalan yayın aynı sürümle yeniden denenebilir (idempotent). Katalog, qr-index ve `latest`
  işaretçisi sonlandırılmış sürümlerden üretilir.
- Eşzamanlı düzenleme `lockVersion` ile iyimser kilitlenir; otomatik kayıt 800 ms, IndexedDB yedeği.

## Sonuçlar

- Oynatıcı yalnızca yayınlanmış anlık görüntüyü okur; Studio önizlemesi taslağı etkinlik kaydetmeden
  gösterir. Şema değişiklikleri `migrate.ts` üzerinden sürümlenir.
