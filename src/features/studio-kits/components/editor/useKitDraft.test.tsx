import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { KUCUK_CIFTCILER, type StudioKit } from '@/entities/kit'
import { mockControl } from '@/shared/api/mock-db'
import { seedMockBackend, signInAs } from '@/test/mock-backend'
import { act, createTestQueryClient, renderHook, waitFor } from '@/test/test-utils'

import { kitRepository } from '../../index'
import { useKitDraft } from './useKitDraft'

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
}

function renderDraft(kit: StudioKit) {
  return renderHook(({ current }: { current: StudioKit }) => useKitDraft(current), {
    wrapper: Wrapper,
    initialProps: { current: kit },
  })
}

function createKit() {
  const document = KUCUK_CIFTCILER
  return kitRepository.create({
    templateId: 'blank',
    title: document.title,
    slug: document.slug,
    qrPrefix: document.qrPrefix,
    tagline: document.tagline,
    description: document.description,
    category: document.category,
    ageRange: document.ageRange,
    durationMinutes: document.durationMinutes,
    icon: document.icon,
    document,
  })
}

const [TOHUM, MARUL] = KUCUK_CIFTCILER.steps

/**
 * Fake only the debounce clock. fake-indexeddb schedules transactions with setImmediate; faking
 * that too would strand them when real timers come back and hang every later backup read/write.
 */
const AUTOSAVE_TIMERS = {
  shouldAdvanceTime: true,
  toFake: ['setTimeout', 'clearTimeout'],
} satisfies Parameters<typeof vi.useFakeTimers>[0]

