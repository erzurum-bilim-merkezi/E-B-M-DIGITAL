# 0019. Sürüm uyumluluğu, deploy sırası ve service worker güncellemesi

- **Durum:** Kısmen uygulandı (2026-09-25): deploy sırası ve `schema_version()` kapısı; service worker `prompt` güncellemesi F13'te
- **Tarih:** 2026-09-24

## Karar (önerilen)

- Deploy yalnızca canlı `schema_version()` beklenen sürümdeyse yapılır; katalog `minAppVersion`
  taşır.
- Bugün: service worker `autoUpdate`, `cacheId: 'kasif'`, `cleanupOutdatedCaches`. Açık bir sekme
  yeni deploy sonrası silinmiş bir parçayı isterse (`vite:preloadError`) sayfa bir kez yenilenir.
- Hedef (F13.4): `registerType: 'prompt'`; Kâşif'te yeni SW Bilim Merkezi'ne dönüşte etkinleşir,
  Studio'da güncelleme bildirimi gösterilir.
