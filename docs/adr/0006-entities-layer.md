# 0006. `entities` katmanı ve saf modül kuralı

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-24

## Bağlam

Kit belgesi, QR kodları, olay şemaları ve rozet kuralları hem tarayıcıda (Kâşif, Studio) hem de
ileride Supabase Edge Function'larında (Deno) aynı şekilde doğrulanmalıdır. Bu kurallar React'e,
Vite'a ya da bir özelliğe (feature) bağlı olursa sunucuda yeniden yazılmaları gerekir.

## Değerlendirilen seçenekler

1. Kuralları `shared/` içine koymak — alan bilgisi (domain) "alan-bağımsız" katmana karışır.
2. Her özelliğin kendi modelini tutması — kit şeması Studio, oynatıcı ve analitikte çoğalır.
3. **Ayrı, saf bir `entities` katmanı** — yalnızca `zod` ve göreli `.ts` içe aktarmaları.

## Karar

Seçenek 3. Katman sırası `shared → entities → features → pages → app`. `entities/*` React, `@/`
takma adı ve `import.meta` kullanamaz; kardeş dosyaları açık `.ts` uzantısıyla içe aktarır.
`scripts/check-boundaries.mjs` bu kuralı ve katman yönünü CI'da denetler.

## Sonuçlar

- `entities/kit` (13 blok şeması, QR, doğrulama, yayın anlık görüntüsü, şablonlar, örnek kitler),
  `entities/explorer`, `entities/activity`, `entities/studio` Node'da da test edilebilir.
- Edge Function'lar aynı dosyaları Deno ile doğrudan içe aktarabilir (F4).
