import { useNavigate } from 'react-router'

import { KidPanel } from '@/shared/ui/kid'

import { KidsTopBar } from './components/KidsTopBar'

/**
 * KVKK aydınlatma metni (m.10). Technical draft prepared with the plan (§3.12); the institution's
 * KVKK officer must approve the final text before launch (F12 gate).
 */
export function PrivacyPage() {
  const navigate = useNavigate()
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4">
      <title>Aydınlatma metni · Kâşif</title>
      <KidsTopBar>
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="kid-focus inline-flex h-14 items-center gap-2 rounded-[1.25rem] bg-kid-surface px-5 text-lg font-bold shadow-kid-soft"
        >
          ← Geri
        </button>
      </KidsTopBar>
      <h1 className="text-3xl font-bold">Kâşif aydınlatma metni</h1>
      <KidPanel className="flex flex-col gap-4 text-lg leading-relaxed [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-bold">
        <p>
          Kâşif, <strong>Erzurum Bilim Merkezi</strong>’nin çocuklara yönelik bilim kiti
          uygulamasıdır. Uygulama eğitmen gözetiminde kullanılır. Bu metin, Kâşif üyeliğinde hangi
          bilgilerin neden işlendiğini açıklar (6698 sayılı KVKK m.10).
        </p>
        <h2>Hangi bilgileri tutuyoruz?</h2>
        <ul className="list-disc pl-6">
          <li>Seçtiğin takma ad ve avatar (gerçek adın olması gerekmez).</li>
          <li>
            Hangi kitleri ve kartları açıp tamamladığın, quiz cevaplarının doğru olup olmadığı,
            kazandığın rozetler.
          </li>
          <li>QR okuttuğun kartlar ve okutma yolu (kamera, uygulama içi, elle).</li>
          <li>Kâşif kodunun yalnızca şifrelenmiş (özet) hâli.</li>
        </ul>
        <h2>Neleri tutmuyoruz?</h2>
        <p>
          Konumunu, fotoğrafını, cihazının modelini, telefon numaranı ya da e-postanı kaydetmiyoruz.
        </p>
        <h2>Neden?</h2>
        <p>
          Kaldığın yerden devam edebilmen, rozet ve sertifika kazanabilmen ve bilim merkezinin
          etkinlikleri iyileştirebilmesi için. İşleme dayanağı kurumun KVKK sorumlusu tarafından
          belirlenir.
        </p>
        <h2>Bilgiler nerede saklanır?</h2>
        <p>
          Üyelik bilgileri kurumun bulut veritabanında (Supabase) saklanır; uygulama GitHub Pages
          üzerinden yayınlanır; bazı videolar YouTube’dan gösterilir. Bu hizmetler yurt dışında
          olabilir. Hizmet sağlayıcıların sistem kayıtları IP adresini kısa süre (1 gün) tutabilir.
        </p>
        <h2>Ne kadar süre saklanır?</h2>
        <p>
          Ayrıntılı etkinlik kayıtları 60 gün, üyelik 12 ay hareketsizlikten sonra tüm verileriyle
          birlikte otomatik silinir.
        </p>
        <h2>Haklarını nasıl kullanırsın?</h2>
        <p>
          Profil sayfasındaki <strong>“Üyeliğimi ve verilerimi sil”</strong> ile her şeyi hemen
          silebilirsin. Verilerinin bir kopyasını istemek için eğitmenine ya da bilim merkezine
          başvurabilirsin.
        </p>
        <p className="rounded-xl bg-kid-surface-2 p-3 text-base text-kid-fg-soft">
          Bu metin taslaktır; yayın öncesinde kurumun KVKK sorumlusu tarafından onaylanır.
        </p>
      </KidPanel>
    </article>
  )
}
