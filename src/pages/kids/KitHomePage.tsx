import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'

import type { KitDocument } from '@/entities/kit'
import {
  kitProgressSummary,
  track,
  useExplorerProgress,
  useResetKitProgress,
} from '@/features/activity'
import { useActiveExplorer } from '@/features/explorer'
import { KitHero, KitMenu } from '@/features/kit-player'
import { RichText } from '@/shared/ui'
import { KidButton, KidPanel, useApplyKidTheme } from '@/shared/ui/kid'

import { KidsTopBar } from './components/KidsTopBar'
import { KitLoader } from './components/KitLoader'

function KitHome({ kit }: { kit: KitDocument }) {
  const { explorer } = useActiveExplorer()
  const { progress } = useExplorerProgress(explorer?.id)
  const reset = useResetKitProgress()
  const [confirmReset, setConfirmReset] = useState(false)
  const opened = useRef(false)
  useApplyKidTheme(kit.theme)
  const summary = kitProgressSummary(kit, progress.get(kit.id))

  useEffect(() => {
    if (!explorer || opened.current) return
    opened.current = true
    track({ type: 'kit_open', explorerId: explorer.id, kitId: kit.id, stepId: null, data: {} })
  }, [explorer, kit.id])

  if (!explorer) return null
  return (
    <div className="flex flex-col gap-6 py-2">
      <title>{`${kit.title} · Kâşif`}</title>
      <KidsTopBar back={{ to: '/', label: 'Bilim Merkezine dön' }} explorer={explorer} />
      <KitHero kit={kit} ratio={summary.ratio} completedCount={summary.completedCount} />
      <KitMenu
        kit={kit}
        completed={summary.completedStepIds}
        stepHref={(slug) => `/kit/${kit.slug}/${slug}`}
      />

      {summary.done && (
        <Link
          to={`/kit/${kit.slug}/tamamlandi`}
          className="kid-focus inline-flex min-h-16 items-center justify-center gap-2 self-center rounded-[1.375rem] bg-kid-accent px-7 text-xl font-bold text-kid-accent-fg shadow-kid-3d-accent transition-transform active:translate-y-1"
        >
          🏆 Rozetimi gör
        </Link>
      )}

      <details className="group rounded-kid bg-kid-surface shadow-kid-soft">
        <summary className="kid-focus flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 rounded-kid px-5 text-xl font-bold">
          📘 Kit hakkında
          <span aria-hidden="true" className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="flex flex-col gap-4 px-5 pb-5 text-lg">
          {kit.description && <RichText text={kit.description} className="leading-relaxed" />}
          {kit.learningObjectives.length > 0 && (
            <div>
              <h2 className="mb-1 font-bold">Neler öğreneceksin?</h2>
              <ul className="list-disc pl-6">
                {kit.learningObjectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            </div>
          )}
          {kit.materials.length > 0 && (
            <div>
              <h2 className="mb-1 font-bold">Kitteki malzemeler</h2>
              <ul className="flex flex-wrap gap-2">
                {kit.materials.map((material) => (
                  <li key={material.id} className="rounded-full bg-kid-surface-2 px-3 py-1">
                    <span aria-hidden="true">{material.emoji}</span> {material.name}
                    {material.quantity && (
                      <span className="text-kid-fg-soft"> · {material.quantity}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {kit.safetyNotes.length > 0 && (
            <div role="note" className="rounded-xl bg-kid-warning-bg p-3">
              <h2 className="mb-1 font-bold">⚠️ Güvenlik</h2>
              <ul className="list-disc pl-6">
                {kit.safetyNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

      {summary.completedCount > 0 && (
        <KidPanel className="flex flex-col items-center gap-3 text-center">
          {confirmReset ? (
            <>
              <p className="text-lg font-semibold">
                Bu kitteki tüm ✓ işaretleri silinsin mi? Rozetlerin kalır.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <KidButton
                  variant="accent"
                  disabled={reset.isPending}
                  onClick={() =>
                    reset.mutate(
                      { explorerId: explorer.id, kitId: kit.id },
                      { onSettled: () => setConfirmReset(false) },
                    )
                  }
                >
                  Evet, baştan başla
                </KidButton>
                <KidButton variant="ghost" onClick={() => setConfirmReset(false)}>
                  Vazgeç
                </KidButton>
              </div>
            </>
          ) : (
            <KidButton variant="ghost" onClick={() => setConfirmReset(true)}>
              🔄 Baştan başla
            </KidButton>
          )}
        </KidPanel>
      )}
    </div>
  )
}

export function KitHomePage() {
  const { kitSlug = '' } = useParams()
  return <KitLoader slug={kitSlug}>{(kit) => <KitHome kit={kit} />}</KitLoader>
}
