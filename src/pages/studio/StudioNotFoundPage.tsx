import { Link } from 'react-router'

import { buttonClasses, EmptyState } from '@/shared/ui'
import { Mascot } from '@/shared/ui/kid'

export function StudioNotFoundPage() {
  return (
    <>
      <title>Sayfa bulunamadı · Kâşif Studio</title>
      <EmptyState
        titleAs="h1"
        illustration={<Mascot pose="thinking" className="size-24" />}
        title="Sayfa bulunamadı"
        description="Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir."
        action={
          <Link to="/studio" className={buttonClasses()}>
            Panoya dön
          </Link>
        }
      />
    </>
  )
}
