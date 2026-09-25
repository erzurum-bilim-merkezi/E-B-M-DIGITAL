# 0011. Supabase Free, tek ortam; personel oturumu sessionStorage; admin 2FA

- **Durum:** Önerildi (F4/F12 — canlı ortam kapısı kullanıcı onayı bekliyor)
- **Tarih:** 2026-09-24

## Bağlam

Bütçe Supabase Free planıdır; ayrı hazırlık ortamı yoktur. Mock arka uç aynı kuralları (roller,
`aal2`, son admin koruması, iyimser kilit) bugünden uygular.

## Karar (önerilen)

- Personel oturumu sekmeye bağlı `sessionStorage`'da tutulur (ortak `github.io` kökeni, ADR 0013).
- Roller `admin` ve `editor`; admin için TOTP zorunlu (`aal2`), en az 2 aktif admin kapı şartıdır,
  tek admin kaldığında panoda kırmızı uyarı gösterilir (uygulandı).
- Şema, RLS ve Edge Function'lar F4'te üç kez planlanıp yerel yığında prova edilir; canlıya
  uygulama yalnızca kullanıcı onayıyla (F12) yapılır.

## Sonuçlar

- Bugünkü sürüm yalnızca mock arka uçla çalışır (`BACKEND_MODE = 'mock'`); port/adapter sınırı
  (ADR 0015) sayesinde Supabase adapter'ları UI değişmeden eklenecektir.
