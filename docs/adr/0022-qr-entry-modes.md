# 0022. QR giriş modları: "Bir QR yeter" ve "Her kart kendi QR'ı ile"

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-25

## Bağlam

Kullanıcı, kâşiflerin kite tek bir QR ile girip bütün kartları sırayla, başka QR okutmadan
tamamlayabilmesini istedi. Kartların ayrı QR'ı olmamalı. İstenen kitlerde her kartın kendi QR'ı
da seçenek olarak kalmalı.

## Karar

- Mod kit başınadır ve kit belgesindeki `qrEntryMode` alanında durur. Değer adları değişmedi,
  bu yüzden eski uygulamalar etkilenmez ve `MIN_APP_VERSION` artmadı.
- **`full` — "Bir QR yeter, sırayla devam" (yeni kitlerin varsayılanı):**
  - Kit QR'ı ilk bitmemiş kartı açar.
  - "Sıradaki kart" bir sonraki bitmemiş karta gider, sona gelince başa sarar.
  - Kit bitince tamamlandı sayfası açılır.
  - Studio'da QR sayfası, ZIP ve baskı şablonları yalnızca kit QR'ını üretir. Kart kodları iç
    kimlik olarak kalır (etkinlik kaydı, geriye dönük uyumluluk).
- **`focused` — "Her kart kendi QR'ı ile":**
  - Kart QR'ı yalnızca o kartı açar.
  - Kart bitince "Sıradaki kartın QR'ını okut" ve ilerleme gösterilir.
- **İki modda da:**
  - `kit_complete` kiti bitiren karttan gönderilir, rozet otomatik verilir.
  - Kit sayfasında "Başla / Kaldığın yerden devam et", ana sayfada "Devam et" gösterilir.

## Sonuçlar

- Kaldığın yerden devam, sunucudaki tamamlanan kartlardan hesaplanır; yeni bir alan gerekmedi.
- Basılı eski kart QR'ları çalışmaya devam eder; `full` kitte okutulan kart oradan sırayla
  devam eder.
