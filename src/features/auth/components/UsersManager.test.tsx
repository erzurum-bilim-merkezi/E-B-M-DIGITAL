import { MINIMAL_SEED, seedMockBackend, signInAs } from '@/test/mock-backend'
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils'

import { DEMO_ACCOUNTS } from '../api/demo-accounts'
import { UsersManager } from './UsersManager'

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(async () => {
  await seedMockBackend(MINIMAL_SEED)
  signInAs('admin')
  // Radix menus measure their trigger; jsdom has no ResizeObserver.
  vi.stubGlobal('ResizeObserver', NoopResizeObserver)
})

async function openCreateDialog() {
  const view = renderWithProviders(<UsersManager />)
  await screen.findByRole('table', { name: 'Studio kullanıcıları' })
  const addButton = screen.getByRole('button', { name: 'Kullanıcı ekle' })
  await view.user.click(addButton)
  const dialog = await screen.findByRole('dialog', { name: 'Kullanıcı ekle' })
  return { ...view, dialog, addButton }
}

describe('UsersManager · new user form (WCAG 3.3.1, 1.3.1)', () => {
  it('puts each error on its field and focuses the first invalid one', async () => {
    const { user, dialog } = await openCreateDialog()
    const name = within(dialog).getByRole('textbox', { name: 'Ad soyad' })
    const email = within(dialog).getByRole('textbox', { name: 'E-posta' })

    await user.click(within(dialog).getByRole('button', { name: 'Kullanıcıyı oluştur' }))

    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('Ad soyad en az 2 karakter olmalı.')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('E-posta adresini girin.')
    expect(name).toHaveFocus()
    // Only the field messages; no separate form-level alert.
    expect(
      within(dialog)
        .getAllByRole('alert')
        .map((alert) => alert.textContent),
    ).toEqual(['Ad soyad en az 2 karakter olmalı.', 'E-posta adresini girin.'])
  })

  it('flags a malformed e-mail and keeps what was typed', async () => {
    const { user, dialog } = await openCreateDialog()
    const name = within(dialog).getByRole('textbox', { name: 'Ad soyad' })
    const email = within(dialog).getByRole('textbox', { name: 'E-posta' })

    await user.type(name, 'Ayşe Yılmaz')
    await user.type(email, 'ayse.yilmaz')
    await user.click(within(dialog).getByRole('button', { name: 'Kullanıcıyı oluştur' }))

    expect(name).not.toHaveAttribute('aria-invalid')
    expect(email).toHaveAccessibleDescription(/Geçerli bir e-posta adresi girin/)
    expect(email).toHaveFocus()
    expect(email).toHaveValue('ayse.yilmaz')
  })

  it('shows a taken e-mail on the e-mail field', async () => {
    const { user, dialog } = await openCreateDialog()
    const email = within(dialog).getByRole('textbox', { name: 'E-posta' })

    await user.type(within(dialog).getByRole('textbox', { name: 'Ad soyad' }), 'Kopya Editör')
    await user.type(email, DEMO_ACCOUNTS.editor.email)
    await user.click(within(dialog).getByRole('button', { name: 'Kullanıcıyı oluştur' }))

    await waitFor(() =>
      expect(email).toHaveAccessibleDescription('Bu e-posta ile bir kullanıcı zaten var.'),
    )
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveFocus()
  })

  it('creates the user and returns focus to "Kullanıcı ekle" after the password dialog', async () => {
    const { user, dialog, addButton } = await openCreateDialog()

    await user.type(within(dialog).getByRole('textbox', { name: 'Ad soyad' }), 'Ayşe Yılmaz')
    await user.type(within(dialog).getByRole('textbox', { name: 'E-posta' }), 'ayse@kasif.dev')
    await user.click(within(dialog).getByRole('button', { name: 'Kullanıcıyı oluştur' }))

    const password = await screen.findByRole('dialog', { name: 'Geçici parola' })
    await user.click(within(password).getByRole('button', { name: 'Kaydettim, kapat' }))

    await waitFor(() => expect(addButton).toHaveFocus())
  })
})

describe('UsersManager · row actions', () => {
  it('returns focus to the row menu after a password reset', async () => {
    const { user } = renderWithProviders(<UsersManager />)
    const actions = await screen.findByRole('button', {
      name: `${DEMO_ACCOUNTS.editor.displayName} için işlemler`,
    })

    await user.click(actions)
    await user.click(await screen.findByRole('menuitem', { name: 'Parolayı sıfırla' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Parolayı sıfırla' })
    await user.click(within(confirm).getByRole('button', { name: 'Parolayı sıfırla' }))
    const password = await screen.findByRole('dialog', { name: 'Geçici parola' })
    await user.click(within(password).getByRole('button', { name: 'Kaydettim, kapat' }))

    await waitFor(() => expect(actions).toHaveFocus())
  })
})
