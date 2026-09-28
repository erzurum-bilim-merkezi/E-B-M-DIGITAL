import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'
import { renderWithProviders, screen } from '@/test/test-utils'

import { KitCreatePage } from './KitCreatePage'

beforeEach(async () => {
  await seedMockBackend(MINIMAL_SEED)
  signInAs('admin')
})

async function openAiDraft() {
  const view = renderWithProviders(<KitCreatePage />)
  await view.user.click(await screen.findByRole('radio', { name: /^Yapay zekâyla taslak/ }))
  await view.user.type(screen.getByRole('textbox', { name: 'Konu' }), 'Uzay')
  return view
}

describe('KitCreatePage · AI draft inside the wizard', () => {
  it('drafts the kit without the wizard asking for a draft first', async () => {
    const { user } = await openAiDraft()
    await user.click(screen.getByRole('button', { name: 'Taslak oluştur' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/Taslak hazır: 5 kart/)
    // The wizard's own "Devam" never ran: no "draft first" warning, still on the first step.
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('radio', { name: /^Yapay zekâyla taslak/ })).toBeChecked()
  })

  it('starts the draft with Enter in the topic field', async () => {
    const { user } = await openAiDraft()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('status')).toHaveTextContent(/Taslak hazır: 5 kart/)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
