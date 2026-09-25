# Bilimsel Çalışma Kiti Platformu — Premium PWA React/Vite Implementation Plan

> **Doküman türü:** Ürün + UX/UI + Teknik Mimari + Uygulama Roadmap\
> **Hedef:** Çocukların bilimsel çalışma kitlerini interaktif olarak kullanabildiği, yöneticilerin ise yeni kitler oluşturup yayınlayabildiği premium PWA platformu\
> **Frontend:** React + Vite + TypeScript\
> **Durum:** Tasarım ve teknik mimari planı

---

## 1\. Proje Vizyonu

Mevcut Erzurum Bilim Merkezi E-B-M örnek projesi , tek bir bilimsel keşif kitinin statik/PWA biçiminde sunulduğu bir yapı.

Mevcut örnekte:

- 7 adet interaktif soru/öğrenme ekranı bulunuyor.
- Her soruya QR kod üzerinden ulaşılabiliyor.
- PWA kurulumu destekleniyor.
- Service Worker ile offline çalışma altyapısı bulunuyor.
- Çocuklara yönelik büyük butonlar, renkli kartlar, emoji/illustrasyonlar ve sesli anlatım kullanılıyor. GitHub+2

Yeni sistemin temel farkı:

> **Tek bir HTML dosyasındaki çalışma kitini, yöneticinin kod yazmadan oluşturabildiği dinamik bir "Science Kit CMS + Kids Learning Platform" haline getirmek.**

---

# 2\. Ürün Modeli

Platformu 3 ana bölüme ayırmak mantıklı:

```
                    PLATFORM
                       │
        ┌──────────────┴──────────────┐
        │                             │
    ADMIN PANEL                  CHILD APP
        │                             │
        │                             │
   Kit oluşturma                 Kit keşfetme
   İçerik yönetimi               QR ile açma
   Soru oluşturma                Etkileşim
   Oyun oluşturma                Sesli anlatım
   QR üretme                     İlerleme
   Yayınlama                     Rozetler
   Analitik
```

İleride üçüncü kullanıcı tipi eklenebilir:

```
ADMIN
  │
  ├── SUPER ADMIN
  ├── CONTENT EDITOR
  └── EDUCATOR

CHILD
  │
  ├── GUEST CHILD
  └── REGISTERED CHILD
```

İlk versiyonda çocuk hesabını zorunlu yapmak yerine **QR → Kit → Etkileşim** akışının hesapsız çalışması daha doğru olur.

---

# 3\. Temel Ürün Konsepti

## 3.1 Kit

Bir çalışma kiti:

```
Kit
│
├── Genel bilgiler
├── Kapak
├── Tema
├── Yaş aralığı
├── Bilim alanı
├── Tahmini süre
├── Öğrenme hedefleri
├── Malzemeler
├── Güvenlik bilgileri
│
└── İçerikler
      │
      ├── Bilgi
      ├── Soru
      ├── Deney
      ├── Animasyon
      ├── Mini oyun
      ├── Quiz
      ├── Video
      └── Sonuç
```

Bu yapı sayesinde örneğin:

- Küçük Çiftçiler
- Uzay Kaşifleri
- Elektrik Dedektifleri
- Su Laboratuvarı
- Robotik Başlangıç
- Dinozorları Keşfediyorum

gibi sınırsız kit oluşturulabilir.

---

# 4\. İçerik Modeli

En önemli mimari karar:

> **Soruları React component olarak hard-code etmeyelim.**

Admin panelindeki içeriklerden runtime'da oluşturulabilen bir **Content Block System** kurulmalı.

Örneğin:

```
{
  "type": "question",
  "title": "Bitkiler neden suya ihtiyaç duyar?",
  "icon": "💧",
  "description": "...",
  "interaction": {
    "type": "tap-reveal"
  },
  "answer": {
    "title": "Cevap",
    "content": "..."
  }
}
```

---

# 5\. Block Sistemi

İlk sürümde aşağıdaki block türleri önerilir.

| Block        | Açıklama                |
| ------------ | ----------------------- |
| `intro`      | Kit giriş ekranı        |
| `info`       | Bilgilendirici içerik   |
| `question`   | Soru + cevap            |
| `quiz`       | Çoktan seçmeli soru     |
| `tap-reveal` | Dokunarak keşfet        |
| `drag-drop`  | Sürükle bırak           |
| `sequence`   | Sıralama                |
| `matching`   | Eşleştirme              |
| `experiment` | Deney yönergesi         |
| `simulation` | Basit bilim simülasyonu |
| `video`      | Video içerik            |
| `audio`      | Sesli anlatım           |
| `image`      | Görsel anlatım          |
| `success`    | Kit tamamlandı ekranı   |

---

# 6\. Örnek "Küçük Çiftçiler" Kitinin Yeni Sisteme Taşınması

