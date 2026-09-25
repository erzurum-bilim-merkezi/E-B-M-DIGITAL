import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { parseScannedText } from '@/entities/kit'
import { RestoreForm } from '@/features/explorer'
import { QrScanner } from '@/features/qr-entry'
import { env } from '@/shared/config/env'
import { safeKidsRedirect } from '@/shared/lib/safe-redirect'
import { KidButton, KidPanel, Mascot, SpeechBubble } from '@/shared/ui/kid'

import { KidsTopBar } from './components/KidsTopBar'

/** "Kâşif kodum var": type the code or scan the Kâşif card (KASIF:<kod>). */
export function RestorePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<string>(params.get('kod') ?? '')
  const [scanProblem, setScanProblem] = useState<string | null>(null)
  const target = safeKidsRedirect(params.get('donus'))
  const back = params.get('donus') ? `/hosgeldin?donus=${encodeURIComponent(target)}` : '/hosgeldin'

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 py-4">
      <title>Kâşif koduyla giriş · Kâşif</title>
      <KidsTopBar back={{ to: back, label: 'Geri' }} />
      <div className="flex items-end gap-3">
        <Mascot pose="hello" className="size-24 shrink-0" />
        <SpeechBubble className="mb-3 flex-1">
          Tekrar hoş geldin! Kâşif kodunu yaz ya da kartındaki QR’ı okut.
        </SpeechBubble>
      </div>
      <h1 className="text-3xl font-bold">Kâşif kodum var</h1>
      <KidPanel>
        <RestoreForm
          key={scanned}
          initialCode={scanned}
          onRestored={() => navigate(target, { replace: true })}
        />
      </KidPanel>
      <KidPanel className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">📷 Kartımdaki QR’ı okut</h2>
        {scanning ? (
          <QrScanner
            onDetected={(text) => {
              const result = parseScannedText(text, [env.VITE_PUBLIC_SITE_URL])
              if (result.kind === 'explorer-card') {
                setScanned(result.payload)
                setScanning(false)
                setScanProblem(null)
              } else {
                setScanProblem('Bu bir Kâşif kartı QR’ı değil. Kartının arkasındaki QR’ı okut.')
              }
            }}
          />
        ) : (
          <KidButton variant="surface" onClick={() => setScanning(true)}>
            QR okuyucuyu aç
          </KidButton>
        )}
        {scanProblem && (
          <p role="alert" className="text-lg font-semibold text-kid-danger">
            {scanProblem}
          </p>
        )}
      </KidPanel>
    </div>
  )
}
