import type { FallbackProps } from 'react-error-boundary'

import { Button } from './Button'

export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-fg">Beklenmeyen bir hata oluştu</h1>
      <p className="text-fg-muted">
        Sayfayı yenilemeyi deneyin. Sorun devam ederse destek ekibiyle iletişime geçin.
      </p>
      {import.meta.env.DEV && error instanceof Error && (
        <pre className="overflow-auto rounded-md bg-surface-muted p-3 font-mono text-xs text-danger">
          {error.message}
        </pre>
      )}
      <Button onClick={resetErrorBoundary} className="self-start">
        Tekrar dene
      </Button>
    </div>
  )
}
