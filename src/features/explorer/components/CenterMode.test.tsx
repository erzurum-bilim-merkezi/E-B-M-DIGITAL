/* oxlint-disable no-await-in-loop -- the countdown ticks one second at a time */
import { settingsService } from '@/features/settings'
import { mockMatchMedia } from '@/test/match-media'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'
import { act, fireEvent, renderWithProviders, screen, waitFor } from '@/test/test-utils'

import { activeExplorerId, explorerKeys, explorerService, knownCodes } from '../index'
import { CENTER_IDLE_MS, CENTER_WARNING_SECONDS, CenterModeGuard } from './CenterMode'

/**
 * A family tablet with two members becomes a centre device: after the idle hand-over the next
 * child must find nothing of either of them (links, active member, restore codes).
 */
async function centreTabletWithTwoMembers() {
  const first = await explorerService.register({ nickname: 'Ada', avatar: 'sun' })
  const second = await explorerService.register({ nickname: 'Ece', avatar: 'teal' })
  signInAs('admin')
  const { setupCode } = await settingsService.createCenterDevice({
    label: 'Giriş tableti',
    pin: '2468',
  })
  sessionStorage.clear()
  await explorerService.activateCenterDevice(setupCode)
  activeExplorerId.set(second.explorer.id)
  return { first, second }
}

beforeEach(async () => {
  await seedMockBackend(MINIMAL_SEED)
  mockMatchMedia()
})

afterEach(() => {
  vi.useRealTimers()
})

it('hands the tablet over: every member unlinked, no code or active member left', async () => {
  const { first, second } = await centreTabletWithTwoMembers()
  expect(Object.keys(knownCodes.get()).toSorted()).toEqual(
    [first.explorer.id, second.explorer.id].toSorted(),
  )
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const onHandOver = vi.fn<() => void>()
  const { queryClient } = renderWithProviders(<CenterModeGuard onHandOver={onHandOver} />)
  await waitFor(() => expect(queryClient.getQueryData(explorerKeys.device())).toHaveLength(2))

  act(() => vi.advanceTimersByTime(CENTER_IDLE_MS))
  expect(screen.getByRole('dialog', { name: 'Hâlâ orada mısın?' })).toBeVisible()
  for (let tick = 0; tick < CENTER_WARNING_SECONDS; tick++) {
    await act(() => vi.advanceTimersByTimeAsync(1000))
  }
  expect(screen.getByRole('dialog', { name: /Görüşmek üzere Ece/ })).toBeVisible()
  expect(screen.getByRole('button', { name: /Sıradaki kâşif/ })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: /Sıradaki kâşif/ }))

  expect(onHandOver).toHaveBeenCalledOnce()
  await waitFor(() => expect(activeExplorerId.get()).toBeNull())
  expect(knownCodes.get()).toEqual({})
  await waitFor(async () => expect(await explorerService.listOnDevice()).toEqual([]))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('warns for at least 20 s, keeps focus in the dialog and gives it back afterwards', async () => {
  await centreTabletWithTwoMembers()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const { queryClient, user } = renderWithProviders(
    <>
      <button type="button">Kartı aç</button>
      <CenterModeGuard onHandOver={vi.fn<() => void>()} />
    </>,
  )
  await waitFor(() => expect(queryClient.getQueryData(explorerKeys.device())).toHaveLength(2))
  const pageButton = screen.getByRole('button', { name: 'Kartı aç' })
  pageButton.focus()

  act(() => vi.advanceTimersByTime(CENTER_IDLE_MS))
  expect(CENTER_WARNING_SECONDS).toBeGreaterThanOrEqual(20)
  const dialog = screen.getByRole('dialog', { name: 'Hâlâ orada mısın?' })
  expect(dialog).toHaveAccessibleDescription(
    `${CENTER_WARNING_SECONDS} saniye içinde sıradaki kâşife geçeceğiz.`,
  )
  const stay = screen.getByRole('button', { name: /Buradayım/ })
  expect(stay).toHaveFocus()

  // Tab, Shift+Tab and focus pulled outside (a tap on the backdrop) all stay in the dialog.
  await user.tab()
  expect(stay).toHaveFocus()
  await user.tab({ shift: true })
  expect(stay).toHaveFocus()
  act(() => pageButton.focus())
  expect(stay).toHaveFocus()

  for (let tick = 0; tick < 15; tick++) {
    await act(() => vi.advanceTimersByTimeAsync(1000))
  }
  expect(screen.getByRole('dialog', { name: 'Hâlâ orada mısın?' })).toBeVisible()

  await user.click(stay)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(pageButton).toHaveFocus()
})
