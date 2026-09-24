# 0003. Katmanlı, feature bazlı mimari ve sınırların zorlanması

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-24

## Bağlam

Teknik türe göre klasörleme (`components/`, `hooks/`, `services/`) büyüdükçe ilgili kodu dağıtır ve
bağımlılıkları görünmez kılar. Kurallar yalnızca dokümanda kalırsa zamanla aşınır.

## Karar

- Kod `app → pages → features → shared` katmanlarına ayrılır; bağımlılıklar yalnızca aşağı yönlüdür.
- Her feature kendi API katmanını, bileşenlerini ve hook'larını içerir; dışarıya yalnızca `index.ts`
  açılır.
- Kurallar [scripts/check-boundaries.mjs](../../scripts/check-boundaries.mjs) ile denetlenir ve
  `npm run validate` ile CI'ın parçasıdır.

## Sonuçlar

Feature'lar bağımsız geliştirilir, test edilir ve gerektiğinde bütün olarak silinebilir. İki feature
aynı koda ihtiyaç duyduğunda, kodun `shared/`'a taşınması veya birleştirmenin sayfada yapılması
gerekir — bu bilinçli bir sürtünmedir.
