import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="flex flex-col items-start gap-4">
      <p className="text-sm font-semibold text-link">404</p>
      <h1 className="text-3xl font-bold text-fg">Sayfa bulunamadı</h1>
      <p className="text-fg-muted">Aradığınız sayfa taşınmış veya silinmiş olabilir.</p>
      <Link to="/" className="text-link underline underline-offset-4">
        Ana sayfaya dön
      </Link>
    </section>
  )
}