Mevcut örnekteki 7 içerik:

```
01 — Tohum nedir?
02 — Marul nasıl yetişir?
03 — Sera nedir?
04 — Bitkiler neden ışığa ihtiyaç duyar?
05 — Bitkiler neden suya ihtiyaç duyar?
06 — Tohum çimlenmek için ne ister?
07 — Tohum ile fide arasındaki fark nedir?
```

Bunlar artık React içinde:

```
Kit
└── Küçük Çiftçiler
    │
    ├── Intro
    │
    ├── Question
    │   └── Tohum nedir?
    │
    ├── Interactive Timeline
    │   └── Marul nasıl yetişir?
    │
    ├── Info
    │   └── Sera nedir?
    │
    ├── Simulation
    │   └── Bitkinin mutfağı
    │
    ├── Interactive Animation
    │   └── Su yolculuğu
    │
    ├── Mini Game
    │   └── Çimlenme
    │
    └── Comparison
        └── Tohum vs Fide
```

Mevcut projede de özellikle sesli anlatım, interaktif SVG/animasyon ve mini oyun gibi farklı etkileşim modelleri kullanılıyor. GitHub

---

# 7\. Çocuk Uygulaması UX

## Ana Sayfa

Çocuk tarafı kesinlikle klasik admin dashboard gibi görünmemeli.

Önerilen:

```
┌──────────────────────────────────────┐
│ 🌱 Bilim Dünyası             🔊 ⚙️   │
│                                      │
│       Merhaba Kaşif! 👋             │
│                                      │
│  🔬 Bugün ne keşfedelim?             │
│                                      │
│ ┌────────────┐ ┌────────────┐        │
│ │ 🌱         │ │ 🚀         │        │
│ │ Bitkiler   │ │ Uzay       │        │
│ │ Dünyası    │ │ Kaşifleri  │        │
│ └────────────┘ └────────────┘        │
│                                      │
│ ┌────────────┐ ┌────────────┐        │
│ │ 💧         │ │ ⚡         │        │
│ │ Su         │ │ Elektrik   │        │
│ └────────────┘ └────────────┘        │
│                                      │
│             🏆 Başarılar             │
└──────────────────────────────────────┘
```

---

# 8\. QR Kullanımı

Mevcut sistemin en değerli fikirlerinden biri QR tabanlı fiziksel-dijital bağlantı.

Mevcut uygulamada QR'lar doğrudan belirli soru hash/route'larına yönlendiriliyor ve tüm QR kodları ZIP olarak üretilebiliyor. GitHub

Yeni sistemde bunu genelleştirelim:

```
QR
 │
 ├── Kit
 │
 ├── Bölüm
 │
 ├── İçerik
 │
 └── Deney
```

Örneğin:

```
https://app.domain.com/k/bitkiler/c/tohum
```

veya daha güvenli:

```
https://app.domain.com/scan/8F7K2
```

QR payload:

```
{
  "kitId": "kit_123",
  "contentId": "content_456"
}
```

---

# 9\. Admin Panel

Admin tarafı tamamen farklı bir UI dili kullanmalı.

## Dashboard

```
┌────────────────────────────────────────────────────┐
│ Science Studio                         👤 Admin    │
├─────────────┬──────────────────────────────────────┤
│             │                                      │
│ Dashboard   │  Günaydın 👋                         │
│             │                                      │
│ Kitler      │  ┌────────┐ ┌────────┐ ┌────────┐   │
│ İçerikler   │  │ 24     │ │ 8      │ │ 12.4K  │   │
│ QR Kodlar   │  │ Kit    │ │ Taslak │ │ Ziyaret│   │
│ Analitik    │  └────────┘ └────────┘ └────────┘   │
│             │                                      │
│ Ayarlar     │  Son Kitler                          │
│             │  ┌───────────────────────────────┐   │
│             │  │ 🌱 Küçük Çiftçiler    Yayında│   │
│             │  │ 🚀 Uzay Kaşifleri     Taslak │   │
│             │  │ ⚡ Elektrik            Yayında│   │
│             │  └───────────────────────────────┘   │
└─────────────┴──────────────────────────────────────┘
```

---

# 10\. Kit Builder

Platformun kalbi burası olacak.

Admin:

```
+ Yeni Kit
```

tıklayınca:

### Step 1 — Genel Bilgiler

```
Kit adı
Slug
Açıklama
Kapak görseli
Tema rengi
Kategori
Yaş aralığı
Tahmini süre
```

### Step 2 — Öğrenme Hedefleri

```
+ Öğrenme hedefi

☑ Tohumun ne olduğunu öğrenir
☑ Çimlenme sürecini açıklar
☑ Bitkinin ihtiyaçlarını tanımlar
```

### Step 3 — İçerik

