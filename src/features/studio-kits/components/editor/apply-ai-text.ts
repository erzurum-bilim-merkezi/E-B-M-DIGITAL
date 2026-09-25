import { newItemId, sequenceItemIcon, shuffleStable, type AiField, type Step } from '@/entities/kit'

import type { AiCardText } from './editor-services'

/** Neutral look of AI choices: an icon or colour per correctness would give the answer away. */
const AI_CHOICE_ICON = '✨'

/** Applies AI-drafted text to the card's fields for its block type (every field stays editable). */
export function applyAiText(step: Step, draft: AiCardText): { step: Step; fields: AiField[] } {
  const base = {
    ...step,
    title: draft.title.slice(0, 80),
    answer: draft.answer,
    narration: draft.narration.slice(0, 600),
    hint: draft.hint.slice(0, 120),
    celebration: draft.celebration.slice(0, 40),
  }
  const fields: AiField[] = ['title', 'answer', 'narration', 'hint', 'celebration']
  const options = draft.options
  switch (base.type) {
    case 'choose-correct':
      if (options.length >= 2) {
        return {
          step: {
            ...base,
            // AI options arrive correct-first: shuffle them (stable per card) and style them alike.
            options: shuffleStable(
              options.slice(0, 6).map((label, index) => ({
                id: newItemId('o'),
                label: label.slice(0, 24),
                icon: AI_CHOICE_ICON,
                color: 'sky' as const,
                correct: index < draft.correctCount,
                feedback: '',
              })),
              `${step.id}:ai-options`,
            ),
          },
          fields: [...fields, 'options'],
        }
      }
      break
    case 'quiz':
      if (options.length >= 2) {
        // The first AI option is the answer; after the shuffle it can sit anywhere (A–D).
        const quizOptions = options
          .slice(0, 4)
          .map((label) => ({ id: newItemId('q'), label: label.slice(0, 80) }))
        const answerId = quizOptions[0]?.id ?? ''
        return {
          step: {
            ...base,
            question: draft.title.slice(0, 160),
            options: shuffleStable(quizOptions, `${step.id}:ai-options`),
            correctOptionId: answerId,
          },
          fields: [...fields, 'options'],
        }
      }
      break
    case 'sequence':
      if (options.length >= 3) {
        return {
          step: {
            ...base,
            // AI options arrive in the solved order: order-free icons keep the answer hidden.
            items: options.slice(0, 8).map((label, index) => ({
              id: newItemId('s'),
              label: label.slice(0, 40),
              icon: sequenceItemIcon(index),
            })),
          },
          fields: [...fields, 'options'],
        }
      }
      break
    case 'matching': {
      const pairs = []
      for (let index = 0; index + 1 < options.length && pairs.length < 5; index += 2) {
        pairs.push({
          id: newItemId('p'),
          left: (options[index] ?? '').slice(0, 40),
          right: (options[index + 1] ?? '').slice(0, 40),
        })
      }
      if (pairs.length >= 2) return { step: { ...base, pairs }, fields: [...fields, 'options'] }
      break
    }
    case 'info':
      return { step: { ...base, body: draft.answer }, fields: [...fields, 'body'] }
    default:
      break
  }
  return { step: base, fields }
}
