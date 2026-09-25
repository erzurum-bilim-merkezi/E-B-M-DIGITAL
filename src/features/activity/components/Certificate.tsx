import { formatDate } from '@/shared/lib/format'
import { Mascot, type MascotColor } from '@/shared/ui/kid'

export type CertificateData = {
  nickname: string
  displayCode: string
  avatar: MascotColor
  kitTitle: string
  badgeName: string
  badgeEmoji: string
  completedAt: string
}

/** Printable certificate (A4 landscape via @page; only this element prints — data-printable). */
export function Certificate({ data }: { data: CertificateData }) {
  return (
    <div
      data-printable
      className="kid-certificate relative overflow-hidden rounded-[2rem] p-3 shadow-kid-card"
    >
      <style>{'@page { size: A4 landscape; margin: 10mm; }'}</style>
      <div className="relative flex aspect-[297/210] w-full flex-col items-center justify-center gap-[2.5%] rounded-[1.5rem] border-[6px] border-double border-kid-sun/80 bg-kid-surface px-[6%] text-center text-kid-fg">
        <Mascot
          color={data.avatar}
          pose="celebrate"
          className="absolute top-[6%] left-[5%] w-[14%]"
        />
        <span
          aria-hidden="true"
          className="absolute top-[6%] right-[6%] text-[clamp(2rem,7vw,4.5rem)]"
        >
          {data.badgeEmoji}
        </span>
        <p className="text-[clamp(0.9rem,2.4vw,1.4rem)] font-semibold tracking-[0.2em] text-kid-fg-soft uppercase">
          Erzurum Bilim Merkezi · Kâşif
        </p>
        <h1 className="text-[clamp(1.8rem,6vw,3.6rem)] leading-none font-bold text-kid-link">
          Kâşif Sertifikası
        </h1>
        <p className="text-[clamp(1rem,2.6vw,1.5rem)] text-kid-fg-soft">Bu sertifika</p>
        <p className="text-[clamp(2rem,7vw,4.2rem)] leading-none font-bold">{data.nickname}</p>
        <p className="max-w-[80%] text-[clamp(1rem,2.8vw,1.6rem)] leading-snug">
          <strong>“{data.kitTitle}”</strong> kitinin tüm kartlarını tamamlayarak{' '}
          <strong>{data.badgeName}</strong> rozetini kazandığı için verilmiştir.
        </p>
        <div className="mt-[2%] flex w-[80%] items-end justify-between text-[clamp(0.8rem,2vw,1.1rem)] text-kid-fg-soft">
          <span>
            Tarih
            <br />
            <strong className="text-kid-fg">{formatDate(data.completedAt)}</strong>
          </span>
          <span>
            Kâşif no
            <br />
            <strong className="text-kid-fg">#{data.displayCode}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}
