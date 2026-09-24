# Tasarım sistemi

Premium ürün arayüzü; net hiyerarşi, tutarlılık, sadelik, hız ve kusursuz durum yönetimi demektir.
Uygulama kuralları [`.claude/skills/premium-ui/SKILL.md`](../.claude/skills/premium-ui/SKILL.md)
içindedir; bu doküman marka kararlarını ve token referansını tutar.

## 1. Marka brief'i — kısmen dolduruldu

> _Varsayım_ ile işaretli satırlar onay bekliyor. Boş satırlar doldurulmadan kalıcı görsel kimlik
> kararları (logo, kurumsal renk) verilmez; Claude'un `ui-designer` agent'ı önce bunları sorar.

| Soru                                                 | Yanıt                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| Kurum                                                | Erzurum Bilim Merkezi (E-B-M)                                      |
| Ürün ne yapıyor? (tek cümle)                         | Bilim merkezinin dijital platformu — kapsamı netleşecek            |
| Birincil kullanıcılar kim?                           | _Varsayım:_ öğrenciler, öğretmenler, aileler, meraklı ziyaretçiler |
| Kullanım bağlamı (masaüstü yoğun mu, saha/mobil mi?) | _Varsayım:_ ağırlıkla mobil                                        |
| Marka kişiliği (3 sıfat)                             | _Öneri:_ meraklı, güvenilir, sıcak                                 |
| Ses tonu (resmî / samimi / teknik)                   | _Öneri:_ samimi ama net; siz dili                                  |
| Beğenilen referans ürünler                           |                                                                    |
| Kaçınılacak görünüm                                  |                                                                    |
| Kurumsal renkler / logo / yazı tipi                  | Resmî logo bekleniyor (`public/favicon.svg` geçici bir işarettir)  |

### Açılış sayfası sanat yönü (v0.1.0)

"Erzurum'da kış gecesi": yüksek rakımın berrak gökyüzü, kar tepeli sıradağlar ve zirvedeki
gözlemevinin yanan ışığı — _çalışmalar sürüyor_ mesajının görsel karşılığı. Sıcak kehribar (`lamp`)
yalnızca "devam eden iş" sinyali için ayrılmıştır (durum rozetindeki nokta ve gözlemevi ışığı).

| Token (sanat paleti) | Değer     | Kullanım                      |
| -------------------- | --------- | ----------------------------- |
| `night-950`          | `#07112a` | Gökyüzü tepesi, en yakın sırt |
| `night-900`          | `#0a1733` | Sayfa zemini                  |
| `night-800`          | `#10224a` | Orta sırt                     |
| `night-700`          | `#183262` | Uzak sırt eteği               |
| `night-600`          | `#24477f` | Ufuk ışıması, uzak zirveler   |
| `ice-200`            | `#cfe0fb` | Yörünge, gezegen, kar gölgesi |
| `snow-50`            | `#f4f7fc` | Yıldızlar, kar                |
| `lamp`               | `#ffc56b` | "Çalışma sürüyor" sinyali     |

**Yazı tipi:** başlıklarda _Bricolage Grotesque_ (değişken, yalnızca ağırlık ekseni, kendi
sunucumuzdan — KVKK uyumlu, Türkçe karakter desteği tam), gövde metninde sistem yazı tipi.

## 2. Token mimarisi

```
Ham ölçekler (brand-50 … brand-950, Tailwind renkleri)
        │  yalnızca token tanımlarında kullanılır
        ▼
Semantik token'lar (canvas, surface, fg, primary …)  ← açık/koyu temaya göre değişir
        │  bileşenler yalnızca bunları kullanır
        ▼
Tailwind utility'leri: bg-surface · text-fg-muted · border-border · bg-primary …
```

Tanımlar: [src/app/styles/global.css](../src/app/styles/global.css). Tema işletim sistemini izler;
`<html data-theme="light|dark">` ile zorlanabilir (tema seçici eklemek için hazır).

## 3. Semantik token'lar

| Token            | Kullanım                                                       | Açık tema  | Koyu tema  |
| ---------------- | -------------------------------------------------------------- | ---------- | ---------- |
| `canvas`         | Sayfa zemini                                                   | white      | slate-950  |
| `surface`        | Kart, panel, popover                                           | white      | slate-900  |
| `surface-muted`  | Hover, seçili satır, hafif dolgu                               | slate-50   | slate-800  |
| `fg`             | Birincil metin                                                 | slate-900  | slate-50   |
| `fg-muted`       | İkincil metin                                                  | slate-600  | slate-300  |
| `fg-subtle`      | Üçüncül metin, meta                                            | slate-500  | slate-400  |
| `border`         | Ayraçlar, kart kenarları                                       | slate-200  | slate-800  |
| `border-strong`  | Belirgin ayraç, kesik çerçeve                                  | slate-300  | slate-600  |
| `control-border` | Girdi, seçim, onay kutusu, anahtar kenarı (≥ 3:1, WCAG 1.4.11) | oklch 0.62 | oklch 0.56 |
| `ring`           | Klavye odak halkası                                            | brand-600  | brand-400  |
| `link`           | Bağlantılar                                                    | brand-600  | brand-300  |
| `primary`        | Birincil aksiyon zemini                                        | brand-600  | brand-600  |
| `primary-hover`  | Birincil aksiyon hover                                         | brand-700  | brand-700  |
| `primary-fg`     | Birincil aksiyon üzerindeki metin                              | white      | white      |
| `danger`         | Yıkıcı aksiyon / hata                                          | red-600    | red-600    |

Tüm metin/zemin çiftleri WCAG AA kontrastını karşılar ve her iki temada axe ile test edilir.

## 4. Temel ölçüler

- **Tipografi:** `text-xs` meta · `text-sm` arayüz varsayılanı · `text-base` okuma metni ·
  `text-2xl–4xl` sayfa başlıkları. Ağırlıklar 400/500/600 (700 yalnızca sayfa başlığı).
- **Boşluk:** 4px ızgara (Tailwind `1` = 4px).
- **Köşe yarıçapı:** kontroller `md`, kartlar `lg`, diyaloglar `xl`, rozetler `full`.
- **Yükselti:** sayfa içi paneller düz + kenarlık; açılır katmanlar `shadow-lg`.
- **Hareket:** 100–300ms, `ease-out-quart`; `prefers-reduced-motion` global olarak uygulanır.

## 5. Bileşen envanteri

| Bileşen                                    | Durum    | Konum                                                                 |
| ------------------------------------------ | -------- | --------------------------------------------------------------------- |
| `Button`                                   | Hazır    | [src/shared/ui/Button.tsx](../src/shared/ui/Button.tsx)               |
| `ErrorFallback`                            | Hazır    | [src/shared/ui/ErrorFallback.tsx](../src/shared/ui/ErrorFallback.tsx) |
| Dialog, Menu, Select, Tabs, Tooltip, Toast | Bekliyor | [ADR 0004](adr/0004-ui-component-strategy.md) kararına bağlı          |
| Input, Field, Badge, Card, Skeleton, Table | Planlı   | `/new-component` skill'i ile                                          |