```
+ İçerik ekle

┌─────────────────────────────┐
│ 📖 Bilgi                   │
│ ❓ Soru                    │
│ 🎮 Mini Oyun               │
│ 🧪 Deney                   │
│ 🎯 Quiz                    │
│ 🎥 Video                   │
│ 🔊 Ses                     │
│ 🧩 Eşleştirme              │
│ ↕️ Sıralama                │
└─────────────────────────────┘
```

---

# 11\. Visual Page Builder

Admin içerik oluştururken mümkün olduğunca:

> **No-code / low-code**

yaklaşımı kullanılmalı.

Örneğin:

```
┌──────────────────────────────────────┐
│  İçerik #4                           │
│                                      │
│  ☀️ Bitkiler neden ışığa ihtiyaç    │
│     duyar?                           │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │        CANVAS                    │ │
│ │                                  │ │
│ │     🌱                           │ │
│ │     ↓                            │ │
│ │     ☀️                           │ │
│ │                                  │ │
│ │  [ Işığı Aç! ]                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│             [Önizle] [Kaydet]        │
└──────────────────────────────────────┘
```

Sağ panel:

```
PROPERTIES

Başlık
Emoji
Açıklama
Buton metni
Animasyon
Ses
Doğru cevap
Başarı mesajı
```

---

# 12\. İçerik Şeması

Önerilen temel veri modeli:

```
interface ScienceKit {
  id: string;
  slug: string;

  title: string;
  description: string;

  coverImage?: string;

  category: ScienceCategory;

  ageRange: {
    min: number;
    max: number;
  };

  duration?: number;

  theme: {
    primary: string;
    secondary: string;
    accent: string;
  };

  learningObjectives: string[];

  materials: Material[];

  safetyNotes?: string[];

  contents: KitContent[];

  status: "draft" | "review" | "published" | "archived";

  version: number;

  createdAt: string;
  updatedAt: string;
}
```

---

# 13\. Content Model

```
interface KitContent {
  id: string;

  type:
    | "intro"
    | "info"
    | "question"
    | "quiz"
    | "experiment"
    | "simulation"
    | "game"
    | "video"
    | "audio"
    | "matching"
    | "sequence"
    | "success";

  title: string;

  description?: string;

  order: number;

  data: Record<string, unknown>;

  audio?: MediaAsset;

  image?: MediaAsset;

  isRequired: boolean;
}
```

---

# 14\. Admin — Yayınlama Sistemi

Kit doğrudan yayınlanmamalı.

```
DRAFT
  ↓
CONTENT REVIEW
  ↓
APPROVED
  ↓
PUBLISHED
```

Admin panelinde:

```
Taslak
İncelemede
Yayında
Arşivlendi
```

bulunmalı.

Ayrıca:

```
v1
v2
v3
```

şeklinde içerik versiyonlama öneriyorum.

---

# 15\. Kit Preview

Admin:

```
👁 Çocuk Modunda Önizle
```

butonuna basabilmeli.

Bu özellik çok önemli.

Aynı React uygulaması:

```
/admin/kits/123/edit
```

ile editörü,

```
/kits/123
```

ile çocuk deneyimini render eder.

Preview:

```
/admin/kits/123/preview
```

olabilir.

---

# 16\. Premium UI Design System

## Görsel Dil

Çocuk tarafında:

- büyük radius
- soft gradients
- canlı ama göz yormayan renkler
- büyük emoji/illustration
- mikro animasyon
- büyük touch target
- playful typography
- progress indicator
- celebration animation

kullanılmalı.

Admin tarafında:

- premium SaaS dashboard
- glass/soft surfaces
- sidebar
- command palette
- data table
- charts
- skeleton loading
- keyboard shortcuts
- responsive layout

kullanılmalı.

---

# 17\. Renk Sistemi

Çocuk:

```
--green: #4CAF50;
--green-dark: #2E7D32;

--blue: #42A5F5;
--yellow: #FFC83D;
--orange: #FF9F43;
--purple: #9B6ADE;
--pink: #EC6A9A;

--background: #F2FBF5;
```

Ancak renkler içerik bazlı değiştirilebilir:

```
Kit Theme
│
├── Forest
├── Ocean
├── Space
├── Laboratory
└── Energy
```

---

# 18\. Typography

Çocuk UI:

```
Heading
Rounded / playful

Body
Highly readable sans-serif
```

Admin:

```
Inter / Geist / similar modern sans-serif
```

Çocuk ekranlarında mevcut örnekte de yuvarlak/oyuncu görsel dil ve büyük dokunmatik kontroller kullanılıyor. GitHub

---

# 19\. Animasyon Sistemi

Her şeyi animasyonlu yapmak yerine:

```
Interaction
    ↓
Feedback
    ↓
Reward
```

mantığı kullanılmalı.

Örnek:

```
Çocuk butona dokundu
        ↓
scale 0.96
        ↓
animation
        ↓
✓ doğru
        ↓
confetti
        ↓
+1 discovery
```

