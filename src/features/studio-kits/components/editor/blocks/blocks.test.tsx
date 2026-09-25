import type { UserEvent } from '@testing-library/user-event'
import { useState, type ReactElement, type ReactNode } from 'react'

import {
  BLOCK_CATALOG,
  BLOCK_TYPES,
  BLOK_VITRINI,
  stepSchema,
  type BlockType,
  type MediaRef,
  type Step,
  type StepOf,
  type Visual,
} from '@/entities/kit'
import { renderWithProviders, screen, within } from '@/test/test-utils'

import { useEditorServices } from '../editor-services'
import { EditorServicesProvider } from '../services'
import { BLOCK_EDITORS, BlockFieldsEditor, BlockHelp } from './registry'
import { nextSceneState, toSceneStateName } from './scene-states'

type Issues = Partial<Record<string, string>>

function isStepOf<T extends BlockType>(step: Step, type: T): step is StepOf<T> {
  return step.type === type
}

function sample<T extends BlockType>(type: T): StepOf<T> {
  const step = BLOK_VITRINI.steps.find((candidate): candidate is StepOf<T> =>
    isStepOf(candidate, type),
  )
  if (!step) throw new Error(`BLOK_VITRINI has no ${type} card`)
  return step
}

/** Holds the step like StepEditor does, so every edit re-renders with the new value. */
function Harness({
  initial,
  issues,
  onStep,
}: {
  initial: Step
  issues: Issues
  onStep: (step: Step) => void
}) {
  const [step, setStep] = useState(initial)
  return (
    <BlockFieldsEditor
      step={step}
      onChange={(next) => {
        onStep(next)
        setStep(next)
      }}
      issueFor={(field) => issues[field]}
    />
  )
}

function renderEditor<T extends BlockType>(
  type: T,
  {
    step = sample(type),
    issues = {},
    wrap = (ui) => ui,
  }: { step?: StepOf<T>; issues?: Issues; wrap?: (ui: ReactElement) => ReactElement } = {},
) {
  const changes: Step[] = []
  const view = renderWithProviders(
    wrap(<Harness initial={step} issues={issues} onStep={(next) => changes.push(next)} />),
  )
  /** The step as the editor last reported it (the initial one before any edit). */
  const current = (): StepOf<T> => {
    const latest = changes.at(-1) ?? step
    if (!isStepOf(latest, type)) throw new Error(`The editor turned the card into ${latest.type}`)
    return latest
  }
  return { ...view, current }
}

async function clickTimes(user: UserEvent, element: HTMLElement, times: number) {
  for (let click = 0; click < times; click++) {
    // oxlint-disable-next-line no-await-in-loop -- each click re-renders before the next one
    await user.click(element)
  }
}

/** One text field per block: its accessible name and the step value it edits. */
function probe(step: Step): { name: RegExp; value: string } {
  switch (step.type) {
    case 'info':
      return { name: /^Bilgi metni/, value: step.body }
    case 'tap-reveal':
      return { name: /^Dokunma yönergesi/, value: step.tapLabel }
    case 'stage-slider':
      return { name: /^Evre adı/, value: step.stages[0]?.label ?? '' }
    case 'explore-hotspots':
      return { name: /^Mesaj/, value: step.hotspots[0]?.message ?? '' }
    case 'toggle-scene':
      return { name: /^Açıkken gösterilen mesaj/, value: step.onMessage }
    case 'animated-scene':
      return { name: /^Durdurulunca gösterilen açıklama/, value: step.staticCaption }
    case 'choose-correct':
      return { name: /^Geri bildirim/, value: step.options[0]?.feedback ?? '' }
    case 'compare-cards':
      return { name: /^Kart metni/, value: step.cards[0]?.text ?? '' }
    case 'quiz':
      return { name: /^Açıklama/, value: step.explanation }
    case 'sequence':
      return { name: /^Adım/, value: step.items[0]?.label ?? '' }
    case 'matching':
      return { name: /^Sağ kart/, value: step.pairs[0]?.right ?? '' }
    case 'experiment':
      return { name: /^Gözlem sorusu/, value: step.observationPrompt }
    case 'video':
      return { name: /^İzledikten sonra/, value: step.questionAfter }
  }
}

function itemsOf(step: Step): readonly { id: string }[] {
  switch (step.type) {
    case 'stage-slider':
      return step.stages
    case 'explore-hotspots':
      return step.hotspots
    case 'choose-correct':
    case 'quiz':
      return step.options
    case 'compare-cards':
      return step.cards
    case 'sequence':
      return step.items
    case 'matching':
      return step.pairs
    case 'experiment':
      return step.steps
    default:
      return []
  }
}

