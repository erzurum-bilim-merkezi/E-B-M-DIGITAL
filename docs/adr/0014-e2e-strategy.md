# 0014. E2E stratejisi

- **Durum:** Kabul edildi (mock arka uç); Supabase projeleri F4'te
- **Tarih:** 2026-09-24

## Karar

- Build'ler GitHub Pages benzeri statik sunucuda sunulur (`scripts/build-pages.mjs` +
  `scripts/pages-server.mjs`: alt yol, SPA yeniden yazma yok, bilinmeyen yolda `404.html` + 404).
- Projeler: `kids-mobile` / `kids-tablet` / `kids-desktop`, `studio-desktop`, `journeys`, `a11y`,
  `coming-soon` / `coming-soon-mobile`. Spec'ler taban yola göreli yol kullanır.
- `e2e/support/test.ts`: test başına tek seferlik **seed** (`window.__KASIF_E2E_SEED__`), personel
  oturumu enjeksiyonu (UI ile giriş yalnızca `studio/auth.spec.ts` ve `studio/admin.spec.ts`),
  `pageerror` + `console.error` + CSP ihlali testi düşürür, service worker kapalı. İki cihaz arası
  durum `exportState` / `importState` ile taşınır.
- Erişilebilirlik testleri `e2e/a11y/` klasöründedir (CLAUDE.md'deki "`e2e/a11y.spec.ts`'e ekle"
  kuralının yerine geçer): tüm rotalar, 13 kart türü, açık ve koyu tema, axe WCAG 2.2 AA.
- Canlıya test yazılmaz; `smoke-prod` salt okunur olacaktır (F12).