Kütüphane:

```
Framer Motion
```

veya daha hafif çözüm olarak:

```
CSS animations
```

Önerim:

**Framer Motion + CSS**

---

# 20\. Ses Sistemi

Mevcut kit sesli anlatım kullanıyor. GitHub

Yeni platformda:

```
🔊 Dinle
```

her content block'un opsiyonel özelliği olmalı.

```
audio: {
  url: "...",
  duration: 12,
  autoplay: false
}
```

Ek olarak:

```
▶ Dinle
⏸ Duraklat
🔇 Sessiz
```

---

# 21\. Çocuk İlerleme Sistemi

Çocuk ister anonim ister hesaplı olabilir.

Örneğin:

```
Küçük Çiftçiler

████████████░░ 80%

6 / 7 keşif tamamlandı
```

Tamamlanan içerikler:

```
✓ Tohum
✓ Marul
✓ Sera
✓ Işık
✓ Su
✓ Çimlenme
○ Tohum vs Fide
```

---

# 22\. Gamification

Çok ağır oyunlaştırma yerine bilimsel keşif hissi:

```
🌱 Tohum Kaşifi
💧 Su Dedektifi
☀️ Işık Uzmanı
🧪 Mini Bilim İnsanı
🔬 Bilim Kaşifi
```

Rozet sistemi:

```
Badge {
  id
  title
  icon
  description
  requirement
}
```

---

# 23\. QR Yönetimi

Admin:

```
Kit
 └── QR Yönetimi

[ Tüm QR'ları indir ]

İçerik              QR
──────────────────────────
Tohum               [↓]
Marul               [↓]
Sera                [↓]
Işık                [↓]
Su                  [↓]
Çimlenme            [↓]
```

Ek olarak:

```
PDF olarak indir
PNG olarak indir
SVG olarak indir
ZIP olarak indir
```

Mevcut sistemdeki "tek tek QR" ve "tüm QR'ları ZIP indir" yaklaşımı korunabilir. GitHub

---

# 24\. QR Kart Tasarım Sistemi

QR yalnızca siyah-beyaz kare olmamalı.

Örneğin:

```
┌───────────────────────────┐
│ 🌱 KÜÇÜK ÇİFTÇİLER       │
│                           │
│        ███████            │
│        █ QR █             │
│        ███████            │
│                           │
│  01 — Tohum nedir?       │
│                           │
│ 📱 Kamerayla tara         │
└───────────────────────────┘
```

Admin otomatik printable card oluşturabilir.

---

# 25\. PWA

PWA kesinlikle korunmalı.

Mevcut E-B-M projesinde:

- `manifest.webmanifest`
- `sw.js`
- service worker registration

bulunuyor. GitHub+1

Yeni sistemde:

```
Install App
Offline Cache
App Shell
Cached Kits
Offline Progress
Background Sync
```

hedeflenebilir.

---

# 26\. Offline Mimari

Çocuk uygulaması internet kesildiğinde mümkün olduğunca çalışmalı.

```
                    API
                     │
              ┌──────┴──────┐
              │             │
           IndexedDB      Cache
              │             │
              └──────┬──────┘
                     │
                  React
```

Teknoloji:

```
Service Worker
Workbox
IndexedDB
Dexie
```

Önerilen:

**Dexie + Workbox**

---

# 27\. Backend Mimarisi

Frontend'i backend'den bağımsız tasarlamak önemli.

```
React/Vite
     │
     │ REST / tRPC
     ▼
API
     │
 ┌───┼───────────┐
 │   │           │
DB  Storage     Auth
```

Önerilen stack:

```
Frontend
React
Vite
TypeScript
TanStack Query
React Router

Backend
NestJS veya FastAPI

Database
PostgreSQL

Storage
S3-compatible object storage

Auth
JWT / session based auth

Cache
Redis
```

---

# 28\. Alternatif Backend

Daha hızlı MVP istenirse:

```
React
Vite
Supabase
PostgreSQL
Supabase Storage
Supabase Auth
```

çok daha hızlı geliştirilebilir.

Ancak uzun vadeli kurumsal yapı için:

```
React + API + PostgreSQL
```

ayrıştırması daha esnek olacaktır.

---

# 29\. API Taslağı

```
GET    /api/kits
GET    /api/kits/:slug

POST   /api/admin/kits
PATCH  /api/admin/kits/:id
DELETE /api/admin/kits/:id

POST   /api/admin/kits/:id/publish
POST   /api/admin/kits/:id/duplicate

GET    /api/admin/kits/:id/contents
POST   /api/admin/kits/:id/contents
PATCH  /api/admin/contents/:id
DELETE /api/admin/contents/:id

GET    /api/admin/kits/:id/qr
POST   /api/admin/kits/:id/qr/generate
```

---

