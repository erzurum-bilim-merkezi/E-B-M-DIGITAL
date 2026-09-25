import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, Copy, GripVertical, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react'

import {
  BLOCK_CATALOG,
  BLOCK_TYPES,
  type BlockType,
  type KitIssue,
  type Step,
} from '@/entities/kit'
import { KitIcon } from '@/features/kit-player'
import { cn } from '@/shared/lib/cn'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui'

/** Appended to repeat an unchanged live-region message (a no-break space reads as nothing). */
const NBSP = String.fromCharCode(0xa0)

const cardTitle = (step: Step) => step.title || 'Adsız kart'

/** Spoken after every reorder, whether by drag and drop, the menu or Alt + ↑/↓ (WCAG 4.1.3). */
const movedMessage = (title: string, position: number) =>
  `“${title}” kartı ${position}. sıraya taşındı.`

type RowProps = {
  step: Step
  index: number
  count: number
  selected: boolean
  errorCount: number
  showQrCode: boolean
  onSelect: () => void
  /** `byKeyboard`: Alt + ↑/↓ on the card, which keeps focus on it after the move. */
  onMove: (to: number, byKeyboard?: boolean) => void
  onDuplicate: () => void
  onRemove: () => void
}

function StepRow({
  step,
  index,
  count,
  selected,
  errorCount,
  showQrCode,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
}: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, attributes: { roleDescription: 'sıralanabilir kart' } })
  const meta = BLOCK_CATALOG[step.type]
  const title = cardTitle(step)

  const onKeyDown = (event: KeyboardEvent) => {
    if (!event.altKey) return
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      onMove(index - 1, true)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      onMove(index + 1, true)
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative flex items-center gap-1 rounded-lg border bg-surface pr-1',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border',
        isDragging && 'z-10 shadow-lg',
      )}
      data-step-id={step.id}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`${title} kartını sürükle`}
        className="flex h-full cursor-grab items-center self-stretch rounded-l-lg px-1.5 text-fg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        data-step-select={step.id}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span
          data-card-color={step.cardColor}
          className="kid-color-card grid size-8 shrink-0 place-items-center rounded-lg text-base shadow-none"
        >
          <KitIcon icon={step.icon} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-fg">
            {index + 1}. {title}
          </span>
          <span className="truncate text-xs text-fg-subtle">
            {meta.label}
            {showQrCode && ` · ${step.qrCode}`}
          </span>
        </span>
      </button>
      {errorCount > 0 && (
        <Badge variant="danger" className="shrink-0">
          <span aria-hidden="true">{errorCount}</span>
          <span className="sr-only"> {errorCount} sorun</span>
        </Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`${title} için işlemler`}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(index - 1)}>
            <ArrowUp aria-hidden="true" /> Yukarı taşı
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(index + 1)}>
            <ArrowDown aria-hidden="true" /> Aşağı taşı
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy aria-hidden="true" /> Çoğalt
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={onRemove}>
            <Trash2 aria-hidden="true" /> Sil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

