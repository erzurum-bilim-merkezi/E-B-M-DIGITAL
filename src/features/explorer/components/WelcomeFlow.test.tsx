import { mockMatchMedia } from '@/test/match-media'
import { MINIMAL_SEED, seedMockBackend } from '@/test/mock-backend'
import { renderWithProviders, screen, waitFor } from '@/test/test-utils'

import { centerDevice } from '../api/device'
import { WelcomeFlow } from './WelcomeFlow'

function renderFlow() {
  return renderWithProviders(
    <WelcomeFlow
      continueTo={null}
      restoreHref="/giris"
      privacyHref="/aydinlatma"
      onDone={vi.fn<(target: string) => void>()}
    />,
  )
}

const nickname = () => screen.getByRole('textbox', { name: 'Adın' })

beforeEach(async () => {
  await seedMockBackend(MINIMAL_SEED)
  mockMatchMedia()
})

afterEach(() => {
  centerDevice.set(null)
})

it('moves focus to each screen’s heading, so the restore code screen is announced', async () => {
  const { user } = renderFlow()

  await user.type(nickname(), 'Deniz')
  await user.click(screen.getByRole('button', { name: /Devam/ }))
  expect(screen.getByRole('heading', { level: 1, name: 'Avatarını seç' })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: /Adımı değiştir/ }))
  expect(screen.getByRole('heading', { level: 1, name: 'Kâşif’e hoş geldin' })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: /Devam/ }))
  const enter = screen.getByRole('button', { name: /Bilim Merkezine Gir/ })
  await user.click(enter)
  const welcome = await screen.findByRole('heading', { level: 1, name: 'Hoş geldin Deniz!' })
  await waitFor(() => expect(welcome).toHaveFocus())
  expect(screen.getByTestId('restore-code')).toHaveTextContent(/^KSF-/)
})

it('offers the saved nickname on a personal device only (WCAG 1.3.5)', () => {
  const { unmount } = renderFlow()
  expect(nickname()).toHaveAttribute('autocomplete', 'nickname')
  unmount()

  // A shared centre tablet must not suggest the previous child's name.
  centerDevice.set({ id: crypto.randomUUID(), label: 'Giriş tableti' })
  renderFlow()
  expect(nickname()).toHaveAttribute('autocomplete', 'off')
})
