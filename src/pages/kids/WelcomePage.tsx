import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'

import { useActiveExplorer, useCenterDevice, WelcomeFlow } from '@/features/explorer'
import { safeKidsRedirect } from '@/shared/lib/safe-redirect'

import { KidsTopBar } from './components/KidsTopBar'

export function WelcomePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { explorer, isPending } = useActiveExplorer()
  const center = useCenterDevice()
  const rawTarget = params.get('donus')
  const continueTo = rawTarget ? safeKidsRedirect(rawTarget) : null
  const addingAnother = params.get('yeni') === '1'
  const query = continueTo ? `?donus=${encodeURIComponent(continueTo)}` : ''

  // Joining makes the new explorer active; keep showing the flow (restore code) until it ends.
  const [joining, setJoining] = useState(false)

  // A centre tablet seats one explorer at a time: no "add another" while one is active.
  if (!joining && !isPending && explorer && (!addingAnother || center !== null))
    return <Navigate to={continueTo ?? '/'} replace />

  return (
    <div className="flex min-h-[85dvh] flex-col justify-center gap-4 py-6">
      <title>Hoş geldin · Kâşif</title>
      {addingAnother && <KidsTopBar back={{ to: '/profil', label: 'Profile dön' }} />}
      <WelcomeFlow
        continueTo={continueTo}
        restoreHref={`/giris${query}`}
        privacyHref="/aydinlatma"
        alwaysShowCode={center !== null}
        onJoinStart={() => setJoining(true)}
        onDone={(target) => navigate(safeKidsRedirect(target), { replace: true })}
      />
    </div>
  )
}
