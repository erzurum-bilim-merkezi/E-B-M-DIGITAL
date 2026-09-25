import { createStore, del, get, set } from 'idb-keyval'
import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'

import {
  createDefaultStep,
  kitDocumentSchema,
  MAX_KIT_STEPS,
  newStepId,
  nextQrCode,
  uniqueSlug,
  type BlockType,
  type KitDocument,
  type Step,
  type StudioKit,
} from '@/entities/kit'
import { AppError, isAppError } from '@/shared/api/errors'
import { studioKitSchema } from '@/entities/kit'
import { useDebouncedCallback, useHotkeys } from '@/shared/hooks/browser-hooks'

import { kitRepository } from '../../api'
import { useSaveKit } from '../../api/queries'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'offline' | 'error' | 'conflict'

/** Autosave delay after the last keystroke (F6.9). */
export const AUTOSAVE_DELAY_MS = 800

const backupSchema = z.object({
  draft: kitDocumentSchema,
  lockVersion: z.int(),
  savedAt: z.string(),
})
type DraftBackup = z.infer<typeof backupSchema>

let backupStore: ReturnType<typeof createStore> | null = null
function store() {
  backupStore ??= createStore('kasif-drafts', 'drafts')
  return backupStore
}

export async function readDraftBackup(kitId: string): Promise<DraftBackup | null> {
  try {
    const result = backupSchema.safeParse(await get(kitId, store()))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

async function writeDraftBackup(kitId: string, backup: DraftBackup) {
  try {
    await set(kitId, backup, store())
  } catch {
    // IndexedDB unavailable (private mode) — autosave still works online.
  }
}

export async function clearDraftBackup(kitId: string) {
  try {
    await del(kitId, store())
  } catch {
    // ignore
  }
}

/** Editing buffer for one kit: local draft + debounced autosave with optimistic concurrency. */
export function useKitDraft(kit: StudioKit) {
  const save = useSaveKit()
  const [draft, setDraft] = useState<KitDocument>(kit.draft)
  const [state, setState] = useState<SaveState>('saved')
  const [conflict, setConflict] = useState<StudioKit | null>(null)
  const [lastError, setLastError] = useState<unknown>(null)
  const draftRef = useRef(kit.draft)
  const lockRef = useRef(kit.lockVersion)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  /** The running save — later saves (and flush) wait for it instead of skipping. */
  const inflightRef = useRef<Promise<void> | null>(null)
  const lastErrorRef = useRef<unknown>(null)

  // Server-side changes (publish, rename, restore) replace a clean buffer.
  useEffect(() => {
    if (dirtyRef.current || savingRef.current || kit.lockVersion === lockRef.current) return
    lockRef.current = kit.lockVersion
    draftRef.current = kit.draft
    setDraft(kit.draft)
  }, [kit.draft, kit.lockVersion])

  const saveOnce = useCallback(async () => {
    const snapshot = draftRef.current
    if (!navigator.onLine) {
      setState('offline')
      await writeDraftBackup(kit.id, {
        draft: snapshot,
        lockVersion: lockRef.current,
        savedAt: new Date().toISOString(),
      })
      return
    }
    savingRef.current = true
    setState('saving')
    try {
      const saved = await save.mutateAsync({
        id: kit.id,
        draft: snapshot,
        lockVersion: lockRef.current,
      })
      lockRef.current = saved.lockVersion
      if (draftRef.current === snapshot) {
        dirtyRef.current = false
        setState('saved')
        void clearDraftBackup(kit.id)
      } else {
        setState('dirty')
      }
      setLastError(null)
      lastErrorRef.current = null
    } catch (error) {
      setLastError(error)
      lastErrorRef.current = error
      await writeDraftBackup(kit.id, {
        draft: snapshot,
        lockVersion: lockRef.current,
        savedAt: new Date().toISOString(),
      })
      if (isAppError(error, 'conflict')) {
        const latest = studioKitSchema.safeParse(error.details['latest'])
        // An adapter may not send the newer version along: fetch it, so the dialog always opens.
        const newer = latest.success
          ? latest.data
          : await kitRepository.get(kit.id).catch(() => null)
        setConflict(newer)
        setState('conflict')
      } else {
        setState(navigator.onLine ? 'error' : 'offline')
      }
    } finally {
      savingRef.current = false
    }
  }, [kit.id, save])

  /** Saves the buffer if it is dirty — one save at a time, never skipping a pending change. */
  const persist = useCallback(async () => {
    // Sequential by design: wait for the running save, then save what changed meanwhile.
    while (inflightRef.current) {
      // oxlint-disable-next-line no-await-in-loop -- one save at a time (optimistic lock)
      await inflightRef.current
    }
    if (!dirtyRef.current) return
    const run = saveOnce()
    inflightRef.current = run
    try {
      await run
    } finally {
      if (inflightRef.current === run) inflightRef.current = null
    }
  }, [saveOnce])

  const autosave = useDebouncedCallback(() => void persist(), AUTOSAVE_DELAY_MS)

  // Keep saving while the user keeps typing during a save.
  useEffect(() => {
    if (state === 'dirty' && !savingRef.current && dirtyRef.current) autosave.run()
  }, [autosave, state])

  const update = useCallback(
    (mutator: (current: KitDocument) => KitDocument) => {
      const next = mutator(draftRef.current)
      if (next === draftRef.current) return
      draftRef.current = next
      dirtyRef.current = true
      setDraft(next)
      setState((current) => (current === 'conflict' ? current : 'dirty'))
      autosave.run()
    },
    [autosave],
  )

  /**
   * Saves now; resolves with the lock version the server has afterwards. Rejects when the edits
   * could not be saved (offline, conflict, server error) — callers must not publish then.
   */
  const flush = useCallback(async () => {
    autosave.cancel()
    // Edits typed while a save runs are saved as well; stop at the first save that fails.
    for (let round = 0; round < 5; round++) {
      lastErrorRef.current = null
      // oxlint-disable-next-line no-await-in-loop -- saves run one after another (optimistic lock)
      await persist()
      if (!dirtyRef.current) return lockRef.current
      if (lastErrorRef.current || !navigator.onLine) break
    }
    const error = lastErrorRef.current
    throw isAppError(error)
      ? error
      : new AppError(
          'unavailable',
          'Değişiklikler sunucuya kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.',
        )
  }, [autosave, persist])

  // Back online → save what was kept locally.
  useEffect(() => {
    const onOnline = () => {
      if (dirtyRef.current) void persist()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [persist])

  // Leaving the editor inside the app (a link, the palette) must not drop the last 800 ms of
  // edits: keep a local backup and send them in the background.
  const persistRef = useRef(persist)
  useEffect(() => {
    persistRef.current = persist
  }, [persist])
  useEffect(
    () => () => {
      if (!dirtyRef.current) return
      void writeDraftBackup(kit.id, {
        draft: draftRef.current,
        lockVersion: lockRef.current,
        savedAt: new Date().toISOString(),
      })
      void persistRef.current()
    },
    [kit.id],
  )

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useHotkeys([
    {
      combo: 'mod+s',
      allowInInputs: true,
      handler: (event) => {
        event.preventDefault()
        // The save indicator shows why a save failed.
        flush().catch(() => {})
      },
    },
  ])

  /** Conflict: take the other version, or overwrite it with ours. */
  const resolveConflict = useCallback(
    (choice: 'theirs' | 'mine') => {
      if (!conflict) return
      lockRef.current = conflict.lockVersion
      if (choice === 'theirs') {
        dirtyRef.current = false
        draftRef.current = conflict.draft
        setDraft(conflict.draft)
        setState('saved')
        void clearDraftBackup(kit.id)
      } else {
        dirtyRef.current = true
        setState('dirty')
        void persist()
      }
      setConflict(null)
    },
    [conflict, kit.id, persist],
  )

  const restoreBackup = useCallback(
    (backup: DraftBackup) => {
      // Save against the version the backup was made from: if someone saved since, the server
      // answers with a conflict and the usual dialog lets the user choose — nothing is overwritten.
      lockRef.current = backup.lockVersion
      update(() => ({
        ...backup.draft,
        id: kit.id,
        slug: kit.slug,
        qrPrefix: kit.qrPrefix,
        qrSequence: Math.max(backup.draft.qrSequence, draftRef.current.qrSequence),
      }))
    },
    [kit.id, kit.qrPrefix, kit.slug, update],
  )

  // ---- card operations ------------------------------------------------------------------

  const updateStep = useCallback(
    (stepId: string, next: Step) =>
      update((current) => ({
        ...current,
        steps: current.steps.map((step) => (step.id === stepId ? next : step)),
      })),
    [update],
  )

  /** Adds a card; its QR code comes from the never-decreasing counter. */
  const addStep = useCallback(
    (type: BlockType, index?: number): Step => {
      const current = draftRef.current
      const { code, qrSequence } = nextQrCode(current)
      const slugs = new Set(current.steps.map((step) => step.slug))
      const draftStep = createDefaultStep(type, { id: newStepId(), slug: 'kart', qrCode: code })
      const step: Step = { ...draftStep, slug: uniqueSlug(draftStep.title, slugs) }
      const steps = [...current.steps]
      steps.splice(index ?? steps.length, 0, step)
      update(() => ({ ...current, qrSequence, steps }))
      return step
    },
    [update],
  )

  const duplicateStep = useCallback(
    (stepId: string): Step | null => {
      const current = draftRef.current
      const index = current.steps.findIndex((step) => step.id === stepId)
      const source = current.steps[index]
      if (!source) return null
      const { code, qrSequence } = nextQrCode(current)
      const slugs = new Set(current.steps.map((step) => step.slug))
      const title = `${source.title} (kopya)`.slice(0, 80)
      const copy: Step = {
        ...structuredClone(source),
        id: newStepId(),
        slug: uniqueSlug(title, slugs),
        title,
        qrCode: code,
      }
      const steps = [...current.steps]
      steps.splice(index + 1, 0, copy)
      update(() => ({ ...current, qrSequence, steps }))
      return copy
    },
    [update],
  )

  /** Removes a card; its QR number is never handed out again (qrSequence stays). */
  const removeStep = useCallback(
    (stepId: string) => {
      const index = draftRef.current.steps.findIndex((step) => step.id === stepId)
      const removed = draftRef.current.steps[index]
      update((current) => ({
        ...current,
        steps: current.steps.filter((step) => step.id !== stepId),
      }))
      return removed ? { step: removed, index } : null
    },
    [update],
  )

  /**
   * Puts a removed card back (undo). Returns false when it cannot: the card is still there or
   * the kit is full. A card added meanwhile may have taken its address; the restored card then
   * gets a free one, so the draft stays saveable.
   */
  const restoreStep = useCallback(
    (step: Step, index: number): boolean => {
      const cannotRestore = (candidate: KitDocument) =>
        candidate.steps.some((existing) => existing.id === step.id) ||
        candidate.steps.length >= MAX_KIT_STEPS
      if (cannotRestore(draftRef.current)) return false
      // Re-checked on the latest draft: another update may be queued in the same tick.
      update((current) => {
        if (cannotRestore(current)) return current
        const slugs = new Set(current.steps.map((existing) => existing.slug))
        const restored = slugs.has(step.slug)
          ? { ...step, slug: uniqueSlug(step.slug, slugs) }
          : step
        const steps = [...current.steps]
        steps.splice(Math.min(index, steps.length), 0, restored)
        return { ...current, steps }
      })
      return true
    },
    [update],
  )

  const moveStep = useCallback(
    (stepId: string, toIndex: number) =>
      update((current) => {
        const from = current.steps.findIndex((step) => step.id === stepId)
        if (from === -1 || toIndex < 0 || toIndex >= current.steps.length || from === toIndex)
          return current
        const steps = [...current.steps]
        const [step] = steps.splice(from, 1)
        if (step) steps.splice(toIndex, 0, step)
        return { ...current, steps }
      }),
    [update],
  )

  return {
    draft,
    state,
    lastError,
    conflict,
    update,
    flush,
    resolveConflict,
    restoreBackup,
    updateStep,
    addStep,
    duplicateStep,
    removeStep,
    restoreStep,
    moveStep,
  }
}

export type KitDraftController = ReturnType<typeof useKitDraft>
