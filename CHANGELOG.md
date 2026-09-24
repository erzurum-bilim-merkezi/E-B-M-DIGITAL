# Değişiklik günlüğü

Biçim [Keep a Changelog](https://keepachangelog.com/tr-TR/1.1.0/) standardını, sürümleme
[Semantic Versioning](https://semver.org/lang/tr/) kurallarını izler. Yeni sürüm yayınlamak için
bölüm eklenir, `package.json` sürümü güncellenir ve `vX.Y.Z` etiketi gönderilir; GitHub Release
otomatik oluşturulur.

## [Yayınlanmadı]

## [0.1.0] - 2026-09-24

İlk genel sürüm: altyapı hazır, site "Çalışmalar devam ediyor" moduyla yayında.

### Eklendi

- "Çalışmalar devam ediyor" açılış sayfası: Erzurum'un kış gecesini anlatan animasyonlu
  illüstrasyon (hareket azaltma tercihine duyarlı), açık/koyu temada WCAG 2.2 AA uyumlu.
- Coming-soon modu (`VITE_COMING_SOON`): geliştirme `main` üzerinde sürerken ziyaretçiler açılış
  sayfasını görür; lansman tek bir repo değişkeniyle yapılır.
- GitHub Pages yayını: yalnızca CI başarılı olduğunda çalışan deploy hattı, etiketle otomatik
  sürüm notları.
- Kurumsal uygulama altyapısı: katmanlı feature mimarisi ve sınır denetimi, tip güvenli API istemcisi,
  TanStack Query, env doğrulaması (build + çalışma zamanı), semantik design token'ları ve açık/koyu tema.
- Test altyapısı: Vitest + Testing Library + MSW, Playwright E2E ve erişilebilirlik testleri.
- Kalite kapıları: oxlint, Prettier, Husky, commitlint, GitHub Actions CI, Dependabot.
- Dağıtım alternatifi: çok aşamalı Docker imajı, root olmayan nginx, güvenlik başlıkları.
- Claude Code ortamı: CLAUDE.md, proje agent'ları ve skill'leri, resmi plugin'ler, biçimlendirme hook'u.
