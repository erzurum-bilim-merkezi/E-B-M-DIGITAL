import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { Mascot } from '@/shared/ui/kid'

function describe(error: unknown) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 403)
      return {
        title: 'Bu sayfa için yetkiniz yok',
        text:
          typeof error.data === 'string' ? error.data : 'Yöneticinizden yetki isteyebilirsiniz.',
      }
    if (error.status === 404)
      return {
        title: 'Sayfa bulunamadı',
        text: 'Aradığınız sayfa taşınmış veya silinmiş olabilir.',
      }
    return { title: `${error.status} ${error.statusText}`, text: 'Sayfa yüklenemedi.' }
  }
  return {
    title: 'Sayfa yüklenemedi',
    text: 'Sayfayı yenilemeyi deneyin. Sorun sürerse destek ekibine haber verin.',
  }
}

export function RouteErrorPage({ variant = 'plain' }: { variant?: 'kids' | 'studio' | 'plain' }) {
  const error = useRouteError()
  const { title, text } = describe(error)

  if (variant === 'kids') {
    return (
      <div className="kasif grid min-h-dvh place-items-center px-4">
        <div role="alert" className="flex max-w-md flex-col items-center gap-4 text-center">
          <title>{`${title} · Kâşif`}</title>
          <Mascot pose="thinking" className="size-36" />
          <h1 className="text-3xl font-bold">
            {title === 'Sayfa bulunamadı' ? 'Bu sayfa kayboldu!' : 'Bir şeyler ters gitti'}
          </h1>
          <p className="text-xl text-kid-fg-soft">{text}</p>
          <Link
            to="/"
            className="kid-focus inline-flex min-h-16 items-center rounded-[1.375rem] bg-kid-primary px-8 text-xl font-bold text-kid-primary-fg shadow-kid-3d"
          >
            🏠 Bilim Merkezine dön
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <title>{`${title} · Kâşif Studio`}</title>
      <p className="text-sm font-semibold text-link">
        {isRouteErrorResponse(error) ? error.status : 'Hata'}
      </p>
      <h1 className="text-2xl font-semibold text-fg">{title}</h1>
      <p className="text-fg-muted">{text}</p>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="overflow-auto rounded-md bg-surface-muted p-3 font-mono text-xs text-danger">
          {error.message}
        </pre>
      )}
      <Link
        to={variant === 'studio' ? '/studio' : '/'}
        className="text-link underline underline-offset-4"
      >
        {variant === 'studio' ? 'Panoya dön' : 'Ana sayfaya dön'}
      </Link>
    </div>
  )
}
