# 0012. Analitik: olay modeli, günler, görünürlük

- **Durum:** Kabul edildi (mock okuyucu); artımlı toplama F4'te
- **Tarih:** 2026-09-24

## Karar

- Olaylar: `qr_scan`, `kit_open`, `card_open`, `card_complete`, `quiz_answer`, `kit_complete`,
  `badge_earned`, `certificate_view`. İstemci `clientEventId` ile tekilleştirilir; kuyruk en fazla
  50'lik partilerle gönderilir, çevrimdışında birikir; dakikada 120 olay sınırı vardır.
- Günler Europe/Istanbul'a göre sayılır. Önizleme cihazı ve Studio önizlemesi olayları
  istatistiklere girmez.
- **Görünürlük (KVKK):** editör yalnızca toplu sayıları görür; kâşif adı ve zaman çizelgesi yalnızca
  admin'e açıktır. Admin bir kâşifin tüm verisini JSON olarak indirebilir ve silebilir (denetim
  kaydına yazılır).
- Ham olaylar 60 gün, hareketsiz üyelikler 12 ay saklanır (Ayarlar'dan 7–60 gün / 3–24 ay).

## Sonuçlar

- Pano 30 sn'de bir yenilenir; her grafiğin tablo görünümü ve CSV dışa aktarımı vardır.
