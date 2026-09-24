# Güvenlik politikası

## Açık bildirimi

Güvenlik açıklarını **herkese açık issue olarak açmayın.** Repo GitHub'a taşındıktan sonra
"Security → Report a vulnerability" (özel güvenlik bildirimi) kanalını kullanın. Bildirimde etkilenen
sürüm/ortam, yeniden üretme adımları ve olası etkiyi paylaşın.

## Gizli bilgiler

- Gizli bilgiler (token, parola, API anahtarı) repoya commit edilmez. `.env*` dosyaları
  `.gitignore` ile dışarıda tutulur; yalnızca `.env.example` paylaşılır.
- `VITE_*` değişkenleri tarayıcı bundle'ına gömülür — **asla gizli bilgi içermez.** Gizli bilgi
  gerektiren çağrılar backend/BFF üzerinden yapılır.
- Sızan bir anahtar derhâl iptal edilir ve yenilenir; commit geçmişinden silmek tek başına yeterli
  değildir.

## Uygulama güvenliği ilkeleri

- Tüm dış veriler (API yanıtları, URL parametreleri, formlar) Zod ile doğrulanır.
- `dangerouslySetInnerHTML` sanitize edilmeden kullanılmaz; kullanıcı verisi `href`/`src`
  değerlerine doğrulanmadan konmaz.
- Erişim token'ları `localStorage`'da tutulmaz.
- Güvenlik başlıkları ve CSP: [docker/nginx/security-headers.conf](docker/nginx/security-headers.conf).

## Bağımlılıklar

Dependabot haftalık güncelleme PR'ları açar; CI her çalışmada `npm audit --omit=dev --audit-level=high`
kontrolü yapar.
