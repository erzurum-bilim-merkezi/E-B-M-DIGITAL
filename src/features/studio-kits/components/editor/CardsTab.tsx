import { Eye, Smartphone, Tablet, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { canRenameKit, type KitIssue, type Step, type StudioKit } from '@/entities/kit'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  Sheet,
  SheetContent,
  toast,
} from '@/shared/ui'
import { Mascot } from '@/shared/ui/kid'

import { useEditorServices } from './editor-services'
import { StepEditor } from './StepEditor'
import { AddStepMenu, StepList } from './StepList'
import type { KitDraftController } from './useKitDraft'

const MAX_STEPS = 30
/** Focus target after the last card is removed: the "Kart ekle" button. */
const ADD_BUTTON = Symbol('add-button')

type RemovedStep = { step: Step; index: number }

const stepTitle = (step: Step) => step.title || 'Adsız kart'

function PreviewPanel({
  controller,
  stepId,
}: {
  controller: KitDraftController
  stepId: string | null
}) {
  const { Preview } = useEditorServices()
  const [device, setDevice] = useState<'phone' | 'tablet'>('phone')
  const [resetKey, setResetKey] = useState(0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          label="Önizleme cihazı"
          value={device}
          onValueChange={setDevice}
          options={[
            { value: 'phone', label: 'Telefon', icon: <Smartphone aria-hidden="true" /> },
            { value: 'tablet', label: 'Tablet', icon: <Tablet aria-hidden="true" /> },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={() => setResetKey((key) => key + 1)}>
          Sıfırla
        </Button>
      </div>
      <Preview
        key={`${resetKey}-${stepId}`}
        kit={controller.draft}
        stepId={stepId}
        device={device}
      />
      <p className="text-xs text-fg-muted">Önizlemede etkinlik kaydedilmez.</p>
    </div>
  )
}

/** Cards tab (F8.1): list · editor · live preview (≥ 1280 px), preview in a sheet below. */
export function CardsTab({
  kit,
  controller,
  issues,
  selectedId,
  onSelect,
}: {
  kit: StudioKit
  controller: KitDraftController
  issues: readonly KitIssue[]
  selectedId: string | null
  onSelect: (stepId: string | null) => void
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  // The last removal stays undoable on the page, not only in a toast (WCAG 2.2.1, 3.3.4).
  const [lastRemoved, setLastRemoved] = useState<RemovedStep | null>(null)
  const toastId = useId()
  const listPanel = useRef<HTMLElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  // Where focus goes once the list has re-rendered: a card id or ADD_BUTTON (WCAG 2.4.3).
  const pendingFocus = useRef<string | typeof ADD_BUTTON | null>(null)
  const { draft } = controller
  const selected = draft.steps.find((step) => step.id === selectedId) ?? draft.steps[0] ?? null

  useEffect(() => {
    const target = pendingFocus.current
    if (target === null) return
    pendingFocus.current = null
    const cards = listPanel.current?.querySelectorAll<HTMLElement>('[data-step-select]') ?? []
    const element =
      target === ADD_BUTTON
        ? addButton.current
        : Array.from(cards).find((card) => card.getAttribute('data-step-select') === target)
    element?.focus()
  })

  // The toast must not outlive the list it changes (its undo would act on a closed editor).
  useEffect(
    () => () => {
      toast.dismiss(toastId)
    },
    [toastId],
  )

  /** `focusCard`: move focus to the restored card (the toast hands focus back by itself). */
  const undo = (removed: RemovedStep, focusCard: boolean) => {
    controller.restoreStep(removed.step, removed.index)
    onSelect(removed.step.id)
    setLastRemoved(null)
    toast.dismiss(toastId)
    if (focusCard) pendingFocus.current = removed.step.id
  }

  const remove = (stepId: string) => {
    const index = draft.steps.findIndex((step) => step.id === stepId)
    const removed = controller.removeStep(stepId)
    if (!removed) return
    const neighbour = draft.steps[index + 1] ?? draft.steps[index - 1]
    const next = neighbour && neighbour.id !== stepId ? neighbour.id : null
    onSelect(next)
    setLastRemoved(removed)
    pendingFocus.current = next ?? ADD_BUTTON
    toast(`“${stepTitle(removed.step)}” silindi`, {
      id: toastId,
      // Short-lived on purpose: the inline notice above the list is the lasting undo (WCAG 2.2.1),
      // so the toast never sits over focused controls for long (WCAG 2.4.11).
      duration: 8_000,
      description: `QR kodu ${removed.step.qrCode} bir daha kullanılmayacak.`,
      // Sonner returns focus to where it was before the toast, so no focus move here.
      action: { label: 'Geri al', onClick: () => undo(removed, false) },
    })
  }

  const dismissRemoval = () => {
    setLastRemoved(null)
    toast.dismiss(toastId)
    pendingFocus.current = selected?.id ?? ADD_BUTTON
  }

  return (
    // One shrinkable column below lg: long card titles truncate instead of widening the page.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
      <aside
        ref={listPanel}
        aria-label="Kart listesi"
        className="flex flex-col gap-3 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto"
      >
        <AddStepMenu
          ref={addButton}
          disabled={draft.steps.length >= MAX_STEPS}
          onAdd={(type) => {
            const created = controller.addStep(type)
            if (created) onSelect(created.id)
          }}
        />
        {lastRemoved && (
          <Alert
            // Sonner's live region already announces the removal; this is the lasting control.
            role="none"
            className="p-3"
            action={
              <div className="flex items-center gap-1">
                <Button size="sm" variant="secondary" onClick={() => undo(lastRemoved, true)}>
                  Geri al
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Silme bildirimini kapat"
                  onClick={dismissRemoval}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            }
          >
            “{stepTitle(lastRemoved.step)}” silindi.
          </Alert>
        )}
        {draft.steps.length > 0 && (
          <StepList
            steps={draft.steps}
            selectedId={selected?.id ?? null}
            issues={issues}
            onSelect={onSelect}
            onMove={controller.moveStep}
            onDuplicate={(stepId) => {
              const copy = controller.duplicateStep(stepId)
              if (copy) onSelect(copy.id)
            }}
            onRemove={remove}
          />
        )}
        <p className="text-xs text-fg-muted">
          Sıralamak için sürükleyin ya da kartı seçip Alt + ↑/↓ kullanın.
        </p>
        <Button
          variant="secondary"
          className="2xl:hidden"
          leadingIcon={<Eye aria-hidden="true" />}
          onClick={() => setPreviewOpen(true)}
          disabled={!selected}
        >
          Önizle
        </Button>
      </aside>

      <div className="min-w-0">
        {selected ? (
          <StepEditor
            key={selected.id}
            kit={draft}
            step={selected}
            issues={issues.filter((issue) => issue.stepId === selected.id)}
            slugLocked={!canRenameKit(kit)}
            onChange={(next) => controller.updateStep(selected.id, next)}
          />
        ) : (
          <Card>
            <EmptyState
              illustration={<Mascot pose="thinking" className="size-24" />}
              title="Bu kitte henüz kart yok"
              description="“Kart ekle” ile ilk soruyu ekleyin: dokun-keşfet, kaydırıcı, quiz, video ve daha fazlası."
            />
          </Card>
        )}
      </div>

      <aside
        aria-label="Canlı önizleme"
        className="hidden 2xl:sticky 2xl:top-20 2xl:block 2xl:max-h-[calc(100dvh-6rem)] 2xl:self-start 2xl:overflow-y-auto"
      >
        <PreviewPanel controller={controller} stepId={selected?.id ?? null} />
      </aside>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent title="Canlı önizleme" className="w-[min(100vw,30rem)]">
          <div className="p-4">
            <PreviewPanel controller={controller} stepId={selected?.id ?? null} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
