import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

export function RouteErrorPage() {
  const error = useRouteError()
  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Sayfa yüklenemedi'

  return (
    <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-fg">{title}</h1>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="overflow-auto rounded-md bg-surface-muted p-3 font-mono text-xs text-danger">
          {error.message}
        </pre>
      )}
      <Link to="/" className="text-link underline underline-offset-4">
        Ana sayfaya dön
      </Link>
    </div>
  )
}
