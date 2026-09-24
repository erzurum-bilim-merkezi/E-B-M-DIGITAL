# 0009. Kâşif üyeliği: cihaz ↔ üye bağlama, Kâşif kodu, merkez cihazı

- **Durum:** Kabul edildi (mock arka uçta uygulandı; Supabase şeması F4)
- **Tarih:** 2026-09-24

## Bağlam

Çocuklar e-posta/parola kullanmaz; ilerleme ve rozetler cihaz değişince kaybolmamalıdır. Bilim
merkezindeki paylaşılan tabletlerde birden çok çocuk sırayla oynar.

## Karar

- Üyelik = takma ad + avatar (kişisel veri yok). Takma ad uzunluk, karakter kümesi ve Türkçe
  uygunsuz kelime filtresinden geçer.
- Her cihaz anonim bir cihaz kimliği taşır; bir cihaza en fazla 10 üye bağlanır, üyeler arasında
  geçiş yapılır.
- **Kâşif kodu** `KSF-XXXX-XXXX` (8 karakter Crockford base32, ≈40 bit) yalnızca katılımda bir kez
  gösterilir ve Kâşif kartında durur; sunucuda yalnızca özeti saklanır. Geri yükleme cihaz başına
  hız sınırlıdır (5 hatalı denemede 15 dk). Kart QR'ı `KASIF:<kod>` metnidir (URL değil).
- **Merkez cihazı**: yönetici kurulum kodu üretir (24 saat, tek kullanımlık), tablet kiosk moduna
  geçer (ekran uyanık kilidi), çıkış eğitmen PIN'iyle yapılır. Tablette aynı anda tek kâşif oturur;
  90 sn hareketsizlikte en az 20 sn'lik "Hâlâ orada mısın?" uyarısından sonra devir yapılır ve
  cihazdaki tüm üye bağları, kodlar ve etkin üye silinir (KVKK). Kurulum kodu ve PIN denemeleri
  cihaz başına 5 hatada 15 dk kilitlenir; PIN cihaz kimliğiyle tuzlanarak özetlenir.

## Sonuçlar

- Kayıt yolu ≤ 3 dokunuş: QR'dan gelen çocuk katıldıktan sonra doğrudan karta gider.