const LISTS = [
  { type: 'stage-slider', legend: 'Evreler', add: 'Evre ekle', prefix: 'st', min: 2, max: 6 },
  {
    type: 'explore-hotspots',
    legend: 'Keşif butonları',
    add: 'Buton ekle',
    prefix: 'h',
    min: 2,
    max: 6,
  },
  {
    type: 'choose-correct',
    legend: 'Seçenekler',
    add: 'Seçenek ekle',
    prefix: 'o',
    min: 2,
    max: 6,
  },
  {
    type: 'compare-cards',
    legend: 'Karşılaştırma kartları',
    add: 'Kart ekle',
    prefix: 'c',
    min: 2,
    max: 3,
  },
  { type: 'quiz', legend: 'Cevap seçenekleri', add: 'Seçenek ekle', prefix: 'q', min: 2, max: 4 },
  { type: 'sequence', legend: 'Sıralama adımları', add: 'Adım ekle', prefix: 's', min: 3, max: 6 },
  { type: 'matching', legend: 'Eşler', add: 'Eş ekle', prefix: 'p', min: 2, max: 5 },
  { type: 'experiment', legend: 'Deney adımları', add: 'Adım ekle', prefix: 'e', min: 1, max: 10 },
] as const

const AI_SCENE: Visual = {
  kind: 'ai-scene',
  alt: 'Marulun büyüme evreleri',
  states: ['seed', 'sprout', 'seedling', 'grown', 'static'].map((state, index) => ({
    state,
    media: { assetId: `00000000-0000-4000-8000-00000000000${index}` },
  })),
}