/** Ordered card list: drag & drop, menu actions and Alt+↑/↓ (F8.2). */
export function StepList({
  steps,
  selectedId,
  issues,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  showQrCodes = true,
}: {
  steps: readonly Step[]
  /** Card QR codes are hidden in single-QR ("Bir QR yeter") kits, where they are never printed. */
  showQrCodes?: boolean
  selectedId: string | null
  issues: readonly KitIssue[]
  onSelect: (stepId: string) => void
  onMove: (stepId: string, to: number) => void
  onDuplicate: (stepId: string) => void
  onRemove: (stepId: string) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const list = useRef<HTMLOListElement>(null)
  const [announcement, setAnnouncement] = useState('')
  // Reordering moves DOM nodes, which drops focus from a moved card: put it back (WCAG 2.4.3).
  const refocusId = useRef<string | null>(null)

  useEffect(() => {
    const id = refocusId.current
    if (id === null) return
    refocusId.current = null
    const cards = list.current?.querySelectorAll<HTMLElement>('[data-step-select]') ?? []
    const card = Array.from(cards).find(
      (element) => element.getAttribute('data-step-select') === id,
    )
    if (card && document.activeElement !== card) card.focus()
  })

  /** Polite live region; a repeated message still changes the text, so it is read again. */
  const announce = (message: string) =>
    setAnnouncement((previous) => (previous === message ? message + NBSP : message))

  const titleOf = (id: UniqueIdentifier) => {
    const step = steps.find((candidate) => candidate.id === id)
    return step ? cardTitle(step) : 'Kart'
  }
  const positionOf = (id: UniqueIdentifier) =>
    steps.findIndex((candidate) => candidate.id === id) + 1

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `“${titleOf(active.id)}” kartı tutuldu. Şu an ${positionOf(active.id)}. sırada.`,
    onDragOver: ({ active, over }) =>
      over
        ? `“${titleOf(active.id)}” kartı ${positionOf(over.id)}. sırada.`
        : `“${titleOf(active.id)}” kartı listenin dışında.`,
    onDragEnd: ({ active, over }) =>
      over && over.id !== active.id
        ? movedMessage(titleOf(active.id), positionOf(over.id))
        : `“${titleOf(active.id)}” kartı bırakıldı; sırası değişmedi.`,
    onDragCancel: ({ active }) =>
      `Taşıma iptal edildi. “${titleOf(active.id)}” kartı ${positionOf(active.id)}. sırada kaldı.`,
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const to = steps.findIndex((step) => step.id === over.id)
    if (to !== -1) onMove(String(active.id), to)
  }

  const move = (step: Step, to: number, byKeyboard = false) => {
    const title = cardTitle(step)
    if (to < 0) {
      announce(`“${title}” zaten ilk sırada.`)
    } else if (to >= steps.length) {
      announce(`“${title}” zaten son sırada.`)
    } else {
      onMove(step.id, to)
      if (byKeyboard) refocusId.current = step.id
      announce(movedMessage(title, to + 1))
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              'Kartı taşımak için boşluk ya da Enter tuşuna basın, ok tuşlarıyla yerini değiştirin ve bırakmak için yeniden boşluk ya da Enter tuşuna basın. Vazgeçmek için Escape tuşuna basın.',
          },
        }}
      >
        <SortableContext
          items={steps.map((step) => step.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol ref={list} aria-label="Kartlar" className="flex flex-col gap-2">
            {steps.map((step, index) => (
              <StepRow
                key={step.id}
                step={step}
                index={index}
                count={steps.length}
                selected={step.id === selectedId}
                showQrCode={showQrCodes}
                errorCount={
                  issues.filter((issue) => issue.stepId === step.id && issue.severity === 'error')
                    .length
                }
                onSelect={() => onSelect(step.id)}
                onMove={(to, byKeyboard) => move(step, to, byKeyboard)}
                onDuplicate={() => onDuplicate(step.id)}
                onRemove={() => onRemove(step.id)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <output className="sr-only">{announcement}</output>
    </>
  )
}

/** "+ Kart ekle": the 13 blocks with what they do and where E-B-M used them (F8.3). */
export function AddStepMenu({
  onAdd,
  disabled,
  ref,
}: {
  onAdd: (type: BlockType) => void
  disabled?: boolean
  /** The "Kart ekle" button (focus lands here when the last card is removed). */
  ref?: Ref<HTMLButtonElement>
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        ref={ref}
        className="w-full"
        leadingIcon={<Plus aria-hidden="true" />}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Kart ekle
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Kart ekle"
          description="Kartın etkileşim türünü seçin. Yeni karta QR kodu otomatik atanır."
          size="lg"
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {BLOCK_TYPES.map((type) => {
              const meta = BLOCK_CATALOG[type]
              return (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => {
                      onAdd(type)
                      setOpen(false)
                    }}
                    className="flex h-full w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary hover:bg-primary-subtle/40 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-muted text-xl"
                    >
                      {meta.emoji}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-fg">{meta.label}</span>
                      <span className="text-xs text-fg-muted">{meta.description}</span>
                      <span className="text-xs text-fg-subtle">E-B-M: {meta.referenceHint}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