# 30\. Database

Temel tablolar:

```
users
roles

kits
kit_versions
kit_categories

kit_contents
content_assets

media_assets

qr_codes

child_sessions
progress

badges
child_badges

analytics_events

audit_logs
```

---

# 31\. Yetkilendirme

```
SUPER_ADMIN
    │
    ├── Kullanıcı yönetimi
    ├── Kit yönetimi
    ├── Yayınlama
    └── Sistem ayarları

CONTENT_EDITOR
    │
    ├── Kit oluştur
    ├── İçerik düzenle
    └── Taslak oluştur

EDUCATOR
    │
    ├── Kit görüntüle
    ├── Atama
    └── İlerleme

CHILD
    │
    ├── Kit kullan
    ├── İlerleme
    └── Rozet
```

---

# 32\. Güvenlik

Çocuklara yönelik platform olduğu için güvenlik ayrı bir başlık olmalı.

Özellikle:

- gereksiz kişisel veri toplamama
- çocuk hesabı gerekiyorsa minimum veri
- admin RBAC
- rate limiting
- XSS protection
- CSRF protection
- secure cookies
- signed media URLs
- audit logs
- upload validation
- MIME/type kontrolü
- image size limit
- API authorization

uygulanmalı.

---

# 33\. Analytics

Admin:

```
Kit görüntülenme
Kit başlatma
Kit tamamlama
İçerik görüntülenme
İçerikte kalma süresi
Quiz başarı oranı
QR tarama sayısı
En çok kullanılan kit
En çok bırakılan içerik
```

görebilmeli.

Çocukların gereksiz kişisel profillemesi yapılmamalı; mümkün olduğunca anonim/aggregate analytics tercih edilmeli.

---

# 34\. Admin Analytics

Örneğin:

```
KÜÇÜK ÇİFTÇİLER

2.481
Başlatma

1.842
Tamamlama

74%
Tamamlama oranı

────────────────────

İçerik performansı

Tohum       ██████████ 94%
Marul       █████████  87%
Sera        ████████   79%
Işık        ███████    72%
Su          █████████  84%
Çimlenme    ██████     65%
Fide        █████      58%
```

Buradaki sayılar **örnek UI verileridir**, gerçek veri değildir.

---

# 35\. React Proje Yapısı

```
src/
│
├── app/
│   ├── router/
│   ├── providers/
│   └── layouts/
│
├── components/
│   ├── ui/
│   ├── forms/
│   ├── media/
│   └── animations/
│
├── features/
│   │
│   ├── kits/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types/
│   │
│   ├── content/
│   │   ├── renderer/
│   │   ├── blocks/
│   │   └── editor/
│   │
│   ├── qr/
│   │
│   ├── progress/
│   │
│   ├── badges/
│   │
│   └── analytics/
│
├── pages/
│   ├── child/
│   └── admin/
│
├── lib/
│   ├── api/
│   ├── storage/
│   ├── analytics/
│   └── offline/
│
├── hooks/
│
├── stores/
│
├── types/
│
├── assets/
│
└── styles/
```

---

# 36\. Content Renderer

Bu sistemin en önemli React componentlerinden biri:

```
<ContentRenderer content={content} />
```

İçerik tipine göre:

```
switch (content.type) {
  case "info":
    return <InfoBlock {...content} />;

  case "quiz":
    return <QuizBlock {...content} />;

  case "experiment":
    return <ExperimentBlock {...content} />;

  case "game":
    return <GameBlock {...content} />;

  case "simulation":
    return <SimulationBlock {...content} />;
}
```

Böylece yeni kit eklemek için yeni React sayfası yazmak gerekmez.

---

# 37\. Block Registry

Daha profesyonel yaklaşım:

```
const contentRegistry = {
  info: InfoBlock,
  quiz: QuizBlock,
  experiment: ExperimentBlock,
  game: GameBlock,
  simulation: SimulationBlock,
  video: VideoBlock,
  matching: MatchingBlock,
};
```

Admin editor de aynı registry'den beslenebilir.

Bu mimari:

```
ADMIN BUILDER
      │
      ▼
CONTENT JSON
      │
      ▼
CONTENT REGISTRY
      │
      ▼
CHILD RUNTIME
```

şeklinde çalışır.

---

# 38\. Responsive Tasarım

Öncelik:

```
Mobile
   ↓
Tablet
   ↓
Desktop
```

Çocuk uygulaması özellikle:

```
375px
390px
414px
768px
1024px
```

ekranlarında test edilmeli.

---

# 39\. Touch UX

Çocuk uygulamasında minimum:

```
44 × 44 px
```

dokunma alanı hedeflenmeli.

Ancak ana etkileşimlerde:

```
56–72px
```

daha uygun olur.

---

# 40\. Accessibility

Çocuk uygulaması erişilebilir olmalı:

