import { useQuery } from '@tanstack/react-query'

import {
  KUCUK_CIFTCILER,
  validateKitForPublish,
  type KitDocument,
  type KitIssue,
  type StudioKit,
} from '@/entities/kit'
import { mockControl } from '@/shared/api/mock-db'
import { toast, Toaster } from '@/shared/ui'
import { seedMockBackend, signInAs } from '@/test/mock-backend'
import { AppError } from '@/shared/api/errors'
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils'

import { kitQueryOptions, kitRepository, publishingService } from '../../index'
import { PublishTab } from './PublishTab'

type Role = 'admin' | 'editor'

function PublishPage({
  kitId,
  role,
  onGo,
  flush,
}: {
  kitId: string
  role: Role
  onGo: (issue: KitIssue) => void
  flush?: () => Promise<number>
}) {
  const { data: kit } = useQuery(kitQueryOptions(kitId))
  if (!kit) return <p>Yükleniyor…</p>
  return (
    <PublishTab
      kit={kit}
      draft={kit.draft}
      issues={validateKitForPublish(kit.draft)}
      role={role}
      flush={flush ?? (async () => kit.lockVersion)}
      onGo={onGo}
    />
  )
}

async function renderPublishTab(
  kit: StudioKit,
  role: Role = 'admin',
  flush?: () => Promise<number>,
) {
  const onGo = vi.fn<(issue: KitIssue) => void>()
  const view = renderWithProviders(
    <>
      <PublishPage kitId={kit.id} role={role} onGo={onGo} flush={flush} />
      <Toaster />
    </>,
  )
  await screen.findByRole('heading', { name: 'Yayına hazırlık' })
  return { ...view, onGo }
}