beforeEach(async () => {
  await seedMockBackend({ staff: true, kits: [], activity: 'none' })
  signInAs('admin')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useKitDraft', () => {
  it('takes over server changes while the buffer is clean', async () => {
    const kit = await createKit()
    const { result, rerender } = renderDraft(kit)
    const renamed = await kitRepository.rename(kit.id, 'bahce-kiti', 'BK', kit.lockVersion)

    rerender({ current: renamed })

    expect(result.current.draft).toMatchObject({ slug: 'bahce-kiti', qrPrefix: 'BK' })
    // The buffer also took the new lock version: the next save does not conflict.
    act(() => result.current.update((draft) => ({ ...draft, title: 'Bahçe' })))
    await act(async () => {
      expect(await result.current.flush()).toBe(renamed.lockVersion + 1)
    })
    expect(result.current.state).toBe('saved')
  })

  it('keeps local edits when the server copy changes underneath', async () => {
    const kit = await createKit()
    const { result, rerender } = renderDraft(kit)
    act(() => result.current.update((draft) => ({ ...draft, title: 'Benim adım' })))
    const other = await kitRepository.update(
      kit.id,
      { ...kit.draft, title: 'Onların adı' },
      kit.lockVersion,
    )

    rerender({ current: other })

    expect(result.current.draft.title).toBe('Benim adım')
    expect(result.current.state).toBe('dirty')
  })

  it('saves edits made while a save was running', async () => {
    vi.useFakeTimers(AUTOSAVE_TIMERS)
    const kit = await createKit()
    const { result } = renderDraft(kit)
    mockControl.hold('kits.update')
    act(() => result.current.update((draft) => ({ ...draft, title: 'Birinci' })))
    let saving: Promise<number> | undefined
    act(() => {
      saving = result.current.flush()
    })
    expect(result.current.state).toBe('saving')

    act(() => result.current.update((draft) => ({ ...draft, title: 'İkinci' })))
    mockControl.release('kits.update')
    // flush() keeps saving until the edits typed during the first save are on the server too.
    await act(async () => {
      expect(await saving).toBe(2)
    })

    await waitFor(() => expect(result.current.state).toBe('saved'))
    expect(await kitRepository.get(kit.id)).toMatchObject({
      lockVersion: 2,
      draft: { title: 'İkinci' },
    })
  })

  it('restoring an old backup raises a conflict instead of overwriting a newer save', async () => {
    const kit = await createKit()
    const backup = {
      draft: { ...kit.draft, tagline: 'Yedekteki açıklama' },
      lockVersion: kit.lockVersion,
      savedAt: new Date().toISOString(),
    }
    // Meanwhile someone else saved the kit.
    await kitRepository.update(
      kit.id,
      { ...kit.draft, tagline: 'Başkasının açıklaması' },
      kit.lockVersion,
    )
    const { result } = renderDraft(await kitRepository.get(kit.id))

    act(() => result.current.restoreBackup(backup))
    await act(async () => {
      await expect(result.current.flush()).rejects.toMatchObject({ code: 'conflict' })
    })

    expect(result.current.state).toBe('conflict')
    expect(result.current.conflict?.draft.tagline).toBe('Başkasının açıklaması')
    expect((await kitRepository.get(kit.id)).draft.tagline).toBe('Başkasının açıklaması')
  })

  it('saves pending edits when the editor is left before the autosave fires', async () => {
    const kit = await createKit()
    const { result, unmount } = renderDraft(kit)

    act(() => result.current.update((draft) => ({ ...draft, title: 'Kapanmadan önce' })))
    unmount()

    await waitFor(async () =>
      expect((await kitRepository.get(kit.id)).draft.title).toBe('Kapanmadan önce'),
    )
  })

  it('reports offline when the connection drops during a failed save', async () => {
    const kit = await createKit()
    const { result } = renderDraft(kit)
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValueOnce(true).mockReturnValue(false)
    mockControl.failNext('kits.update', 'network')
    act(() => result.current.update((draft) => ({ ...draft, title: 'Yolda' })))

    // flush() rejects, so a publish that waits for it never goes out with older content.
    await act(async () => {
      await expect(result.current.flush()).rejects.toMatchObject({ code: 'network' })
    })

    expect(result.current.state).toBe('offline')
    expect(result.current.lastError).toMatchObject({ code: 'network' })
  })

  it('does nothing when there is nothing to save', async () => {
    const kit = await createKit()
    const { result } = renderDraft(kit)

    await act(async () => {
      expect(await result.current.flush()).toBe(0)
    })

    expect(result.current.state).toBe('saved')
    expect((await kitRepository.get(kit.id)).lockVersion).toBe(0)
  })

  it('ignores conflict choices when there is no conflict', async () => {
    const kit = await createKit()
    const { result } = renderDraft(kit)

    act(() => result.current.resolveConflict('theirs'))

    expect(result.current.state).toBe('saved')
    expect(result.current.draft).toBe(kit.draft)
  })

  describe('card operations', () => {
    it('inserts a new card at a position with the next QR code', async () => {
      const kit = await createKit()
      const { result } = renderDraft(kit)

      let created: ReturnType<typeof result.current.addStep> | undefined
      act(() => {
        created = result.current.addStep('quiz', 1)
      })

      expect(created).toMatchObject({ type: 'quiz', qrCode: 'KC-08', slug: 'soru-zamani' })
      expect(result.current.draft.steps[1]?.id).toBe(created?.id)
      expect(result.current.draft.qrSequence).toBe(8)
    })

    it('never hands a deleted card’s code to the next card', async () => {
      const kit = await createKit()
      const { result } = renderDraft(kit)

      act(() => {
        result.current.removeStep(TOHUM!.id)
      })
      let created: ReturnType<typeof result.current.addStep> | undefined
      act(() => {
        created = result.current.addStep('info')
      })

      expect(created?.qrCode).toBe('KC-08')
      expect(result.current.draft.steps.map((step) => step.qrCode)).not.toContain('KC-01')
    })

    it('ignores unknown cards and moves outside the list', async () => {
      const kit = await createKit()
      const { result } = renderDraft(kit)
      const before = result.current.draft

      act(() => {
        expect(result.current.duplicateStep('s-yok')).toBeNull()
        result.current.moveStep(TOHUM!.id, -1)
        result.current.moveStep(TOHUM!.id, 0)
        result.current.moveStep('s-yok', 2)
        result.current.restoreStep(MARUL!, 0)
      })

      expect(result.current.draft).toBe(before)
      expect(result.current.state).toBe('saved')
    })

    it('puts a restored card back at its old position', async () => {
      const kit = await createKit()
      const { result } = renderDraft(kit)

      let removed: ReturnType<typeof result.current.removeStep> = null
      act(() => {
        removed = result.current.removeStep(MARUL!.id)
      })
      act(() => {
        if (removed) result.current.restoreStep(removed.step, removed.index)
      })

      expect(result.current.draft.steps.map((step) => step.id)).toEqual(
        KUCUK_CIFTCILER.steps.map((step) => step.id),
      )
    })

    it('updates one card', async () => {
      const kit = await createKit()
      const { result } = renderDraft(kit)

      act(() => result.current.updateStep(MARUL!.id, { ...MARUL!, hint: 'Kaydır!' }))

      expect(result.current.draft.steps[1]?.hint).toBe('Kaydır!')
      expect(result.current.draft.steps[0]).toBe(kit.draft.steps[0])
    })
  })
})
