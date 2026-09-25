# Canlıya geçiş (Supabase) — adım adım

Bu belge, Kâşif'i mock arka uçtan canlı Supabase projesine taşımak için **senin** yapacağın
adımlardır. Kod tarafı hazırdır (ADR 0021). Her canlı işlem GitHub Actions'ta onaylı bir
workflow'dur. Canlı veritabanına elle SQL çalıştırılmaz (ADR 0016).

> **Sıra önemlidir:** panel ayarları → secret'lar ve değişkenler → migration → fonksiyonlar →
> ilk admin → deploy (önce "yakında" modu açıkken) → deneme → açılış.

## 0. Ön koşul

- `feat/supabase` dalının CI'ı yeşil olmalı. Bu, **Supabase rehearsal** job'unun da geçtiği
  anlamına gelir.
- Dal bir PR ile `main`'e alınmış olmalı.

## 1. Supabase paneli: Authentication

**Authentication → Sign In / Providers**

- **Allow anonymous sign-ins: AÇIK.** Çocuk cihazları anonim oturum açar.
- **Allow new users to sign up: AÇIK.** Anonim giriş buna bağlıdır.
- **Email provider: açık kalır.** Personel e-posta + parola ile girer.
  - E-posta ile kendi kendine kayıt seçeneği varsa kapat. Personel hesapları yalnızca Studio'dan
    ve `bootstrap-admin` ile açılır.
  - Kayıt olmuş yabancı bir e-posta hesabı hiçbir veriyi göremez (RLS), ama gereksiz kullanıcı
    sayılır.
- **Confirm email: kapalı** (Free planda e-posta yalnızca ekip üyelerine gider).

**Authentication → Multi-Factor**

- **TOTP: açık** (varsayılan).

**Authentication → Policies / Passwords**

- En az 10 karakter, harf + rakam.

**Authentication → Rate Limits**

- Anonymous sign-ins: **300 / saat**. Bir okul sınıfı aynı IP'den katılabilir.

**Authentication → URL Configuration**

- **Site URL:** `https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/`

**Project Settings → JWT** (ya da Auth ayarları)

- **Access token expiry: 1800** saniye.

## 2. GitHub: `production` ortamı

GitHub → **Settings → Environments → New environment → `production`**

- **Required reviewers:** kendin. Her canlı workflow senin onayını bekler.
- **Deployment branches:** yalnızca `main`.

Aynı ekranda **Environment secrets**:

