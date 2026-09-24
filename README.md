# E-B-M Digital — Erzurum Bilim Merkezi

[![CI](https://github.com/erzurum-bilim-merkezi/E-B-M-DIGITAL/actions/workflows/ci.yml/badge.svg)](https://github.com/erzurum-bilim-merkezi/E-B-M-DIGITAL/actions/workflows/ci.yml)
[![Deploy](https://github.com/erzurum-bilim-merkezi/E-B-M-DIGITAL/actions/workflows/deploy.yml/badge.svg)](https://github.com/erzurum-bilim-merkezi/E-B-M-DIGITAL/actions/workflows/deploy.yml)

Erzurum Bilim Merkezi'nin dijital platformu. Kurumsal ölçekte geliştirilen bir React tek sayfa
uygulaması (SPA): tip güvenli veri katmanı, zorlanan mimari sınırlar, otomatik kalite kapıları,
erişilebilirlik testleri ve Claude Code ile yapay zekâ destekli geliştirme ortamı.

İlk ürün **Kâşif**'tir: çocukların bilim merkezindeki deney kitlerinin QR kodlarını okutup etkileşimli
kartlarla keşfettiği PWA (`/`) ve kitlerin kodsuz tasarlanıp yayınlandığı, QR etiketlerinin basıldığı ve
etkinliğin izlendiği **Kâşif Studio** (`/studio`). Bugün tarayıcı içi bir deneme arka ucuyla çalışır
(ADR 0015); Supabase geçişi canlı ortam kapısıyla (F12) yapılacaktır. Teslim raporu ve kullanım
kılavuzu: [docs/rapor/kasif-rapor.html](docs/rapor/kasif-rapor.html).

**Canlı site:** https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/ — şu an "Çalışmalar devam
ediyor" modunda.

## Teknoloji yığını

| Alan          | Seçim                                                          |
| ------------- | -------------------------------------------------------------- |
| UI            | React 19, TypeScript 6 (strict)                                |
| Build         | Vite 8, PWA (vite-plugin-pwa)                                  |
| Routing       | React Router 8 (data router, route bazlı lazy loading)         |
| Sunucu durumu | TanStack Query 5                                               |
| Doğrulama     | Zod 4 (API yanıtları, env, formlar)                            |
| Stil          | Tailwind CSS 4 + semantik design token'ları (açık/koyu tema)   |
| Test          | Vitest 5, Testing Library, MSW, Playwright + axe (WCAG 2.2 AA) |
| Kod kalitesi  | oxlint, Prettier, mimari sınır kontrolü, Husky, commitlint     |
| Dağıtım       | Docker (non-root nginx, güvenlik başlıkları), GitHub Actions   |

## Gereksinimler

- Node.js **24+** ve npm **11+** (`.nvmrc` mevcut: `nvm use`)
- E2E testleri için Playwright Chromium: `npx playwright install chromium`
- Claude Code kullananlar için: `npm i -g typescript-language-server typescript` (LSP plugin'i için)

## Hızlı başlangıç

```bash
npm ci                          # bağımlılıklar + git hook'ları
cp .env.example .env.local      # yerel ayarlar (commit edilmez)
npm run dev                     # http://localhost:5173  (Kâşif: /, Studio: /studio)
```

Deneme ortamı ilk açılışta örnek içerik yükler. Studio deneme hesapları giriş ekranında yazar
(yönetici: `yonetici@kasif.dev` / `Kasif.Studio.2026` + ekrandaki deneme doğrulama kodu; editör:
`editor@kasif.dev` / `Kasif.Editor.2026`).

## Komutlar

| Komut                     | Açıklama                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| `npm run dev`             | Geliştirme sunucusu                                                  |
| `npm run build`           | Tip kontrolü + production build (`dist/`)                            |
| `npm run preview`         | Build çıktısını yerelde sunar (http://localhost:4173)                |
| `npm run validate`        | **Tam yerel kalite kapısı:** typecheck, lint, sınırlar, format, test |
| `npm test`                | Birim testler (watch)                                                |
| `npm run test:coverage`   | Birim testler + coverage raporu (`coverage/`)                        |
| `npm run test:e2e`        | Playwright E2E + erişilebilirlik (Pages benzeri sunucu, açık/koyu)   |
| `npm run lint:boundaries` | Katman/feature import kurallarını denetler                           |
| `npm run format`          | Prettier ile tüm kodu biçimlendirir                                  |

## Proje yapısı

```
src/
├── app/        # Uygulama kökü: provider'lar, router + korumalar, layout'lar, deneme verisi
├── pages/      # Route bileşenleri (ince): kids/ (Kâşif), studio/ (Kâşif Studio)
├── features/   # Dikey dilimler: api/ (port + mock adapter) components/ index.ts
├── entities/   # Saf alan modelleri (kit, explorer, activity, studio) — yalnızca zod
├── shared/     # Domain'den bağımsız: ui/ (ui/kid/) api/ config/ lib/ hooks/
└── test/       # Test kurulumu, render/uygulama/deneme arka ucu yardımcıları
e2e/            # Playwright: kids/ studio/ journeys/ a11y/ coming-soon/ + support/
docs/           # Mimari, tasarım sistemi, ADR'ler
docker/         # nginx yapılandırması ve güvenlik başlıkları
```

Bağımlılıklar yalnızca aşağı yönlüdür: `app → pages → features → entities → shared`. Ayrıntılar:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Referans feature: [src/features/health](src/features/health).

## Ortam değişkenleri

| Değişken            | Açıklama                                        | Varsayılan                  |
| ------------------- | ----------------------------------------------- | --------------------------- |
| `VITE_APP_NAME`     | Uygulama adı                                    | `Erzurum Bilim Merkezi`     |
| `VITE_APP_ENV`      | `development` \| `staging` \| `production`      | `development`               |
| `VITE_API_BASE_URL` | Backend API kök adresi (mutlak URL)             | `http://localhost:3000/api` |
| `VITE_COMING_SOON`  | `true` → tüm adresler açılış sayfasını gösterir | `false`                     |

Build ayarı olarak `BASE_PATH` (ör. `/E-B-M-DIGITAL/`) uygulamanın alt yolda sunulmasını sağlar.
Coming soon modunu yerelde görmek için: `.env.local` içinde `VITE_COMING_SOON=true`.

Değerler hem **build sırasında** hem uygulama açılışında Zod ile doğrulanır; hatalı değerle build
kırılır. `VITE_*` değişkenleri tarayıcı bundle'ına gömülür — **gizli bilgi koymayın.**

## Kalite kapıları

- **pre-commit:** değişen dosyalarda oxlint + Prettier (lint-staged)
- **commit-msg:** [Conventional Commits](https://www.conventionalcommits.org/) (commitlint)
- **pre-push:** typecheck + birim testler
- **CI (GitHub Actions):** typecheck, lint, sınırlar, format, coverage (%70 eşik), build, E2E +
  axe, `npm audit`

## Yayın

| Adım        | Nasıl çalışır                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Deploy      | `main`'e gelen her değişiklik CI'dan (E2E + erişilebilirlik dahil) geçerse GitHub Pages'e çıkar                                   |
| Coming soon | Canlı site `VITE_COMING_SOON` repo değişkeni `false` yapılana kadar açılış sayfasını gösterir                                     |
| Lansman     | Settings → Secrets and variables → Actions → Variables: `VITE_COMING_SOON=false`, ardından Deploy workflow'unu yeniden çalıştırın |
| Sürüm       | `CHANGELOG.md`'ye bölüm ekleyip `vX.Y.Z` etiketi gönderin; GitHub Release otomatik oluşur                                         |

## Docker

Kendi sunucunuzda yayın için (GitHub Pages özel HTTP başlıklarına izin vermez; CSP/HSTS için bu yol
önerilir):

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.example.com -t ebm-digital .
docker run -p 8080:8080 ebm-digital            # http://localhost:8080  (sağlık: /healthz)
# veya: docker compose up --build
```

İmaj root olmayan nginx ile çalışır; CSP ve güvenlik başlıkları
[docker/nginx/security-headers.conf](docker/nginx/security-headers.conf) içindedir; dosya
`src/shared/config/csp.ts`'den üretilir (`CSP_BACKEND_ORIGIN=… npm run csp:nginx`). İmaj varsayılan
olarak coming-soon modunda derlenir; deneme arka ucu hiçbir zaman canlı uygulama olarak sunulmaz.

## Claude Code ile geliştirme

Proje, yapay zekâ destekli geliştirme için hazır gelir. Kurallar [CLAUDE.md](CLAUDE.md) içindedir.

| Tür              | İçerik                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proje agent'ları | `senior-frontend-engineer`, `frontend-architect`, `ui-designer`, `code-reviewer`, `test-engineer`, `accessibility-auditor`, `security-auditor`, `performance-engineer` |
| Proje skill'leri | `/new-feature`, `/new-page`, `/new-component`, `/api-endpoint`, `/add-env-var`, `/premium-ui`, `/quality-gate`                                                         |
| Resmi plugin'ler | `frontend-design`, `feature-dev`, `pr-review-toolkit`, `commit-commands`, `claude-md-management`, `skill-creator`, `typescript-lsp`, `playwright`, `context7`          |
| Hook'lar         | Claude'un düzenlediği her dosya otomatik Prettier'dan geçer                                                                                                            |
| İzinler          | `.env` dosyalarını okuma/yazma engelli; `git push`, repo/PR oluşturma onay ister                                                                                       |

Plugin'ler `.claude/settings.json` üzerinden tanımlıdır; repoyu Claude Code'da ilk açtığınızda kurulum
için onay istenir.

## Dokümantasyon

- [Mimari](docs/ARCHITECTURE.md) · [Tasarım sistemi](docs/DESIGN_SYSTEM.md) · [ADR'ler](docs/adr/)
- [Katkı rehberi](CONTRIBUTING.md) · [Güvenlik politikası](SECURITY.md) · [Değişiklik günlüğü](CHANGELOG.md)
