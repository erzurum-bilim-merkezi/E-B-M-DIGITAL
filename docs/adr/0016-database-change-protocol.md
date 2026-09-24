# 0016. Tek ortam veritabanı değişiklik protokolü

- **Durum:** Önerildi (F4)
- **Tarih:** 2026-09-24

## Karar (önerilen)

- Göçler `supabase/migrations` altında tutulur; yerel yığında iki kez `db reset` + pgTAP +
  sözleşme testleriyle prova edilir. Canlıya yalnızca onaylı `db-migrate` iş akışıyla (session
  pooler) uygulanır; öncesinde yedek alınır, geri dönüş betiği birlikte yazılır.
- Claude canlı ortama komut, SQL, seed ya da test çalıştırmaz; `GEMINI_API_KEY`'i hiçbir dosyaya
  yazmaz.