- keyboard navigation
- screen reader labels
- high contrast
- reduced motion
- captions
- audio alternatifleri
- focus states
- semantic HTML

Özellikle animasyonlarda:

```
@media (prefers-reduced-motion: reduce)
```

desteği eklenmeli.

---

# 41\. Admin UX — Profesyonel Detaylar

Admin paneline:

### Command Palette

```
⌘ K

Kit oluştur
Kit ara
QR oluştur
İçerik ekle
Kullanıcı ara
```

### Keyboard shortcuts

```
Ctrl/Cmd + S → Kaydet
Ctrl/Cmd + P → Preview
Ctrl/Cmd + Enter → Yayınla
```

### Autosave

```
● Kaydediliyor...

✓ Son değişiklikler kaydedildi
```

eklenebilir.

---

# 42\. Media Manager

Admin'in sürekli görsel yüklemesi gerekeceğinden:

```
Media Library

[ + Yükle ]

🌱 seed.svg
🌿 plant.png
☀️ sunlight.svg
💧 water.svg
```

özelliği olmalı.

Filtre:

```
Images
Audio
Video
Illustrations
Documents
```

---

# 43\. Tema Builder

Admin kit oluştururken:

```
Theme

Primary      🟢
Secondary    🟡
Background   ⚪

Font
○ Playful
○ Standard

Animation
○ High
○ Medium
○ Low
```

seçebilir.

Daha sonra:

```
Theme Presets
```

oluşturulabilir.

---

# 44\. Kit Şablonları

Yeni kit oluştururken:

```
Yeni Kit

○ Boş Kit
○ 7 Soruluk Keşif
○ Deney Kiti
○ Quiz Kiti
○ Hikaye Tabanlı Kit
```

çok faydalı olur.

Örneğin:

**7 Soruluk Keşif Template**

otomatik olarak:

```
Intro
↓
Question
↓
Interactive
↓
Question
↓
Game
↓
Quiz
↓
Summary
```

oluşturur.

---

# 45\. İçerik Import / Export

Admin:

```
Export Kit → JSON
Import Kit → JSON
```

yapabilmeli.

Örneğin:

```
{
  "schemaVersion": 1,
  "kit": {
    "...": "..."
  }
}
```

Bu özellik ileride:

- yedekleme
- kit taşıma
- farklı bilim merkezlerine dağıtma
- Git tabanlı içerik
- toplu içerik üretimi

için çok değerlidir.

---

# 46\. Versioning

Önemli:

```
Kit v1
Kit v2
Kit v3
```

Çocukların kullandığı eski kit bozulmamalı.

Örneğin:

```
QR → content version 3
```

yeni yayın:

```
QR → latest published version
```

şeklinde yönetilebilir.

---

# 47\. SEO

Public kit sayfaları:

```
/kits/kucuk-ciftciler
/kits/uzay-kasifleri
```

SEO metadata taşımalı.

```
title
description
og:title
og:image
```

Ancak çocuk deneyimi SPA olarak devam edebilir.

---

# 48\. Routing

Öneri:

```
/
├── /kits
├── /kits/:slug
├── /kits/:slug/play
├── /scan/:code
│
└── /admin
    ├── /dashboard
    ├── /kits
    ├── /kits/new
    ├── /kits/:id
    ├── /kits/:id/editor
    ├── /kits/:id/qr
    ├── /analytics
    └── /settings
```

---

# 49\. QR Flow

```
Çocuk
 │
 │ QR tarar
 ▼
/scan/ABC123
 │
 ▼
QR doğrulama
 │
 ▼
Kit + Content resolve
 │
 ▼
Çocuk ekranı
 │
 ▼
Etkileşim
 │
 ▼
Progress
```

---

# 50\. PWA Cache Stratejisi

```
App Shell
   ↓
Cache First

Kit Metadata
   ↓
Network First

Images
   ↓
Cache First

Progress
   ↓
IndexedDB

Analytics
   ↓
Queue → Background Sync
```

---

# 51\. State Management

Global state'i gereksiz büyütmemek önemli.

Öneri:

```
TanStack Query
    ↓
server state

Zustand
    ↓
UI/session state

React Hook Form
    ↓
forms

Zod
    ↓
validation
```

---

# 52\. Form Validation

Admin içeriklerinde:

```
Zod
```

kullanılmalı.

Örneğin:

```
const kitSchema = z.object({
  title: z.string().min(3),
  slug: z.string(),
  ageMin: z.number(),
  ageMax: z.number(),
});
```

---

# 53\. Testing

Minimum:

```
Unit Tests
Integration Tests
E2E Tests
Accessibility Tests
PWA Tests
```

Önerilen:

```
Vitest
Testing Library
Playwright
axe
```

---

# 54\. E2E Kritik Senaryolar

### Çocuk

