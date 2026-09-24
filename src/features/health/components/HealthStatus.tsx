import { useQuery } from '@tanstack/react-query'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui'

import { healthQueryOptions, type Health } from '../api/health.api'

const statusStyles: Record<Health['status'], { label: string; dot: string }> = {
  ok: { label: 'Çalışıyor', dot: 'bg-emerald-500' },
  degraded: { label: 'Kısmi kesinti', dot: 'bg-amber-500' },
  down: { label: 'Erişilemiyor', dot: 'bg-red-500' },
}

export function HealthStatus() {
  const { data, isPending, isError, isFetching, refetch } = useQuery(healthQueryOptions())

  if (isPending) {
    return <output className="text-sm text-fg-subtle">API durumu kontrol ediliyor…</output>
  }

  const { label, dot } = isError ? statusStyles.down : statusStyles[data.status]

  return (
    <div className="flex items-center gap-3">
      <output className="inline-flex items-center gap-2 text-sm">
        <span aria-hidden="true" className={cn('size-2.5 rounded-full', dot)} />
        API: {label}
        {!isError && data.version && <span className="text-fg-subtle">v{data.version}</span>}
      </output>
      <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={isFetching}>
        Yenile
      </Button>
    </div>
  )
}
