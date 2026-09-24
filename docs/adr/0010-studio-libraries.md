# 0010. Studio kütüphaneleri

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-24

## Karar

| İhtiyaç            | Seçim                                                  | Gerekçe                                                          |
| ------------------ | ------------------------------------------------------ | ---------------------------------------------------------------- |
| Formlar            | Kontrollü bileşenler + Zod                             | Formlar küçük; ek bağımlılık gerekmedi. Doğrulama sınırda Zod    |
| Kart sıralama      | `@dnd-kit` + "Yukarı/Aşağı taşı" / Alt+↑↓              | Klavye ve ekran okuyucu erişimi                                  |
| Komut paleti       | `cmdk`                                                 | Ctrl+K ile kit/sayfa arama                                       |
| Grafikler          | Kendi SVG bileşenlerimiz                               | Küçük paket, token renkleri, her grafik için tablo ikizi (1.1.1) |
| QR üretimi / okuma | `qrcode-generator` / `BarcodeDetector` + `jsQR` yedeği | Saf JS, CSP uyumlu                                               |
| ZIP                | `jszip` (tembel yüklenir)                              | Toplu PNG indirme                                                |
| IndexedDB          | `idb-keyval`                                           | Medya ve taslak yedeği                                           |

## Sonuçlar

- React Hook Form eklenmedi; form karmaşıklığı artarsa yeniden değerlendirilecek.
