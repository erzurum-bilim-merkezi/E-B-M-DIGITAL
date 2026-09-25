import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { Mascot } from '@/shared/ui/kid'

function Friendly({ title, text }: { title: string; text: string }) {
  return (
    <section className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <title>{`${title} · Kâşif`}</title>
      <Mascot pose="thinking" className="size-36" />
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-xl text-kid-fg-soft">{text}</p>
      <Link
        to="/"
        className="kid-focus inline-flex min-h-16 items-center justify-center rounded-[1.375rem] bg-kid-primary px-8 text-xl font-bold text-kid-primary-fg shadow-kid-3d transition-transform active:translate-y-1"
      >
        🏠 Bilim Merkezine dön
      </Link>
    </section>
  )
}

export function KidsNotFoundPage() {
  return (
    <Friendly title="Bu sayfa kayboldu!" text="Kâşif her yere baktı ama bu sayfayı bulamadı." />
  )
}

/** Route error element for the Kâşif app (maskotlu, F5.11). */
export function KidsErrorPage() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <KidsNotFoundPage />
  return (
    <div className="kasif min-h-dvh px-4">
      <Friendly
        title="Bir şeyler ters gitti"
        text="Sayfayı yenilemeyi dene. Olmazsa eğitmenine haber ver."
      />
    </div>
  )
}
