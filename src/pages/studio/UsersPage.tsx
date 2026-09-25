import { UsersManager } from '@/features/auth'
import { PageHeader } from '@/shared/ui'

export function UsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <title>Kullanıcılar · Kâşif Studio</title>
      <PageHeader
        title="Kullanıcılar"
        description="Studio personelini yönetin. Yöneticiler kitleri yayınlar ve iki adımlı doğrulama kullanır; editörler kit hazırlayıp incelemeye gönderir."
      />
      <UsersManager />
    </div>
  )
}
