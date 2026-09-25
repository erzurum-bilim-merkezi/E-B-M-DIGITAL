import { emojiSchema, type Visual } from '@/entities/kit'

import { EmojiField, SelectField, TextField } from '../fields'
import {
  isSceneStateName,
  librarySceneStates,
  sceneStateLabel,
  toSceneStateName,
} from './scene-states'
import { useValidatedDraft } from './useValidatedDraft'

function isEmoji(value: string) {
  return emojiSchema.safeParse(value).success
}

/** Emoji of a list item (stage, button, option …); clearing it never stores an empty emoji. */
export function BlockEmojiField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (emoji: string) => void
}) {
  const { draft, change, valid } = useValidatedDraft(value, isEmoji, onChange)
  return (
    <EmojiField
      id={id}
      label="Emoji"
      value={draft}
      onChange={change}
      error={valid ? undefined : 'Bir emoji yazın ya da seçin.'}
    />
  )
}

function SceneStateNameField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (state: string) => void
}) {
  const { draft, change, valid } = useValidatedDraft(value, isSceneStateName, onChange)
  return (
    <TextField
      id={id}
      label="Sahne durumu"
      value={draft}
      onChange={(raw) => change(toSceneStateName(raw))}
      max={24}
      placeholder="ör. filiz"
      description="AI sahnesindeki durum adı (küçük harf, rakam ve tire)."
      error={valid ? undefined : 'Harfle başlayan bir durum adı yazın.'}
    />
  )
}

/**
 * The scene state a stage or hotspot shows. Library scenes list their states by Turkish name;
 * AI and emoji scenes take a free state name that the AI scene must then provide.
 */
export function SceneStateField({
  id,
  visual,
  value,
  onChange,
  description,
}: {
  id: string
  visual: Visual | undefined
  value: string
  onChange: (state: string) => void
  /** Help text for the library-scene picker. */
  description: string
}) {
  const states = librarySceneStates(visual)
  if (!states) return <SceneStateNameField id={id} value={value} onChange={onChange} />

  const options = states.map((state) => ({ value: state, label: sceneStateLabel(state) }))
  // Keep a state the scene lacks (e.g. after switching scenes) visible instead of faking a choice.
  if (!states.includes(value)) {
    options.push({ value, label: `${sceneStateLabel(value)} (bu sahnede yok)` })
  }
  return (
    <SelectField
      id={id}
      label="Sahne durumu"
      value={value}
      options={options}
      onChange={onChange}
      description={description}
    />
  )
}
