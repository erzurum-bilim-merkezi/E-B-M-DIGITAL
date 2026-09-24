# 0008. Animasyon: CSS + WAAPI, azaltılmış hareket zorunlu

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-24

## Bağlam

Çocuk arayüzü canlı olmalı; ancak WCAG 2.2.2 (5 sn'yi aşan hareket durdurulabilmeli) ve 2.3.3
(hareket kaynaklı animasyonlar) karşılanmalı, düşük donanımlı tabletlerde akıcı kalmalıdır.

## Karar

- Animasyon kütüphanesi yok: CSS anahtar kareleri ve SVG `animate`; sahneler `SceneProps`
  (`paused`, `reducedMotion`) alır.
- `prefers-reduced-motion` ve Kâşif'in "Animasyonları azalt" ayarı sahneleri en bilgilendirici
  durağan karede dondurur, konfeti ve süs döngülerini kapatır (`kid-ambient`).
- 5 sn'yi aşan her döngü (yalnızca `animated: true` sahneler) bir duraklat düğmesiyle gelir.

## Sonuçlar

- Paket boyutu küçük kalır; sahneler tembel yüklenen ayrı parçalardır (`SCENE_COMPONENTS`).
