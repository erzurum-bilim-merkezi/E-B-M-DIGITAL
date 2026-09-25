import { useState } from 'react'

import {
  BLOK_VITRINI,
  SCENE_CATALOG,
  type BlockType,
  type MediaRef,
  type Step,
  type StepOf,
  type Visual,
} from '@/entities/kit'
import { act, renderWithProviders, screen, within } from '@/test/test-utils'

import {
  EditorServicesProvider,
  type AiSceneVisual,
  type EditorServices,
  type ResolvedAsset,
} from '../../index'
import { VisualEditor } from './VisualEditor'

const PICKED: MediaRef = { assetId: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f' }
const FRAME_ID = '11111111-2222-4333-8444-555555555555'
const FRAME_URL = 'https://cdn.example.org/sahne-seed.svg'

const AI_VISUAL: AiSceneVisual = {
  kind: 'ai-scene',
  alt: 'Tohumdan filiz çıkıyor',
  states: [
    { state: 'before', media: { assetId: FRAME_ID } },
    { state: 'after', media: { assetId: '11111111-2222-4333-8444-666666666666' } },
    { state: 'static', media: { assetId: '11111111-2222-4333-8444-777777777777' } },
  ],
}

function sample<T extends BlockType>(type: T): StepOf<T> {
  const step = BLOK_VITRINI.steps.find(
    (candidate): candidate is StepOf<T> => candidate.type === type,
  )
  if (!step) throw new Error(`BLOK_VITRINI has no ${type} card`)
  return step
}

function PickableMedia({
  label,
  value,
  onChange,
}: {
  label: string
  value: MediaRef | undefined
  onChange: (ref: MediaRef | undefined) => void
}) {
  return value ? (
    <button type="button" onClick={() => onChange(undefined)}>{`${label}: kaldır`}</button>
  ) : (
    <button type="button" onClick={() => onChange(PICKED)}>{`${label}: seç`}</button>
  )
}

function FakeAiScenePanel({
  onUse,
  onCancel,
}: {
  step: Step
  onUse: (visual: AiSceneVisual) => void
  onCancel: () => void
}) {
  return (
    <>
      <button type="button" onClick={() => onUse(AI_VISUAL)}>
        Animasyonu kullan
      </button>
      <button type="button" onClick={onCancel}>
        Vazgeç
      </button>
    </>
  )
}

const ASSETS = new Map<string, ResolvedAsset>([
  [FRAME_ID, { url: FRAME_URL, alt: '', kind: 'image', name: 'sahne-seed.svg' }],
])

const SERVICES: EditorServices = {
  IconField: () => null,
  ImageField: PickableMedia,
  AudioField: PickableMedia,
  CaptionsField: PickableMedia,
  AiScenePanel: FakeAiScenePanel,
  assets: ASSETS,
  Preview: () => null,
  SceneThumb: ({ title, state }) => <span>{`${title} (${state})`}</span>,
}

function Harness({
  step,
  error,
  onVisual,
}: {
  step: Step
  error: string | undefined
  onVisual: (visual: Visual | undefined) => void
}) {
  const [visual, setVisual] = useState('visual' in step ? step.visual : undefined)
  return (
    <VisualEditor
      step={step}
      visual={visual}
      error={error}
      onChange={(next) => {
        onVisual(next)
        setVisual(next)
      }}
    />
  )
}

function renderVisualEditor(
  step: Step,
  { services = SERVICES, error }: { services?: EditorServices; error?: string } = {},
) {
  const changes: (Visual | undefined)[] = []
  const view = renderWithProviders(
    <EditorServicesProvider value={services}>
      <Harness step={step} error={error} onVisual={(visual) => changes.push(visual)} />
    </EditorServicesProvider>,
  )
  return { ...view, changes }
}

/** A video card whose link the user replaced with an MP4 file link. */
async function typeMp4Link() {
  const view = renderVisualEditor(sample('video'))
  const input = screen.getByRole('textbox', { name: 'Video bağlantısı' })
  await view.user.clear(input)
  await view.user.paste('https://cdn.example.org/film.mp4')
  return view
}

function kindTabs() {
  return within(screen.getByRole('tablist', { name: 'Görsel türü' }))
    .getAllByRole('tab')
    .map((tab) => tab.textContent?.trim())
}

describe('VisualEditor', () => {
  it('offers only the visual kinds the block supports', () => {
    renderVisualEditor(sample('info'))

    expect(kindTabs()).toEqual([
      'Hazır sahne',
      'Yapay zekâ animasyonu',
      'Görsel',
      'Video bağlantısı',
    ])
    expect(screen.getByRole('tab', { name: 'Hazır sahne' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('hides AI animation when the AI provider is off', () => {
    const { AiScenePanel: _off, ...withoutAi } = SERVICES
    renderVisualEditor(sample('tap-reveal'), { services: withoutAi })

    expect(kindTabs()).toEqual(['Hazır sahne'])
  })

  it('picks a library scene and marks scenes that lack the card states', async () => {
    const { user, changes } = renderVisualEditor(sample('tap-reveal'))
    const scenes = screen.getByRole('radiogroup', { name: 'Hazır sahneler' })
    const seedSprout = within(scenes).getByRole('radio', { name: /^Tohumdan filiz/ })
    const greenhouse = within(scenes).getByRole('radio', { name: /^Sera/ })

    expect(seedSprout).toHaveAttribute('aria-checked', 'true')
    expect(seedSprout).toHaveTextContent('Uyumlu')
    expect(greenhouse).toHaveTextContent('Uyumsuz: before, after')

    await user.click(greenhouse)

    expect(changes).toEqual([{ kind: 'scene', sceneId: 'greenhouse' }])
    expect(greenhouse).toHaveAttribute('aria-checked', 'true')
  })

  it('previews each scene in a state it supports', () => {
    renderVisualEditor(sample('tap-reveal'))

    expect(screen.getByText(`${SCENE_CATALOG['lettuce-growth'].label} (seed)`)).toBeInTheDocument()
  })

  it('removes an optional visual but never a required one', async () => {
    const { user, changes } = renderVisualEditor(sample('info'))

    await user.click(screen.getByRole('button', { name: 'Görseli kaldır' }))

    expect(changes).toEqual([undefined])
    expect(screen.queryByRole('radiogroup', { name: 'Hazır sahneler' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Görseli kaldır' })).not.toBeInTheDocument()
  })

  it('keeps a required visual', () => {
    renderVisualEditor(sample('tap-reveal'))

    expect(screen.queryByRole('button', { name: 'Görseli kaldır' })).not.toBeInTheDocument()
  })

  it('attaches and detaches an image from the media library', async () => {
    const { user, changes } = renderVisualEditor(sample('info'))

    await user.click(screen.getByRole('tab', { name: 'Görsel' }))
    await user.click(screen.getByRole('button', { name: 'Görsel: seç' }))
    await user.click(screen.getByRole('button', { name: 'Görsel: kaldır' }))

    expect(changes).toEqual([{ kind: 'image', media: PICKED }, undefined])
  })

  it('shows the publish problem of the visual', () => {
    renderVisualEditor(sample('tap-reveal'), { error: 'Bu kart türü bir görsel alan ister.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Bu kart türü bir görsel alan ister.')
  })

  describe('AI animation', () => {
    it('generates an animation in a dialog and shows its frames', async () => {
      const { user, changes } = renderVisualEditor(sample('tap-reveal'))

      await user.click(screen.getByRole('tab', { name: 'Yapay zekâ animasyonu' }))
      await user.click(screen.getByRole('button', { name: 'Yapay zekâ ile animasyon üret' }))
      const dialog = await screen.findByRole('dialog', { name: 'Yapay zekâ animasyonu' })
      await user.click(within(dialog).getByRole('button', { name: 'Animasyonu kullan' }))

      expect(changes).toEqual([AI_VISUAL])
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByText('Tohumdan filiz çıkıyor')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'before',
        'after',
        'static',
      ])
      expect(screen.getByRole('presentation')).toHaveAttribute('src', FRAME_URL)
    })

    it('starts over from an existing animation and can cancel', async () => {
      const { user, changes } = renderVisualEditor({ ...sample('tap-reveal'), visual: AI_VISUAL })
      expect(screen.getByRole('tab', { name: 'Yapay zekâ animasyonu' })).toHaveAttribute(
        'aria-selected',
        'true',
      )

      await user.click(screen.getByRole('button', { name: 'Yeni animasyon üret' }))
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Vazgeç' }),
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(changes).toEqual([])
    })
  })

  describe('video link', () => {
    it('shows the YouTube video and asks for Turkish captions when it has speech', async () => {
      const { user, changes } = renderVisualEditor(sample('video'))
      expect(screen.getByRole('textbox', { name: 'Video bağlantısı' })).toHaveValue(
        'https://youtu.be/aqz-KE-bpKQ',
      )
      expect(screen.getByText('aqz-KE-bpKQ')).toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

      await user.click(screen.getByRole('switch', { name: 'Videoda konuşma var' }))
      await user.click(screen.getByRole('checkbox', { name: /YouTube’da Türkçe altyazı var/ }))

      expect(changes.at(-1)).toEqual({
        kind: 'video',
        source: {
          provider: 'youtube',
          videoId: 'aqz-KE-bpKQ',
          hasSpeech: true,
          captionsConfirmed: true,
        },
      })
    })

    it.each([
      ['http://example.org/film.mp4', /yalnızca https:\/\//],
      ['https://example.org/sayfa', /Bağlantı tanınmadı/],
    ])('explains why %s cannot be used', async (link, message) => {
      const { user, changes } = renderVisualEditor(sample('video'))
      const input = screen.getByRole('textbox', { name: 'Video bağlantısı' })

      await user.clear(input)
      await user.click(input)
      await user.paste(link)

      expect(input).toBeInvalid()
      expect(input).toHaveAccessibleDescription(message)
      expect(changes).toEqual([])
    })

    describe('MP4 files', () => {
      let videos: HTMLVideoElement[] = []

      beforeEach(() => {
        videos = []
        const create = document.createElement.bind(document)
        vi.spyOn(document, 'createElement').mockImplementation(
          (tagName: string, options?: ElementCreationOptions) => {
            const element = create(tagName, options)
            if (element instanceof HTMLVideoElement) videos.push(element)
            return element
          },
        )
        // jsdom cannot load media; the probe's clean-up calls load().
        vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
      })

      it('checks that the file can be played', async () => {
        const { changes } = await typeMp4Link()

        expect(changes.at(-1)).toEqual({
          kind: 'video',
          source: { provider: 'mp4', url: 'https://cdn.example.org/film.mp4', hasSpeech: false },
        })
        expect(screen.getByText('Bağlantı kontrol ediliyor…')).toBeInTheDocument()
        expect(videos.at(-1)?.getAttribute('src')).toBe('https://cdn.example.org/film.mp4')

        act(() => {
          videos.at(-1)?.dispatchEvent(new Event('loadedmetadata'))
        })

        expect(screen.getByText('Bağlantı oynatılabiliyor.')).toBeInTheDocument()
      })

      it('warns when the file cannot be played', async () => {
        await typeMp4Link()

        act(() => {
          videos.at(-1)?.dispatchEvent(new Event('error'))
        })

        expect(screen.getByText('Bu bağlantı oynatılamadı.')).toBeInTheDocument()
        expect(screen.getByText(/Video kullanılamıyor olabilir/)).toBeInTheDocument()
      })

      it('takes a WebVTT captions file for speech and keeps it when the link changes', async () => {
        const { user, changes } = await typeMp4Link()

        await user.click(screen.getByRole('switch', { name: 'Videoda konuşma var' }))
        await user.click(screen.getByRole('button', { name: 'Altyazı dosyası (WebVTT): seç' }))
        const input = screen.getByRole('textbox', { name: 'Video bağlantısı' })
        await user.clear(input)
        await user.click(input)
        await user.paste('https://cdn.example.org/yeni.webm')

        expect(changes.at(-1)).toEqual({
          kind: 'video',
          source: {
            provider: 'mp4',
            url: 'https://cdn.example.org/yeni.webm',
            hasSpeech: true,
            captions: PICKED,
          },
        })

        await user.click(screen.getByRole('button', { name: 'Altyazı dosyası (WebVTT): kaldır' }))
        expect(changes.at(-1)).toEqual({
          kind: 'video',
          source: { provider: 'mp4', url: 'https://cdn.example.org/yeni.webm', hasSpeech: true },
        })
      })
    })
  })
})
