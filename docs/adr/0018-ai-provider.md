# 0018. Yapay zekâ: sağlayıcıdan bağımsız `AiProvider`, Gemini, taslak-onay

- **Durum:** Kabul edildi. Kullanıcı kararı (2026-09-25): Gemini canlıda **açık** başlar
  (`AI_PROVIDER=gemini`); Gemini koşullarındaki 18 yaş maddesine ilişkin hukuki riski kullanıcı
  üstlendi.
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

## Uygulama (2026-09-25)

- `ai-generate` Edge Function'ı Gemini REST API'sini `responseSchema` ile yapılandırılmış JSON
  çıktı alarak çağırır. Modeller `GEMINI_MODEL` / `GEMINI_MODEL_LIGHT` secret'larıyla verilir
  (varsayılanlar plan §3.13'teki gibi); 429/503'te hafif modele düşer.
- SVG'ler `checkAiSvg` ile denetlenir ve kurala uymayan çizim **reddedilir, düzeltilmez**.
  Sahneler durum başına durağan karelerdir.
- Yapay zekâ ancak hem `AI_PROVIDER` secret'ı hem Studio ayarı açıksa çalışır; admin Studio'dan
  kapatabilir.
