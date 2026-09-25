# Mimari

## Katmanlar ve bağımlılık kuralı

```
┌──────────────────────────────────────────────┐
│ app       provider'lar · router · layout'lar  │
├──────────────────────────────────────────────┤
│ pages     route bileşenleri (ince)            │
├──────────────────────────────────────────────┤
│ features  dikey dilimler (iş yetenekleri)     │
├──────────────────────────────────────────────┤
│ entities  saf alan modelleri (zod)            │
├──────────────────────────────────────────────┤
│ shared    ui · api · config · lib · hooks     │
└──────────────────────────────────────────────┘
        bağımlılıklar yalnızca aşağı yönlü ↓
```

| Kural                                                             | Neden                                     |
| ----------------------------------------------------------------- | ----------------------------------------- |
| Bir katman yalnızca kendinden alttakileri import eder             | Döngüsel bağımlılık ve karmaşayı önler    |
| Feature dışından erişim yalnızca `@/features/<ad>` (index.ts) ile | Feature içi yapı özgürce değişebilir      |
| Feature'lar birbirinin iç dosyalarını import etmez                | Dilimler bağımsız geliştirilir ve silinir |
| `shared/` domain bilmez                                           | Gerçekten yeniden kullanılabilir kalır    |
| `entities/` saftır: yalnızca `zod` ve göreli `.ts` import eder    | Aynı kurallar Deno/Edge'de de çalışır     |

Bu kurallar `npm run lint:boundaries` ile CI'da zorlanır ([ADR 0003](adr/0003-feature-sliced-architecture.md)).

## Kâşif ürün haritası

| Katman     | İçerik                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `entities` | `kit` (13 blok, QR, doğrulama, yayın, şablonlar, örnek kitler) · `explorer` · `activity` · `studio`      |
| `features` | auth · studio-kits (editör) · media-library · ai-studio · kit-catalog · kit-player · explorer · activity |
|            | analytics · settings · qr-print · qr-entry · health (referans)                                           |
| `pages`    | `kids/` (Kâşif: `/`) · `studio/` (Kâşif Studio: `/studio`) · `coming-soon/`                              |
| `app`      | rotalar + korumalar, KidsLayout / StudioLayout, komut paleti, mock arka uç seed'i                        |

Veri erişimi özellik **port**'ları üzerindendir; bugün tarayıcıda çalışan mock adapter'lar kullanılır
([ADR 0015](adr/0015-data-access.md)). Kararların tamamı: [docs/adr](adr/).

## Bir feature'ın anatomisi

```
src/features/health/
├── api/health.api.ts        # Zod şeması, tipler, query key factory, fetcher, queryOptions
├── components/HealthStatus.tsx
├── components/HealthStatus.test.tsx
└── index.ts                 # public API
```

## Veri akışı

```
Bileşen ──useQuery(xQueryOptions())──► TanStack Query önbelleği
                                           │ (cache miss / stale)
                                           ▼
                                   apiClient.get(path, schema)
                                           │  auth header · timeout · JSON
                                           ▼
                                        fetch ──► Backend
                                           │
                             yanıt Zod ile doğrulanır (sınırda)
                                           ▼
                           tipi güvenli veri → önbellek → bileşen
```

- Yanıtlar **sınırda** Zod ile doğrulanır; uygulamanın geri kalanı tiplere güvenebilir.
- Hatalar `HttpError` (status + body) olarak fırlatılır. 4xx yeniden denenmez, 5xx/ağ hataları en fazla
  2 kez denenir ([query-client.ts](../src/shared/api/query-client.ts)).
- Kimlik doğrulama `setAccessTokenProvider()` ile bağlanır; `shared` katmanı auth feature'ını bilmez.

## Durum (state) yönetimi

| Durum türü                                      | Yer                         |
| ----------------------------------------------- | --------------------------- |
| Sunucu verisi                                   | TanStack Query              |
| Paylaşılabilir UI durumu (filtre, sayfa, sekme) | URL search params (Zod ile) |
| Yerel UI durumu                                 | `useState` / `useReducer`   |
| Global istemci durumu                           | Yalnızca ADR ile            |