function createKit(document: KitDocument = KUCUK_CIFTCILER) {
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

async function publishedKit() {
  const kit = await createKit()
  const { kit: live } = await publishingService.publish(kit.id, {
    notes: '',
    visibility: 'public',
    lockVersion: kit.lockVersion,
    aiReviewConfirmed: false,
  })
  return live
}

/** The value shown next to a term in the "Durum" card. */
function statusValue(term: string) {
  const dt = screen.getAllByRole('term').find((element) => element.textContent === term)
  return dt?.nextElementSibling?.textContent
}

beforeEach(async () => {
  await seedMockBackend({ staff: true, kits: [], activity: 'none' })
  signInAs('admin')
})

// Sonner replays still-active toasts to every new <Toaster>; start each test without them.
afterEach(() => {
  toast.dismiss()
})

async function failedSave(): Promise<number> {
  throw new AppError('network', 'İnternet bağlantısı yok gibi görünüyor.')
}

describe('PublishTab for admins', () => {
  it('does not publish when the pending edits could not be saved', async () => {
    const kit = await createKit()
    const { user } = await renderPublishTab(kit, 'admin', failedSave)

    await user.click(screen.getByRole('button', { name: 'Yayınla' }))

    expect(
      await screen.findByText('Değişiklikler kaydedilemedi, işlem yapılmadı.'),
    ).toBeInTheDocument()
    expect((await kitRepository.get(kit.id)).publishedVersion).toBeNull()
  })

  it('publishes a ready kit with a note and links to the QR page', async () => {
    const kit = await createKit()
    const { user } = await renderPublishTab(kit)
    expect(screen.getByRole('status')).toHaveTextContent('Yayına hazır: sorun bulunmadı.')
    expect(statusValue('Durum')).toBe('Taslak')
    expect(statusValue('Canlı sürüm')).toBe('—')
    expect(statusValue('Son yayın')).toBe('—')

    await user.click(screen.getByRole('textbox', { name: /^Yayın notu/ }))

    await user.paste('İlk sürüm')
    await user.click(screen.getByRole('button', { name: 'Yayınla' }))

    expect(await screen.findByText('v1 yayında')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'QR oluştur' })).toHaveAttribute(
      'href',
      `/studio/kitler/${kit.id}/qr`,
    )
    expect(await screen.findByText('v1 yayınlandı')).toBeInTheDocument()
    await waitFor(() => expect(statusValue('Canlı sürüm')).toBe('v1'))
    expect(statusValue('Durum')).toBe('Yayında')
    expect(statusValue('Son yayın')).not.toBe('—')
    expect(screen.getByRole('textbox', { name: /^Yayın notu/ })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Yeni sürümü yayınla' })).toBeInTheDocument()
    const [version] = await publishingService.listVersions(kit.id)
    expect(version).toMatchObject({ version: 1, notes: 'İlk sürüm' })
  })

  it('publishes an unlisted kit', async () => {
    const kit = await createKit()
    const { user } = await renderPublishTab(kit)

    await user.click(screen.getByRole('radio', { name: /^Liste dışı/ }))
    await user.click(screen.getByRole('button', { name: 'Yayınla' }))

    await waitFor(() => expect(statusValue('Görünürlük')).toBe('Liste dışı'))
    expect((await kitRepository.get(kit.id)).visibility).toBe('unlisted')
  })

  it('blocks publishing until the checklist has no errors', async () => {
    const kit = await kitRepository.create({
      templateId: 'quiz',
      title: 'Mıknatıs Bilmecesi',
      slug: 'miknatis-bilmecesi',
      qrPrefix: 'MB',
      tagline: '',
      description: '',
      category: 'electricity',
      ageRange: { min: 6, max: 10 },
      durationMinutes: 15,
      icon: { kind: 'emoji', value: '🧲' },
    })
    const { user, onGo } = await renderPublishTab(kit)

    expect(screen.getByRole('button', { name: 'Yayınla' })).toBeDisabled()
    expect(screen.getByText('Önce sorunları düzeltin.')).toBeInTheDocument()
    expect(screen.getByText(/sorun yayını engelliyor/)).toBeInTheDocument()

    const [goToAnswer] = screen.getAllByRole('button', { name: 'Git: Cevap metni boş.' })
    await user.click(goToAnswer!)

    expect(onGo).toHaveBeenCalledWith(expect.objectContaining({ field: 'answer' }))
  })

  it('requires the AI content check before publishing AI content', async () => {
    const [first, ...rest] = KUCUK_CIFTCILER.steps
    const kit = await createKit({
      ...KUCUK_CIFTCILER,
      steps: [{ ...first!, aiGenerated: { fields: ['answer'] } }, ...rest],
    })
    const { user } = await renderPublishTab(kit)
    const publish = screen.getByRole('button', { name: 'Yayınla' })
    expect(publish).toBeDisabled()
    expect(screen.getByText('Yapay zekâ onayını işaretleyin.')).toBeInTheDocument()

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Yapay zekâ içeriğini bilimsel doğruluk açısından kontrol ettim',
      }),
    )
    await user.click(publish)

    expect(await screen.findByText('v1 yayında')).toBeInTheDocument()
    const [version] = await publishingService.listVersions(kit.id)
    expect(version?.aiReviewConfirmed).toBe(true)
  })

  it('offers a retry when publishing fails', async () => {
    const kit = await createKit()
    const { user } = await renderPublishTab(kit)
    mockControl.failNext('publishing.publish', 'unavailable')

    await user.click(screen.getByRole('button', { name: 'Yayınla' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Yayınlanamadı')
    expect(alert).toHaveTextContent('Hizmet şu anda yanıt vermiyor.')
    await user.click(within(alert).getByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByText('v1 yayında')).toBeInTheDocument()
  })

  it('shows validation failures from the server without a retry button', async () => {
    const kit = await createKit({
      ...KUCUK_CIFTCILER,
      cover: { assetId: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f' },
    })
    const { user } = await renderPublishTab(kit)

    await user.click(screen.getByRole('button', { name: 'Yayınla' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Yayından önce düzeltilmesi gereken sorunlar var.')
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })

  it('changes only the visibility of a live kit', async () => {
    const kit = await publishedKit()
    const { user } = await renderPublishTab(kit)
    expect(screen.getByRole('heading', { name: 'Yeni sürüm yayınla' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Yalnızca görünürlüğü güncelle' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^Liste dışı/ }))
    await user.click(screen.getByRole('button', { name: 'Yalnızca görünürlüğü güncelle' }))

    expect(await screen.findByText('Görünürlük güncellendi')).toBeInTheDocument()
    await waitFor(() => expect(statusValue('Görünürlük')).toBe('Liste dışı'))
    expect(
      screen.queryByRole('button', { name: 'Yalnızca görünürlüğü güncelle' }),
    ).not.toBeInTheDocument()
  })

  it('archives a live kit and brings it back', async () => {
    const kit = await publishedKit()
    const { user } = await renderPublishTab(kit)

    await user.click(screen.getByRole('button', { name: 'Arşivle' }))

    expect(await screen.findByText('Kit arşivlendi')).toBeInTheDocument()
    await waitFor(() => expect(statusValue('Durum')).toBe('Arşivde'))
    expect(screen.getByRole('button', { name: 'Yayınla' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Arşivden çıkar' }))

    expect(await screen.findByText('Kit arşivden çıkarıldı')).toBeInTheDocument()
    await waitFor(() => expect(statusValue('Durum')).toBe('Yayında'))
  })

  it('points out changes that are not published yet', async () => {
    const live = await publishedKit()
    const edited = await kitRepository.update(live.id, live.draft, live.lockVersion)

    await renderPublishTab(edited)

    expect(statusValue('Durum')).toBe('Yayında · değişiklik var')
    expect(screen.getByText('Yayında olmayan değişiklikler var.')).toBeInTheDocument()
  })

  it('sends a kit in review back to the editor with a note', async () => {
    const kit = await createKit()
    const review = await publishingService.submitForReview(kit.id, kit.lockVersion)
    const { user } = await renderPublishTab(review)
    const request = screen.getByRole('button', { name: 'Değişiklik iste' })
    expect(request).toBeDisabled()

    await user.click(screen.getByRole('textbox', { name: 'Editöre not' }))

    await user.paste('4. kartı kısaltın.')
    await user.click(request)

    expect(await screen.findByText('Değişiklik istendi')).toBeInTheDocument()
    expect(await screen.findByText('Yöneticiden değişiklik isteği')).toBeInTheDocument()
    expect(screen.getByText('4. kartı kısaltın.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Değişiklik iste' })).not.toBeInTheDocument()
    expect((await kitRepository.get(kit.id)).status).toBe('draft')
  })
})

describe('PublishTab for editors', () => {
  beforeEach(() => {
    signInAs('editor')
  })

  it('submits for review and withdraws again', async () => {
    const kit = await createKit()
    const { user } = await renderPublishTab(kit, 'editor')
    expect(screen.queryByRole('button', { name: 'Yayınla' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'İncelemeye gönder' }))

    expect(await screen.findByText('İncelemeye gönderildi')).toBeInTheDocument()
    expect(
      await screen.findByText('Kit incelemede. Değişiklik yapmak için incelemeden geri çekin.'),
    ).toBeInTheDocument()
    expect(screen.getByText('İncelemedeki kit editörlere kilitlidir.')).toBeInTheDocument()
    expect(statusValue('Durum')).toBe('İncelemede')

    await user.click(screen.getByRole('button', { name: 'İncelemeden geri çek' }))

    expect(await screen.findByText('İncelemeden geri çekildi')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'İncelemeye gönder' })).toBeEnabled()
    expect((await kitRepository.get(kit.id)).status).toBe('draft')
  })

  it('explains why a submission failed', async () => {
    const kit = await createKit()
    const { user } = await renderPublishTab(kit, 'editor')
    mockControl.failNext(
      'publishing.submitForReview',
      'conflict',
      'Kaydedilmemiş değişiklikler var. Önce kaydedin.',
    )

    await user.click(screen.getByRole('button', { name: 'İncelemeye gönder' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kaydedilmemiş değişiklikler var. Önce kaydedin.',
    )
  })

  it('cannot submit a kit with blocking issues nor archive kits', async () => {
    signInAs('admin')
    const kit = await publishedKit()
    signInAs('editor')
    const broken = await kitRepository.update(kit.id, { ...kit.draft, title: 'K' }, kit.lockVersion)

    await renderPublishTab(broken, 'editor')

    expect(screen.getByRole('button', { name: 'İncelemeye gönder' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Arşivle' })).not.toBeInTheDocument()
  })
})
