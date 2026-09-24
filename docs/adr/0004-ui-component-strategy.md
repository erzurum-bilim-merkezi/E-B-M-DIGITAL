# 0004. UI bileşen stratejisi

- **Durum:** Önerildi — karar bekliyor
- **Tarih:** 2026-09-24

## Bağlam

Premium bir arayüz; diyalog, açılır menü, select/combobox, sekmeler, tooltip ve toast gibi karmaşık
bileşenler gerektirir. Bunların erişilebilir hâlde (odak yönetimi, klavye desteği, ARIA) sıfırdan
yazılması pahalı ve hataya açıktır. Basit bileşenler (Button vb.) hâlihazırda `src/shared/ui` içinde,
semantik token'larla yazılmaktadır.

## Değerlendirilen seçenekler

1. **shadcn/ui (Radix UI tabanlı) + lucide-react ikonlar** — Bileşen kodu repoya kopyalanır (sahiplik
   bizde), Tailwind 4 ve token yaklaşımıyla birebir uyumlu, çok geniş topluluk. Eksi: kopyalanan kodun
   bakımı bizde.
2. **React Aria Components (Adobe)** — Erişilebilirlikte en güçlü seçenek, uluslararasılaştırma
   (tarih/sayı) desteği kapsamlı. Eksi: API daha ayrıntılı, stil entegrasyonu daha fazla emek ister.
3. **Base UI (MUI ekibi)** — Modern headless primitifler, Radix'e benzer model. Eksi: ekosistemi daha
   genç.
4. **Tam hazır kit (MUI, Ant Design)** — Hızlı başlangıç. Eksi: kendine özgü görünüm, büyük bundle,
   token sistemimizle çatışma; "premium ve özgün" hedefiyle uyumsuz.

## Öneri

Seçenek 1: `src/shared/ui` altında shadcn/ui bileşenlerini semantik token'larımıza uyarlayarak
kullanmak; karmaşık bileşenler için Radix primitiflerine dayanmak. Tarih/sayı ağırlıklı formlar
çoğalırsa belirli bileşenlerde React Aria değerlendirilebilir.

## Sonuçlar (kabul edilirse)

- `components.json` ve gerekli Radix paketleri eklenir; ilk set: Dialog, DropdownMenu, Select, Tabs,
  Tooltip, Toast (Sonner), Input/Field.
- Her bileşen `premium-ui` kurallarına göre uyarlanır, testlenir ve açık/koyu temada axe'den geçer.