const PICKED_IMAGE: MediaRef = { assetId: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f' }

function StubImageField({
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: MediaRef | undefined
  onChange: (ref: MediaRef | undefined) => void
}) {
  return value ? (
    <button type="button" onClick={() => onChange(undefined)}>{`${label}: kaldır`}</button>
  ) : (
    <button type="button" onClick={() => onChange(PICKED_IMAGE)}>{`${label}: seç`}</button>
  )
}

/** The emoji input of the list item at `index`. */
function emojiAt(index: number) {
  return within(screen.getAllByRole('listitem')[index]!).getByRole('textbox', { name: 'Emoji' })
}

function WithStubImageField({ children }: { children: ReactNode }) {
  const services = useEditorServices()
  return (
    <EditorServicesProvider value={{ ...services, ImageField: StubImageField }}>
      {children}
    </EditorServicesProvider>
  )
}

describe('BlockFieldsEditor', () => {
  it('has an editor for every block type', () => {
    expect(Object.keys(BLOCK_EDITORS).toSorted()).toEqual(BLOCK_TYPES.toSorted())
  })

  it.each(BLOCK_TYPES)('renders the %s sample and reports typed text', async (type) => {
    const { user, current } = renderEditor(type)
    const before = probe(current())
    const [field] = screen.getAllByRole('textbox', { name: before.name })

    expect(field).toHaveValue(before.value)
    await user.type(field!, '!')

    expect(probe(current()).value).toBe(`${before.value}!`)
  })

  it.each(LISTS)(
    '$type: adds items with fresh ids up to the schema maximum ($max)',
    async ({ type, add, prefix, max }) => {
      const { user, current } = renderEditor(type)
      const before = itemsOf(current()).map((item) => item.id)
      const addButton = screen.getByRole('button', { name: add })

      await clickTimes(user, addButton, max - before.length)

      const items = itemsOf(current())
      expect(items).toHaveLength(max)
      expect(new Set(items.map((item) => item.id)).size).toBe(max)
      const added = items.filter((item) => !before.includes(item.id))
      expect(added.map((item) => item.id)).toEqual(
        added.map(() => expect.stringMatching(new RegExp(`^${prefix}-[a-z0-9]{6}$`))),
      )
      expect(addButton).toBeDisabled()
      // New items keep the draft saveable: the schema rejects e.g. an empty emoji or state.
      expect(stepSchema.safeParse(current()).success).toBe(true)
    },
  )

  it.each(LISTS)(
    '$type: removing stops at the publish minimum ($min)',
    async ({ type, legend, min }) => {
      const { user, current } = renderEditor(type)
      const list = screen.getByRole('group', { name: new RegExp(`^${legend}`) })
      const removeButtons = () => within(list).getAllByRole('button', { name: / sil$/ })

      for (let count = itemsOf(current()).length; count > min; count--) {
        // oxlint-disable-next-line no-await-in-loop -- each removal re-renders the list
        await user.click(removeButtons().at(-1)!)
      }

      expect(itemsOf(current())).toHaveLength(min)
      for (const button of removeButtons()) expect(button).toBeDisabled()
    },
  )

  it('shows publish issues as alerts tied to their fields', () => {
    renderEditor('quiz', {
      issues: { question: 'Soru metni boş.', options: 'Doğru cevabı işaretleyin.' },
    })

    const alerts = screen.getAllByRole('alert').map((alert) => alert.textContent)
    expect(alerts).toEqual(['Soru metni boş.', 'Doğru cevabı işaretleyin.'])
    const question = screen.getByRole('textbox', { name: /^Soru/ })
    expect(question).toBeInvalid()
    expect(question).toHaveAccessibleDescription('Soru metni boş.')
    expect(screen.getByRole('group', { name: /^Cevap seçenekleri/ })).toHaveAccessibleDescription(
      'Doğru cevabı işaretleyin.',
    )
  })

  describe('quiz', () => {
    it('sets the correct option with the radio group', async () => {
      const { user, current } = renderEditor('quiz')
      const answers = screen.getByRole('radiogroup', { name: 'Doğru cevap' })
      expect(within(answers).getByRole('radio', { name: 'Yapraklarında' })).toBeChecked()

      await user.click(within(answers).getByRole('radio', { name: 'Çiçeklerinde' }))

      expect(current().correctOptionId).toBe('q-3')
      expect(within(answers).getByRole('radio', { name: 'Çiçeklerinde' })).toBeChecked()
    })

    it('marks the first option when the correct one is removed', async () => {
      const { user, current } = renderEditor('quiz')

      await user.click(screen.getByRole('button', { name: 'Yapraklarında sil' }))

      expect(current().options.map((option) => option.id)).toEqual(['q-1', 'q-3'])
      expect(current().correctOptionId).toBe('q-1')
      expect(screen.getByRole('radio', { name: 'Köklerinde' })).toBeChecked()
    })

    it('keeps the answer when another option is removed', async () => {
      const { user, current } = renderEditor('quiz')

      await user.click(screen.getByRole('button', { name: 'Çiçeklerinde sil' }))

      expect(current().correctOptionId).toBe('q-2')
    })
  })

  describe('scene states', () => {
    it('picks a library scene state by its Turkish name', async () => {
      const { user, current } = renderEditor('stage-slider')
      const [first] = screen.getAllByRole('combobox', { name: /^Sahne durumu/ })

      expect(first).toHaveValue('seed')
      expect(
        within(first!)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Tohum', 'Çimlenme', 'Fide', 'Büyümüş'])
      await user.selectOptions(first!, 'Büyümüş')

      expect(current().stages[0]?.state).toBe('grown')
    })

    it('keeps a state the chosen scene lacks visible', () => {
      const step = sample('stage-slider')
      renderEditor('stage-slider', {
        step: { ...step, visual: { kind: 'scene', sceneId: 'seed-sprout' } },
      })
      const [first] = screen.getAllByRole('combobox', { name: /^Sahne durumu/ })

      expect(first).toHaveValue('seed')
      expect(within(first!).getByRole('option', { selected: true })).toHaveTextContent(
        'Tohum (bu sahnede yok)',
      )
    })

    it('takes a typed state name for an AI scene and never stores an invalid one', async () => {
      const { user, current } = renderEditor('stage-slider', {
        step: { ...sample('stage-slider'), visual: AI_SCENE },
      })
      expect(screen.queryByRole('combobox', { name: /^Sahne durumu/ })).not.toBeInTheDocument()
      const [first] = screen.getAllByRole('textbox', { name: /^Sahne durumu/ })
      expect(first).toHaveValue('seed')
      expect(first).toHaveAccessibleDescription(/AI sahnesindeki durum adı/)

      await user.clear(first!)
      expect(screen.getByRole('alert')).toHaveTextContent('Harfle başlayan bir durum adı yazın.')
      expect(current().stages[0]?.state).toBe('seed')

      await user.type(first!, 'Filiz Çıktı')
      expect(first).toHaveValue('filiz-cikti')
      expect(current().stages[0]?.state).toBe('filiz-cikti')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('gives a new hotspot an unused color and scene state', async () => {
      const { user, current } = renderEditor('explore-hotspots')

      await user.click(screen.getByRole('button', { name: 'Buton ekle' }))

      expect(current().hotspots.at(-1)).toMatchObject({ color: 'green', state: 'air', label: '' })
    })

    it('suggests unused states, then reuses library ones or invents names', () => {
      const greenhouse: Visual = { kind: 'scene', sceneId: 'greenhouse' }
      expect(nextSceneState(greenhouse, ['sun', 'water'], ['idle'])).toBe('temp')
      expect(nextSceneState(greenhouse, ['sun', 'water', 'temp', 'air'], ['idle'])).toBe('sun')
      expect(nextSceneState(AI_SCENE, ['seed', 'sprout', 'seedling', 'grown'])).toBe('durum-5')
      expect(nextSceneState(undefined, ['durum-2'])).toBe('durum-3')
    })

    it('normalizes typed state names', () => {
      expect(toSceneStateName('Güneş Işığı')).toBe('gunes-isigi')
      expect(toSceneStateName('SU_2')).toBe('su-2')
      expect(toSceneStateName('açık!')).toBe('acik')
    })
  })

  it('never stores an empty emoji', async () => {
    const { user, current } = renderEditor('sequence')
    const [first] = screen.getAllByRole('listitem')
    const emoji = within(first!).getByRole('textbox', { name: 'Emoji' })

    await user.clear(emoji)
    expect(within(first!).getByRole('alert')).toHaveTextContent('Bir emoji yazın ya da seçin.')
    expect(current().items[0]?.icon).toBe('🌰')

    await user.type(emoji, '🌱')
    expect(current().items[0]?.icon).toBe('🌱')
    expect(within(first!).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps an unfinished emoji with its own item when the list is reordered', async () => {
    const { user, current } = renderEditor('sequence')

    await user.clear(emojiAt(0))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Çimlenme yukarı taşı' }))

    expect(current().items.map((item) => item.icon)).toEqual(['🌱', '🌰', '🌿', '🥬'])
    expect(emojiAt(0)).toHaveValue('🌱')
    // Items are keyed by id, so the cleared field moved with its item instead of being reused.
    expect(emojiAt(1)).toHaveValue('')
    const [, moved] = screen.getAllByRole('listitem')
    expect(within(moved!).getByRole('alert')).toHaveTextContent('Bir emoji yazın ya da seçin.')
  })

  it('choose-correct: marks options correct and keeps the hint counts current', async () => {
    const { user, current } = renderEditor('choose-correct')
    expect(screen.getByText(/Şu an 2 doğru, 1 yanlış\./)).toBeInTheDocument()
    const music = screen.getAllByRole('listitem')[2]!

    await user.click(within(music).getByRole('switch', { name: 'Doğru seçenek' }))

    expect(current().options[2]?.correct).toBe(true)
    expect(screen.getByText(/Şu an 3 doğru, 0 yanlış\./)).toBeInTheDocument()
  })

  it('explore-hotspots: sets a button color', async () => {
    const { user, current } = renderEditor('explore-hotspots')
    const [light] = screen.getAllByRole('listitem')

    await user.click(within(light!).getByRole('radio', { name: 'Mor' }))

    expect(current().hotspots[0]?.color).toBe('purple')
  })

  it('compare-cards: sets a card tone', async () => {
    const { user, current } = renderEditor('compare-cards')
    const [tone] = screen.getAllByRole('combobox', { name: 'Renk tonu' })

    expect(
      within(tone!)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Sıcak (kum/tohum)', 'Taze (yeşil)', 'Serin (mavi)'])
    await user.selectOptions(tone!, 'Serin (mavi)')

    expect(current().cards[0]?.tone).toBe('cool')
  })

  it('toggle-scene: shows the button-text issue under the blank button', () => {
    renderEditor('toggle-scene', {
      step: { ...sample('toggle-scene'), offLabel: '' },
      issues: { onLabel: 'Düğme metinleri boş.' },
    })

    expect(screen.getByRole('textbox', { name: /^Kapatma düğmesi/ })).toBeInvalid()
    expect(screen.getByRole('textbox', { name: /^Açma düğmesi/ })).toBeValid()
    expect(screen.getByRole('alert')).toHaveTextContent('Düğme metinleri boş.')
  })

  describe('experiment', () => {
    it('sets a step timer in seconds', async () => {
      const { user, current } = renderEditor('experiment')
      // NumberField's label is not tied to its input yet (see fields.tsx), so query by role only.
      const [timer] = screen.getAllByRole('spinbutton')

      await user.clear(timer!)
      await user.type(timer!, '90')

      expect(current().steps[0]?.timerSec).toBe(90)
    })

    it('attaches and removes a step image', async () => {
      const { user, current } = renderEditor('experiment', {
        wrap: (ui) => <WithStubImageField>{ui}</WithStubImageField>,
      })
      const [pick] = screen.getAllByRole('button', { name: 'Adım görseli (isteğe bağlı): seç' })

      await user.click(pick!)
      expect(current().steps[0]?.image).toEqual(PICKED_IMAGE)

      await user.click(screen.getByRole('button', { name: 'Adım görseli (isteğe bağlı): kaldır' }))
      expect(current().steps[0]).not.toHaveProperty('image')
    })
  })
})

describe('BlockHelp', () => {
  it('explains the block, its completion rule and its E-B-M counterpart', () => {
    renderWithProviders(<BlockHelp type="stage-slider" />)
    const meta = BLOCK_CATALOG['stage-slider']
    const note = screen.getByRole('note')

    expect(note).toHaveTextContent(meta.description)
    expect(
      within(note)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Tamamlanma:', 'E-B-M’deki karşılığı:'])
    expect(
      within(note)
        .getAllByRole('definition')
        .map((value) => value.textContent),
    ).toEqual([meta.completion, meta.referenceHint])
  })
})