| Secret                     | Nereden                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `SUPABASE_PROJECT_REF`     | Supabase → Project Settings → General → **Project ID**                                             |
| `SUPABASE_DB_URL`          | Supabase → **Connect** → **Session pooler** (port **5432**) bağlantı dizesi, parola yerleştirilmiş |
| `SUPABASE_ACCESS_TOKEN`    | Supabase → hesap menüsü → **Access Tokens** → Generate (yalnızca fonksiyon deploy'u için)          |
| `SUPABASE_SECRET_KEY`      | Supabase → Project Settings → **API Keys** → `sb_secret_…` (yalnızca ilk admin ve 2FA sıfırlama)   |
| `BACKUP_AGE_PUBLIC_KEY`    | Yedek şifreleme anahtarının **açık** kısmı (`age1…`), aşağıya bak                                  |
| `BOOTSTRAP_ADMIN_PASSWORD` | İlk admin'in **geçici** parolası (≥ 10 karakter, harf + rakam). 8. adımdan sonra sil.              |

**Yedek anahtarı (bir kez):**

1. `age` programını indir: <https://github.com/FiloSottile/age/releases>.
2. `age-keygen -o kasif-yedek.key` çalıştır.
3. Çıktıdaki `age1…` satırı `BACKUP_AGE_PUBLIC_KEY` olur.
4. `kasif-yedek.key` dosyası **gizli anahtardır**: bilgisayar dışında (USB / şifre yöneticisi)
   sakla. GitHub'a ya da buluta koyma.

## 3. GitHub: depo değişkenleri

GitHub → **Settings → Secrets and variables → Actions → Variables** (secret değil, bunlar
herkese açık değerlerdir):

| Variable                        | Değer                                                  |
| ------------------------------- | ------------------------------------------------------ |
| `VITE_BACKEND`                  | `supabase`                                             |
| `VITE_SUPABASE_URL`             | `https://<project-ref>.supabase.co`                    |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → `sb_publishable_…`       |
| `VITE_COMING_SOON`              | şimdilik **tanımlama** ya da `true` (açılışta `false`) |

`sb_secret_…` anahtarını **asla** buraya yazma; build bunu reddeder.

## 4. Supabase: Edge Function secret'ları

Supabase → **Edge Functions → Secrets** (GitHub'a yazılmaz):

| Secret               | Değer                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`     | Google AI Studio'da oluşturulan anahtar (yalnızca Gemini API ile sınırla)                          |
| `AI_PROVIDER`        | `gemini` (kapatmak için `off`)                                                                     |
| `GEMINI_MODEL`       | AI Studio'da ücretsiz katmanda görünen güncel Flash model adı (kod varsayılanı `gemini-3.8-flash`) |
| `GEMINI_MODEL_LIGHT` | Güncel Flash-Lite model adı (kod varsayılanı `gemini-3.1-flash-lite`)                              |
| `ALLOWED_ORIGIN`     | `https://erzurum-bilim-merkezi.github.io`                                                          |

Model adları sık değişir. AI Studio'daki listeyle karşılaştır; ad yanlışsa yapay zekâ
"Hizmet şu anda yanıt vermiyor" der.

## 5. Veritabanı: migration'lar

GitHub → **Actions → "DB migrate (live)" → Run workflow**

1. **confirm** kutusuna Project ID'yi yaz.
2. Onayla.
3. Workflow sırasıyla:
   1. Şifreli yedek alır (7 gün saklanan artifact).
   2. Bekleyen migration'ları listeler.
   3. Uygular.
   4. Canlı `schema_version()`'ın depodaki son migration olduğunu doğrular.

Hata verirse dur ve bana log'u gönder. Elle SQL çalıştırma.

## 6. Edge Function'lar

**Actions → "Edge Functions deploy (live)" → Run workflow** → onayla.

Bu adım `admin-users` ve `ai-generate` fonksiyonlarını yayınlar.

## 7. İlk admin

1. **Actions → "Bootstrap first admin (live)" → Run workflow**.
2. E-posta ve adını gir, onayla.
3. Hemen ardından `BOOTSTRAP_ADMIN_PASSWORD` secret'ını **sil**.

## 8. Deploy ("yakında" modu hâlâ açık)

**Actions → Deploy → Run workflow**.

- Deploy, canlı şema sürümünü kontrol eder: migration uygulanmamışsa durur.
- `VITE_COMING_SOON` açıkken ziyaretçiler "yakında" sayfasını görür. Studio ise çalışır:
  `https://erzurum-bilim-merkezi.github.io/E-B-M-DIGITAL/studio/giris`

İlk giriş sırası:

1. Geçici parola ile gir.
2. Yeni parolanı belirle.
3. Telefonuna doğrulayıcıyı (Google Authenticator vb.) ekle, 6 haneli kodla doğrula.
4. **Kullanıcılar** sayfasından **ikinci bir admin** ekle; o da 2FA'sını kurmalı. Tek admin
   kalması telefon kaybında Studio'yu kilitler.

## 9. Deneme (canlıda, ziyaretçiler görmeden)

1. Studio'da ilk kiti oluştur ve **liste dışı** yayınla.
2. QR sayfasından kit QR'ını yazdır.
3. Tableti **önizleme cihazı** yap: Studio → Ayarlar. Bu cihaz "yakında" modunu atlar.
4. Tabletle QR'ı okut, katıl, birkaç kart oyna.
5. Studio panosunda etkinliği gör.

## 10. Açılış

GitHub Variables → **`VITE_COMING_SOON` = `false`** → **Actions → Deploy → Run workflow**.

Build, mock arka uçla açılışı reddeder. `VITE_BACKEND=supabase` olduğu için açılış yapılır.

## Sonrası

- **Keep-alive:** Free plan 7 gün hareketsiz projeyi duraklatır. "Keep the Supabase project
  awake" workflow'u 3 günde bir çalışır (ek ayar gerekmez).
- **Yedekler:** her `db-migrate` öncesi otomatik alınır.
  - Açmak için: `age -d -i kasif-yedek.key backup-….tar.gz.age > yedek.tar.gz`
- **2FA kaybı:** **Actions → "Reset an admin's 2FA (live, emergency)"** → e-posta → onay.
- **Yapay zekâyı kapatmak:** Studio → Ayarlar → Yapay zekâ → Kapalı. Tamamen kapatmak için
  Supabase'de `AI_PROVIDER=off`.