## Hata yönetimi (üç katman)

1. **Uygulama:** `react-error-boundary` — beklenmeyen render hataları ([AppProviders](../src/app/providers/AppProviders.tsx)).
2. **Route:** `errorElement` — route yükleme/render hataları ([RouteErrorPage](../src/app/router/RouteErrorPage.tsx)).
3. **Veri:** her sorgu bileşeni kendi hata durumunu ve "yeniden dene" aksiyonunu gösterir.

## Konfigürasyon

`VITE_*` değişkenleri [env.schema.ts](../src/shared/config/env.schema.ts) ile **iki kez** doğrulanır:
build sırasında (hatalı değer build'i kırar) ve uygulama açılışında. Kod env'e yalnızca
`@/shared/config/env` üzerinden erişir. Değerler build'e gömüldüğü için her ortam için ayrı build
alınır; tek imajla çok ortam gerekirse çalışma zamanı konfigürasyonu için ayrı bir ADR yazılmalıdır.

## Stil ve tasarım sistemi

Tailwind CSS 4 + iki katmanlı token sistemi (ham ölçekler → semantik token'lar). Bileşenler yalnızca
semantik token kullanır; tema değişimi token seviyesinde çözülür. Ayrıntılar:
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Test stratejisi

| Seviye              | Araç                             | Kapsam                                                              |
| ------------------- | -------------------------------- | ------------------------------------------------------------------- |
| Birim / entegrasyon | Vitest + Testing Library + MSW   | Bileşen davranışı, hook'lar, mock servisler, sayfalar (`renderApp`) |
| Uçtan uca           | Playwright, Pages benzeri sunucu | Kâşif (mobil/tablet/masaüstü), Studio, iki cihazlı yolculuklar      |
| Erişilebilirlik     | axe + Playwright                 | Tüm rotalar ve 13 kart türü, açık ve koyu temada WCAG 2.2 AA        |

Ağ istekleri testlerde MSW ile taklit edilir; tanımsız bir istek testi düşürür.

## Performans bütçeleri (gzip)

| Varlık        | Bütçe    |
| ------------- | -------- |
| Başlangıç JS  | ≤ 170 kB |
| Route chunk'ı | ≤ 50 kB  |
| CSS           | ≤ 30 kB  |

Sayfalar route bazında lazy yüklenir; React Query Devtools yalnızca geliştirmede yüklenir.

## Yayın ve coming-soon modu

```
push → main ──► CI (typecheck · lint · test · build · E2E · axe · audit)
                  │ başarılı
                  ▼
              Deploy workflow ──► build (BASE_PATH, VITE_COMING_SOON) ──► GitHub Pages
tag vX.Y.Z ──► Release workflow ──► CHANGELOG bölümünden GitHub Release
```

`VITE_COMING_SOON=true` iken router yalnızca açılış sayfasını içeren route setini kullanır
([routes.tsx](../src/app/router/routes.tsx)); build eklentisi `<html>`'e karanlık temayı yazar, böylece
ilk boyamada beyaz yanıp sönme olmaz. Karar ve sınırlamalar:
[ADR 0005](adr/0005-coming-soon-mode-and-github-pages.md).

## Güvenlik

- Kaynak haritaları üretilir ama bundle'dan referanslanmaz ve nginx tarafından servis edilmez.
- CSP tek kaynaktan gelir ([csp.ts](../src/shared/config/csp.ts)): build `<meta>` olarak yazar,
  `npm run csp:nginx` [security-headers.conf](../docker/nginx/security-headers.conf)'u üretir
  (HSTS, `X-Frame-Options`, `nosniff`, Referrer-Policy, Permissions-Policy dahil) — ADR 0013.
- Container root olmayan kullanıcıyla çalışır. Ayrıntılar: [SECURITY.md](../SECURITY.md).
