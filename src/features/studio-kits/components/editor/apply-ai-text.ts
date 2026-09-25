import { newItemId, sequenceItemIcon, type AiField, type Step } from '@/entities/kit'

import type { AiCardText } from './editor-services'

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
            options: options.slice(0, 6).map((label, index) => ({
              id: newItemId('o'),
              label: label.slice(0, 24),
              icon: index < draft.correctCount ? '✅' : '🎩',
              color: index < draft.correctCount ? ('green' as const) : ('purple' as const),
              correct: index < draft.correctCount,
              feedback: '',
            })),
          },
          fields: [...fields, 'options'],
        }
      }
      break
    case 'quiz':
      if (options.length >= 2) {
        const quizOptions = options
          .slice(0, 4)
          .map((label) => ({ id: newItemId('q'), label: label.slice(0, 80) }))
        return {
          step: {
            ...base,
            question: draft.title.slice(0, 160),
            options: quizOptions,
            correctOptionId: quizOptions[0]?.id ?? '',
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
            items: options.slice(0, 6).map((label, index) => ({
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
