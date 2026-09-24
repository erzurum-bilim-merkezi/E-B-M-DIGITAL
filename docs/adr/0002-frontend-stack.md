# 0002. Frontend teknoloji yığını

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-24

## Bağlam

SEO gerektirmeyen, oturum açılarak kullanılan kurumsal bir web uygulaması geliştiriyoruz. Öncelikler:
tip güvenliği, geliştirici hızı, test edilebilirlik, erişilebilirlik ve uzun vadeli bakım.

## Karar

| Alan          | Seçim                              | Gerekçe                                                         |
| ------------- | ---------------------------------- | --------------------------------------------------------------- |
| Çatı          | React 19 SPA + Vite 8              | SSR gereksinimi yok; en hızlı geliştirme döngüsü, basit dağıtım |
| Dil           | TypeScript 6, strict               | Hataları derleme anında yakalar                                 |
| Routing       | React Router 8 (data)              | Olgun, lazy route ve errorElement desteği                       |
| Sunucu durumu | TanStack Query 5                   | Önbellek, yeniden deneme, invalidation standardı                |
| Doğrulama     | Zod 4                              | Tek şemadan hem çalışma zamanı doğrulaması hem tip              |
| Stil          | Tailwind CSS 4 + token             | Tutarlılık, küçük CSS, tema desteği                             |
| Test          | Vitest, RTL, MSW, Playwright + axe | Vite ile yerel uyum; davranış odaklı testler                    |
| Lint          | oxlint + Prettier                  | ESLint'ten çok daha hızlı                                       |

## Sonuçlar

- oxlint, ESLint eklenti ekosisteminin tamamını sunmaz; mimari sınır kuralı bu yüzden özel bir script
  ile uygulanır ([ADR 0003](0003-feature-sliced-architecture.md)).
- SSR/SEO ihtiyacı doğarsa (ör. herkese açık pazarlama sayfaları) ayrı bir ADR ile React Router
  framework modu veya ayrı bir site değerlendirilir.
