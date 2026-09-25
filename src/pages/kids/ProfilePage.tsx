import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import {
  CenterDeviceExit,
  CenterDeviceSetup,
  ExplorerCard,
  ExplorerSwitcher,
  MAX_EXPLORERS_PER_DEVICE,
  ProfileSettings,
  useActiveExplorer,
  useCenterDevice,
  useDeleteMembership,
  useUnlinkExplorer,
} from '@/features/explorer'
import { errorMessage } from '@/shared/api/errors'
import { useFocusAfterUpdate } from '@/shared/hooks/focus-hooks'
import { KidButton, KidPanel } from '@/shared/ui/kid'

import { KidsTopBar } from './components/KidsTopBar'

export function ProfilePage() {
  const navigate = useNavigate()
  const { explorer, explorers, activeId } = useActiveExplorer()
  const center = useCenterDevice()
  const unlink = useUnlinkExplorer()
  const remove = useDeleteMembership()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [showCenterSetup, setShowCenterSetup] = useState(false)
  const deleteTrigger = useRef<HTMLButtonElement>(null)
  const deleteCancel = useRef<HTMLButtonElement>(null)
  const focusAfterUpdate = useFocusAfterUpdate()

  if (!explorer) return null
  // A centre tablet seats one explorer at a time; the next child joins after the hand-over.
  const canAddMore = center === null && explorers.length < MAX_EXPLORERS_PER_DEVICE

  // The confirm replaces its trigger: focus the safe choice on open and the trigger on cancel,
  // so the next Tab never lands on "Evet, her şeyi sil" by surprise (2.4.3).
  const askDelete = (open: boolean) => {
    setConfirmDelete(open)
    focusAfterUpdate(open ? deleteCancel : deleteTrigger)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 py-2">
      <title>Profilim · Kâşif</title>
      <KidsTopBar back={{ to: '/', label: 'Bilim Merkezine dön' }} />
      <h1 className="text-3xl font-bold">Profilim</h1>

      <ExplorerCard explorer={explorer} />
      <ProfileSettings explorer={explorer} />
      {center === null && (
        <ExplorerSwitcher
          explorers={explorers}
          activeId={activeId}
          onSwitched={() => navigate('/')}
        />
      )}

      <KidPanel as="section" aria-labelledby="device-title" className="flex flex-col gap-3">
        <h2 id="device-title" className="text-2xl font-bold">
          📱 Bu cihaz
        </h2>
        {canAddMore && (
          <Link
            to="/hosgeldin?yeni=1"
            className="kid-focus inline-flex min-h-14 items-center justify-center rounded-[1.25rem] bg-kid-surface-2 px-5 text-lg font-bold"
          >
            ➕ Yeni kâşif ekle
          </Link>
        )}
        {center === null && (
          <KidButton
            variant="surface"
            aria-disabled={unlink.isPending}
            onClick={() => {
              if (unlink.isPending) return
              unlink.mutate(explorer.id, {
                onSuccess: () => navigate('/hosgeldin', { replace: true }),
              })
            }}
          >
            🚪 Bu cihazdan çık
          </KidButton>
        )}
        <p className="text-base text-kid-fg-soft">
          Çıksan da üyeliğin silinmez; Kâşif kodunla tekrar girebilirsin.
        </p>
      </KidPanel>

      <KidPanel as="section" aria-labelledby="center-title" className="flex flex-col gap-3">
        <h2 id="center-title" className="text-2xl font-bold">
          🏛️ Merkez cihazı
        </h2>
        {center ? (
          <>
            <p className="text-lg">
              Bu cihaz <strong>{center.label}</strong> olarak merkez modunda. 90 saniye dokunulmazsa
              sıradaki kâşife geçer.
            </p>
            <CenterDeviceExit onExited={() => navigate('/', { replace: true })} />
          </>
        ) : showCenterSetup ? (
          <CenterDeviceSetup onActivated={() => setShowCenterSetup(false)} />
        ) : (
          <KidButton variant="ghost" onClick={() => setShowCenterSetup(true)}>
            Eğitmen: bu cihazı merkez cihazı yap
          </KidButton>
        )}
      </KidPanel>

      <KidPanel as="section" aria-labelledby="privacy-title" className="flex flex-col gap-3">
        <h2 id="privacy-title" className="text-2xl font-bold">
          🛡️ Verilerim
        </h2>
        <Link
          to="/aydinlatma"
          className="kid-focus self-start rounded-lg text-lg font-semibold text-kid-link underline underline-offset-4"
        >
          Aydınlatma metnini oku
        </Link>
        {confirmDelete ? (
          <div
            role="alertdialog"
            aria-labelledby="delete-confirm"
            className="flex flex-col gap-3 rounded-kid bg-kid-danger-bg p-4"
          >
            <p id="delete-confirm" className="text-lg font-semibold">
              Üyeliğin, ilerlemen, rozetlerin ve tüm etkinlik kayıtların kalıcı olarak silinecek.
              Emin misin?
            </p>
            <div className="flex flex-wrap gap-3">
              <KidButton
                variant="primary"
                aria-disabled={remove.isPending}
                onClick={() => {
                  if (remove.isPending) return
                  remove.mutate(explorer.id, {
                    onSuccess: () => navigate('/hosgeldin', { replace: true }),
                    onError: (error) => setProblem(errorMessage(error)),
                  })
                }}
              >
                Evet, her şeyi sil
              </KidButton>
              <KidButton ref={deleteCancel} variant="ghost" onClick={() => askDelete(false)}>
                Vazgeç
              </KidButton>
            </div>
          </div>
        ) : (
          <KidButton ref={deleteTrigger} variant="surface" onClick={() => askDelete(true)}>
            🗑️ Üyeliğimi ve verilerimi sil
          </KidButton>
        )}
        {problem && (
          <p role="alert" className="text-lg font-semibold text-kid-danger">
            {problem}
          </p>
        )}
      </KidPanel>
    </div>
  )
}
