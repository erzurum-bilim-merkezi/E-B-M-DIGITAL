import { HealthStatus } from '@/features/health'
import { env } from '@/shared/config/env'

export function HomePage() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          {env.VITE_APP_NAME}
        </h1>
        <p className="max-w-2xl text-lg text-fg-muted">
          Uygulama altyapısı hazır. Yeni özellikleri <code>src/features</code> altında geliştirin.
        </p>
      </div>
      <HealthStatus />
    </section>
  )
}