```
Kit aç
↓
İçerik aç
↓
Etkileşim yap
↓
Doğru cevabı gör
↓
Sonraki içeriğe geç
↓
Kit tamamla
↓
Rozet kazan
```

### Admin

```
Login
↓
Yeni kit
↓
İçerik ekle
↓
Preview
↓
Kaydet
↓
Publish
↓
QR oluştur
↓
QR indir
```

---

# 55\. MVP

İlk sürümde her şeyi yapmamak gerekiyor.

## MVP-1

### Çocuk

- Kit listesi
- Kit detay
- Kit oynatma
- Progress
- QR scan
- 5 content type
- Audio
- PWA
- Offline basic support

### Admin

- Login
- Dashboard
- Kit CRUD
- Content CRUD
- Drag & drop sıralama
- Preview
- Publish
- QR generation

---

# 56\. MVP Content Types

İlk versiyon:

```
1. Info
2. Question
3. Quiz
4. Interactive
5. Mini Game
```

Bunlar mevcut E-B-M deneyimini kapsayacak kadar güçlü.

---

# 57\. Phase 2

```
Experiment Builder
Video
Audio editor
Matching
Drag & Drop
Sequence
Advanced animation
Badges
Child profile
Advanced analytics
```

---

# 58\. Phase 3

```
AI Content Assistant

"8 yaş için fotosentez konusunda
5 interaktif soru oluştur."

        ↓

AI

        ↓

Draft Content

        ↓

Admin Review

        ↓

Publish
```

AI hiçbir içeriği doğrudan yayınlamamalı.

---

# 59\. Phase 4

```
Teacher accounts
School accounts
Classrooms
Assignments
Teacher analytics
Printable worksheets
Certificate
Multilingual content
```

---

# 60\. Gelecekte Çok Kiracılı Yapı

Platform farklı bilim merkezleri tarafından kullanılacaksa baştan:

```
Organization
     │
     ├── Users
     ├── Kits
     ├── Branding
     └── Analytics
```

tasarlanmalı.

Örneğin:

```
Erzurum Bilim Merkezi
Ankara Bilim Merkezi
İstanbul Bilim Merkezi
```

aynı platformu kullanabilir.

---

# 61\. White Label

İleri aşamada:

```
Organization Settings

Logo
Primary Color
Domain
Footer
App Name
```

ile kurum kendi markasını kullanabilir.

---

# 62\. Önerilen Teknoloji Stack

## Frontend

```
React
Vite
TypeScript

React Router
TanStack Query
Zustand

Tailwind CSS
shadcn/ui
Radix UI

Framer Motion
Lucide React

React Hook Form
Zod

Dexie
Workbox
```

## Backend

```
NestJS
PostgreSQL
Prisma
Redis
S3-compatible storage
```

## Testing

```
Vitest
Testing Library
Playwright
axe
```

---

# 63\. Design System Componentleri

```
Button
IconButton
Card
KitCard
ContentCard

Modal
Drawer
Dialog

Progress
Badge
Avatar

Input
Textarea
Select
Combobox

Tabs
Accordion
Tooltip

Toast
Alert
ConfirmDialog

DataTable

FileUploader
MediaPicker
ColorPicker

ContentBlock
ContentRenderer

GameCanvas
AudioPlayer
VideoPlayer
```

---

# 64\. En Önemli Mimari Karar

Bu projeyi:

```
❌ Her kit = ayrı React page
```

şeklinde yapmamalıyız.

Bunun yerine:

```
             DATABASE
                 │
                 ▼
              KIT JSON
                 │
                 ▼
          CONTENT RENDERER
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
     INFO      QUIZ       GAME
       │         │         │
       └─────────┼─────────┘
                 ▼
             CHILD UI
```

kurulmalı.

Böylece admin panelinden oluşturulan **100 farklı kit**, yeni frontend deployment gerektirmeden çalışabilir.

---

# 65\. E-B-M'den Alınacak Fikirler

Mevcut projeden korunması gereken UX fikirleri:

- kart tabanlı keşif
- renkli bilim kategorileri
- QR ile fiziksel kart → dijital içerik bağlantısı
- sesli anlatım
- dokunarak etkileşim
- mini oyun
- SVG tabanlı bilimsel animasyon
- PWA kurulumu
- offline çalışma
- çocuk dostu navigation

Bunların mevcut örnekte gerçek uygulama karşılıkları bulunuyor. GitHub+2

---

# 66\. E-B-M'den Ayrılması Gereken Noktalar

Mevcut yapı tek dosyalı statik bir uygulama yaklaşımında ve ana `index.html` dosyası yaklaşık 966 satır HTML içeriyor. GitHub

Yeni sistemde:

```
❌ Inline HTML
❌ Inline JS
❌ Her kit için ayrı deployment
❌ Hard-coded soru
❌ Hard-coded QR
❌ Global onclick handler
```

yerine:

