import type { Step } from '../model/blocks.ts'
import type { KitDocument } from '../model/kit.ts'

export function getStepBySlug(kit: Pick<KitDocument, 'steps'>, slug: string): Step | undefined {
  return kit.steps.find((step) => step.slug === slug)
}

export function getStepIndex(kit: Pick<KitDocument, 'steps'>, stepId: string) {
  return kit.steps.findIndex((step) => step.id === stepId)
}

export function getAdjacentSteps(kit: Pick<KitDocument, 'steps'>, stepId: string) {
  const index = getStepIndex(kit, stepId)
  return {
    previous: index > 0 ? kit.steps[index - 1] : undefined,
    next: index >= 0 ? kit.steps[index + 1] : undefined,
    index,
    total: kit.steps.length,
  }
}

/** Cards that count towards "kit completed" (optional cards are bonus content). */
export function requiredStepIds(kit: Pick<KitDocument, 'steps'>) {
  const required = kit.steps.filter((step) => step.required).map((step) => step.id)
  return required.length > 0 ? required : kit.steps.map((step) => step.id)
}

export function isKitComplete(kit: Pick<KitDocument, 'steps'>, completedStepIds: Iterable<string>) {
  const done = new Set(completedStepIds)
  return requiredStepIds(kit).every((id) => done.has(id))
}

/**
 * Where "Kaldığın yerden devam et" leads: the first required card still to do, in kit order.
 * `undefined` once the kit is complete.
 */
export function firstUnfinishedStep(
  kit: Pick<KitDocument, 'steps'>,
  completedStepIds: Iterable<string>,
): Step | undefined {
  const done = new Set(completedStepIds)
  const required = new Set(requiredStepIds(kit))
  return kit.steps.find((step) => required.has(step.id) && !done.has(step.id))
}

/**
 * "Sıradaki kart": the next card after `stepId` that is not done yet (bonus cards included),
 * wrapping around to the start so cards skipped earlier are not lost. Never the card itself.
 */
export function nextUnfinishedStep(
  kit: Pick<KitDocument, 'steps'>,
  stepId: string,
  completedStepIds: Iterable<string>,
): Step | undefined {
  const done = new Set(completedStepIds)
  const index = getStepIndex(kit, stepId)
  const ordered = [...kit.steps.slice(index + 1), ...kit.steps.slice(0, Math.max(0, index))]
  return ordered.find((step) => step.id !== stepId && !done.has(step.id))
}

/** Share of required cards completed, 0–1. */
export function kitProgressRatio(
  kit: Pick<KitDocument, 'steps'>,
  completedStepIds: Iterable<string>,
) {
  const required = requiredStepIds(kit)
  if (required.length === 0) return 0
  const done = new Set(completedStepIds)
  return required.filter((id) => done.has(id)).length / required.length
}
