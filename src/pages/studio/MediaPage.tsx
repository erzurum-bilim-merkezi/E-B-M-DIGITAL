import { useStaffSession } from '@/features/auth'
import { MediaLibrary } from '@/features/media-library'
import { PageHeader } from '@/shared/ui'

export function MediaPage() {
  const session = useStaffSession()
  return (
    <div className="flex flex-col gap-6">
      <title>Medya · Kâşif Studio</title>
      <PageHeader
        title="Medya"
        description="Görseller, ses kayıtları, altyazılar ve yapay zekâ sahneleri. Videolar yüklenmez; kart editöründe bağlantı olarak eklenir."
      />
      <MediaLibrary admin={session?.user.role === 'admin'} />
    </div>
  )
}
