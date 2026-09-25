# 0018. Yapay zekâ: sağlayıcıdan bağımsız `AiProvider`, Gemini, taslak-onay

- **Durum:** Kabul edildi (deneme sağlayıcısı); Gemini hukuk kapısı (F0.10) bekliyor
- **Tarih:** 2026-09-24

## Karar

- Studio'daki yapay zekâ özellikleri (kart metni, sahne SVG'leri, ikon, kit taslağı) `AiProvider`
  port'unu kullanır. Bugün **deneme sağlayıcısı** (`fake`) çalışır; `off` tüm girişleri gizler.
- Gemini yalnızca Edge Function üzerinden çağrılır; `GEMINI_API_KEY` yalnızca Supabase Edge
  Function secret'ıdır ve kullanıcı tarafından girilir. **`VITE_GEMINI_API_KEY` kullanılmaz.**
- Üretilen içerik her zaman taslaktır: editör onaylamadan karta yazılmaz; yapay zekâ içeren kit
  yayınlanırken "bilimsel doğruluğu kontrol ettim" onayı zorunludur.
- SVG çıktısı izin listesiyle denetlenir (betik, dış bağlantı, olay niteliği yok) ve `<img>` ile
  gösterilir. Kullanıcı ve proje başına günlük kotalar vardır.
