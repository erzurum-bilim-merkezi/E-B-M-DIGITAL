# Katkı rehberi

## İş akışı

1. `main` her zaman yayına hazırdır. İşler kısa ömürlü dallarda yapılır:
   `feat/fatura-listesi`, `fix/login-yonlendirme`, `chore/deps-guncelleme`.
2. Küçük, odaklı PR'lar açın (ideal: < 400 satır değişiklik). PR şablonunu eksiksiz doldurun.
3. CI yeşil + en az bir onay olmadan birleştirme yapılmaz. Birleştirme yöntemi: **squash merge**.

## Commit mesajları

[Conventional Commits](https://www.conventionalcommits.org/) zorunludur (commitlint denetler):

```
feat(invoices): add filtering by status
fix(auth): keep return url after session refresh
refactor(shared/ui): extract field error component
```

Türler: `feat`, `fix`, `perf`, `refactor`, `style`, `test`, `docs`, `build`, `ci`, `chore`, `revert`.
Kırıcı değişiklikler için gövdeye `BREAKING CHANGE:` ekleyin. Commit mesajları İngilizce yazılır.

## Kod standartları

Kuralların tamamı [CLAUDE.md](CLAUDE.md) ve [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) içindedir. Öne
çıkanlar:

- Mimari sınırlar: `app → pages → features → shared`; feature'lar birbirine yalnızca `index.ts`
  üzerinden erişir (`npm run lint:boundaries` denetler).
- Tüm API çağrıları `apiClient` + Zod şeması ile yapılır; sunucu durumu TanStack Query'de tutulur.
- UI'da yalnızca semantik design token'ları kullanılır ([docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)).
- Erişilebilirlik (WCAG 2.2 AA) bir yayın şartıdır.
- `any`, `--no-verify`, test atlatma (`.skip`) ve kural kapatma ile "yeşile boyama" yapılmaz.

## Bitti tanımı (Definition of Done)

- [ ] `npm run validate` ve `npm run build` geçiyor
- [ ] Yeni/değişen davranış testlerle kapsanıyor (yükleniyor, boş, hata durumları dahil)
- [ ] UI akışları için E2E, yeni sayfalar için `e2e/a11y.spec.ts` güncellendi
- [ ] Açık ve koyu temada, mobil ve masaüstünde kontrol edildi
- [ ] Mimari bir karar alındıysa `docs/adr/` altına ADR eklendi
- [ ] Yeni env değişkeni `.env.example`, `env.schema.ts` ve `vite-env.d.ts` içinde tanımlı

## Bağımlılık eklemek

Yeni bir paket eklemeden önce: gerçekten gerekli mi (platform veya mevcut bağımlılık karşılıyor mu),
bundle boyutu, bakım durumu, lisans ve TypeScript desteği değerlendirilir. Mimariyi etkileyen
seçimler (state yönetimi, form kütüphanesi, UI kiti vb.) ADR ile kayda geçer.

## Kod inceleme

İnceleyen kişi doğruluk, mimari sınırlar, test kalitesi, erişilebilirlik ve güvenliğe bakar; yorumlar
**Blocker / Should fix / Nit** olarak etiketlenir. Claude Code kullanıyorsanız PR öncesinde
`code-reviewer` agent'ı veya `/pr-review-toolkit:review-pr` ile ön inceleme yapabilirsiniz.