```
✅ React components
✅ TypeScript
✅ Content schema
✅ API
✅ Database
✅ Admin CMS
✅ Content registry
✅ Versioning
✅ RBAC
```

kullanılmalı.

---

# 67\. İlk Sprint

## Sprint 01 — Foundation

```
[ ] Vite + React + TS
[ ] ESLint
[ ] Prettier
[ ] Tailwind
[ ] Router
[ ] Design tokens
[ ] App shell
[ ] PWA
[ ] CI
```

---

# 68\. Sprint 02 — Design System

```
[ ] Button
[ ] Card
[ ] Modal
[ ] Input
[ ] Badge
[ ] Progress
[ ] Toast
[ ] Navigation
[ ] Child layout
[ ] Admin layout
```

---

# 69\. Sprint 03 — Kit Runtime

```
[ ] Kit model
[ ] Kit API
[ ] Kit detail
[ ] Content renderer
[ ] Info block
[ ] Question block
[ ] Quiz block
[ ] Game block
[ ] Audio
```

---

# 70\. Sprint 04 — Admin

```
[ ] Admin login
[ ] Dashboard
[ ] Kit list
[ ] Create kit
[ ] Edit kit
[ ] Content list
[ ] Content editor
[ ] Drag & drop
[ ] Preview
```

---

# 71\. Sprint 05 — QR

```
[ ] QR resolver
[ ] QR generation
[ ] Individual QR
[ ] Bulk QR
[ ] Printable card
[ ] QR analytics
```

---

# 72\. Sprint 06 — PWA / Offline

```
[ ] Service Worker
[ ] Cache strategy
[ ] IndexedDB
[ ] Offline kit
[ ] Offline progress
[ ] Sync queue
[ ] Install prompt
```

---

# 73\. Sprint 07 — Polish

```
[ ] Animations
[ ] Loading states
[ ] Empty states
[ ] Error states
[ ] Accessibility
[ ] Mobile optimization
[ ] Performance
```

---

# 74\. Sprint 08 — Production

```
[ ] Security audit
[ ] E2E
[ ] Performance test
[ ] Lighthouse
[ ] Backup
[ ] Monitoring
[ ] Error tracking
[ ] Production deployment
```

---

# 75\. Definition of Done

Bir kit ancak:

```
✓ İçerikleri tamamlandı
✓ Mobil test edildi
✓ Tablet test edildi
✓ Audio kontrol edildi
✓ QR test edildi
✓ Offline test edildi
✓ Accessibility kontrol edildi
✓ Admin preview edildi
✓ Content review yapıldı
✓ Publish edildi
```

sonrasında yayınlanmalı.

---

# 76\. Son Mimari

```
                         ┌─────────────────────┐
                         │     ADMIN PANEL     │
                         │                     │
                         │ Kit Builder         │
                         │ Content Editor      │
                         │ Media Manager       │
                         │ QR Manager          │
                         │ Analytics           │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │       API           │
                         │                     │
                         │ Auth                │
                         │ Kits                │
                         │ Contents            │
                         │ Media               │
                         │ Progress            │
                         │ Analytics           │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼──────────────┐
                    ▼               ▼              ▼
              PostgreSQL         Storage          Redis
                    │
                    │
                    ▼
             ┌───────────────┐
             │ CHILD PWA     │
             │               │
             │ Kit Explorer  │
             │ QR Scanner    │
             │ Content       │
             │ Games         │
             │ Progress      │
             │ Badges        │
             │ Offline       │
             └───────────────┘
```

---

# 77\. Ürünün Asıl Gücü

Bu projeyi sadece **"çocuklara yönelik eğitim sitesi"** olarak değil:

> **Bilimsel içeriklerin no-code olarak üretildiği ve fiziksel bilim kitlerini dijital interaktif deneyimlere bağlayan bir platform**

olarak tasarlamak daha doğru bir ürün mimarisi sağlar.

Özellikle **Kit Builder + Content Block System + QR \+ PWA + Offline** beşlisi platformun çekirdeği olmalı.

### MVP çekirdeği

```
          ┌───────────────┐
          │   KIT BUILDER │
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │ CONTENT JSON  │
          └───────┬───────┘
                  │
          ┌───────┴────────┐
          ▼                ▼
    ┌───────────┐    ┌────────────┐
    │ CHILD PWA │    │ QR SYSTEM  │
    └─────┬─────┘    └──────┬─────┘
          │                  │
          └────────┬─────────┘
                   ▼
            PHYSICAL KIT
                   +
            DIGITAL SCIENCE
               EXPERIENCE
```

Bu mimari, verdiğin **Küçük Çiftçiler** örneğini yalnızca yeniden tasarlamak yerine, aynı mantıkla **yüzlerce farklı bilim çalışma kitinin yönetilebildiği bir platforma** dönüştürür. GitHub+1
