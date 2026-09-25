import { useState } from 'react'
import { useNavigate } from 'react-router'

import { parseScannedText } from '@/entities/kit'
import { useActiveExplorer } from '@/features/explorer'
import { CodeEntry, QrScanner } from '@/features/qr-entry'
import { env } from '@/shared/config/env'
import { KidPanel, SpeechBubble } from '@/shared/ui/kid'

import { KidsTopBar } from './components/KidsTopBar'

/** Our own site (live address + wherever this build runs) — anything else is a foreign QR. */
function allowedSites() {
  return [env.VITE_PUBLIC_SITE_URL, new URL(env.baseUrl, window.location.origin).toString()]
}

/** In-app scanner (primary path on iOS PWAs) + manual code entry. */
export function QrScanPage() {
  const navigate = useNavigate()
  const { explorer } = useActiveExplorer()
  const [problem, setProblem] = useState<string | null>(null)

  const handleText = (text: string) => {
    const result = parseScannedText(text, allowedSites())
    if (result.kind === 'code') navigate(`/q/${encodeURIComponent(result.code)}?kaynak=uygulama`)
    else if (result.kind === 'explorer-card')
      navigate(`/giris?kod=${encodeURIComponent(result.payload)}`)
    else if (result.kind === 'foreign')
      setProblem('Bu QR kodu Kâşif’e ait değil. Kit ekipmanındaki QR’ı okut.')
    else setProblem('Bu QR kodu okunamadı. Tekrar dene ya da kodu elle yaz.')
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-2">
      <title>QR Okut · Kâşif</title>
      <KidsTopBar back={{ to: '/', label: 'Bilim Merkezine dön' }} explorer={explorer} />
      <h1 className="text-3xl font-bold">📷 QR Okut</h1>
      <KidPanel className="flex flex-col gap-3 p-3 sm:p-5">
        <QrScanner onDetected={handleText} />
      </KidPanel>
      {/* Mounted before any problem (empty) so screen readers announce it (4.1.3). */}
      <SpeechBubble tail="none" live className="border-kid-danger/60">
        {problem}
      </SpeechBubble>
      <KidPanel className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">⌨️ Kodu yaz</h2>
        <CodeEntry onSubmit={(code) => navigate(`/q/${encodeURIComponent(code)}?kaynak=elle`)} />
      </KidPanel>
    </div>
  )
}
