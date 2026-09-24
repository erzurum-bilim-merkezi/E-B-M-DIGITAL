import { screen, waitFor, within } from '@testing-library/react'

import { activeExplorerId, explorerService } from '@/features/explorer'
import { settingsService } from '@/features/settings'
import { renderApp } from '@/test/app-harness'
import { mockMatchMedia } from '@/test/match-media'
import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'

// Whole-app renders with seeded data: generous limits so a busy CI machine does not flake.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 })

/** Two members on this browser; the first one is using the app. */
async function twoMembers() {
  const first = await explorerService.register({ nickname: 'Ada', avatar: 'sun' })
  await explorerService.register({ nickname: 'Ece', avatar: 'teal' })
  activeExplorerId.set(first.explorer.id)
}

async function becomeCentreDevice() {
  signInAs('admin')
  const { setupCode } = await settingsService.createCenterDevice({
    label: 'Giriş tableti',
    pin: '2468',
  })
  sessionStorage.clear()
  await explorerService.activateCenterDevice(setupCode)
}

beforeEach(async () => {
  await seedMockBackend(MINIMAL_SEED)
  mockMatchMedia()
})

it('lets a family device switch between members and add another', async () => {
  await twoMembers()

  renderApp('/profil')

  expect(await screen.findByRole('heading', { level: 1, name: 'Profilim' })).toBeVisible()
  expect(await screen.findByRole('heading', { name: /Kâşif değiştir/ })).toBeVisible()
  expect(screen.getByRole('button', { name: /Ece/ })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Yeni kâşif ekle/ })).toBeInTheDocument()
})

it('shows only the active explorer on a centre tablet', async () => {
  await twoMembers()
  await becomeCentreDevice()

  renderApp('/profil')

  expect(await screen.findByRole('heading', { level: 1, name: 'Profilim' })).toBeVisible()
  expect(await screen.findByText(/merkez modunda/)).toBeVisible()
  expect(screen.queryByRole('heading', { name: /Kâşif değiştir/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Ece/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Yeni kâşif ekle/ })).not.toBeInTheDocument()
})

it('focuses "Vazgeç" when a confirmation opens and the trigger when it closes', async () => {
  await twoMembers()
  const { user } = renderApp('/profil')

  // Delete membership: the next Tab must not land on "Evet, her şeyi sil" by surprise.
  await user.click(await screen.findByRole('button', { name: /Üyeliğimi ve verilerimi sil/ }))
  const deleting = screen.getByRole('alertdialog')
  expect(within(deleting).getByRole('button', { name: 'Vazgeç' })).toHaveFocus()
  await user.click(within(deleting).getByRole('button', { name: 'Vazgeç' }))
  expect(screen.getByRole('button', { name: /Üyeliğimi ve verilerimi sil/ })).toHaveFocus()

  // Renew the code: cancel, then confirm — focus returns to "Kodumu yenile" both times.
  await user.click(screen.getByRole('button', { name: /Kodumu yenile/ }))
  let renewing = screen.getByRole('alertdialog')
  expect(within(renewing).getByRole('button', { name: 'Vazgeç' })).toHaveFocus()
  await user.click(within(renewing).getByRole('button', { name: 'Vazgeç' }))
  expect(screen.getByRole('button', { name: /Kodumu yenile/ })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: /Kodumu yenile/ }))
  renewing = screen.getByRole('alertdialog')
  await user.click(within(renewing).getByRole('button', { name: /Evet, yeni kod oluştur/ }))
  expect(await screen.findByText(/Yeni Kâşif kodun hazır/)).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: /Kodumu yenile/ })).toHaveFocus())
})

it('does not open "add another explorer" on a centre tablet while one is active', async () => {
  await twoMembers()
  await becomeCentreDevice()

  const { router } = renderApp('/hosgeldin?yeni=1')

  await waitFor(() => expect(router.state.location.pathname).toBe('/'))
})
