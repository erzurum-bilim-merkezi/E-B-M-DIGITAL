# 0005. Coming-soon modu ve GitHub Pages ile yayın

- **Durum:** Kabul edildi
- **Tarih:** 2026-09-24

## Bağlam

Platform henüz geliştirme aşamasında, ancak alan adının/adresin şimdiden "Çalışmalar devam ediyor"
mesajıyla yayında olması isteniyor. Aynı zamanda `main` dalında geliştirme kesintisiz sürmeli ve
yarım kalmış özellikler ziyaretçilere görünmemeli.

## Karar

- **Coming-soon modu:** `VITE_COMING_SOON=true` ile build edilen uygulama tüm adreslerde açılış
  sayfasını gösterir. Mod build sırasında seçilir; kapalıyken açılış sayfası bundle'a hiç girmez
  (lazy route).
- **Yayın:** GitHub Pages (public repo, ücretsiz). Deploy workflow'u yalnızca CI başarıyla
  tamamlandığında (`workflow_run`) çalışır; sitenin `BASE_PATH` alt yolu ve SPA `404.html` fallback'i
  workflow'da ayarlanır; kaynak haritaları yayından çıkarılır.
- **Lansman:** repo değişkeni `VITE_COMING_SOON=false` yapılıp Deploy workflow'u yeniden çalıştırılır
  — kod değişikliği gerekmez.

## Sonuçlar

- GitHub Pages özel HTTP başlığı (CSP, HSTS, frame-ancestors) tanımlamaya izin vermez. Açılış sayfası
  kullanıcı girdisi almadığı için bu aşamada risk düşüktür; gerçek uygulama canlıya çıkmadan önce
  başlık kontrolü olan bir barındırmaya (Docker/nginx imajı hazır) veya bir CDN'e geçiş ya da build
  zamanında `<meta http-equiv="Content-Security-Policy">` eklenmesi değerlendirilmelidir.
- Özel alan adı bağlandığında `BASE_PATH` `/` olarak güncellenmelidir.
