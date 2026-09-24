# 0017. Kâşif kimliği ve KVKK

- **Durum:** Kabul edildi (mock); hukuk metinleri F0.10 görüşüne bağlı
- **Tarih:** 2026-09-24

## Karar

- Çocuktan kişisel veri alınmaz: takma ad + avatar; e-posta, telefon, fotoğraf yok. Yapay zekâ
  isteklerinde kişisel veri (e-posta, telefon, TC kimlik no) algılanırsa istek reddedilir.
- Cihaz kimliği ve aktif üye `localStorage`'dadır (personel oturumu kuralının bilinçli istisnası:
  çocuk oturumu yetki taşımaz; kaybolursa Kâşif koduyla geri gelinir).
- Aydınlatma metni `/aydinlatma` sayfasındadır; rıza ekranı yoktur (işleme dayanağı: hizmetin
  sunulması); veri en az ve süreli saklanır (ADR 0012).
- Çocuk "Üyeliğimi ve verilerimi sil" ile tüm verisini siler; admin bir kâşifin verisini JSON olarak
  dışa aktarabilir (KVKK m.11) ve silebilir; iki işlem de denetim kaydına yazılır.
