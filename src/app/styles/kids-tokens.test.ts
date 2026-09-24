import { contrastRatio } from '@/entities/kit'

import kidsCss from './kids.css?raw'

/** Every `#rrggbb` value a custom property gets in kids.css: [light, dark (media), dark (attr)]. */
function values(property: string) {
  const pattern = new RegExp(`${property}:\\s*(#[0-9a-f]{6})\\b`, 'gi')
  return [...kidsCss.matchAll(pattern)].map((match) => match[1] ?? '')
}

/** Default sky and every kit-theme sky, e.g. `light` → `--kit-light-from: #…` and fallbacks. */
function skies(mode: 'light' | 'dark') {
  const pattern = new RegExp(`--kit-${mode}-(?:from|mid|to)(?::|,)\\s*(#[0-9a-f]{6})`, 'gi')
  return [...kidsCss.matchAll(pattern)].map((match) => match[1] ?? '')
}

function onlyValue(list: string[], index: number) {
  const value = list[index]
  if (!value) throw new Error('token missing in kids.css')
  return value
}

describe('Kâşif control boundary token (WCAG 1.4.11)', () => {
  const border = values('--kid-control-border')
  const surface = values('--kid-surface')
  const surface2 = values('--kid-surface-2')
  const success = values('--kid-success')

  it('is defined for light and both dark variants, the dark ones identical', () => {
    expect(border).toHaveLength(3)
    expect(border[1]).toBe(border[2])
  })

  it.each([
    ['light', 0],
    ['dark', 1],
  ] as const)('keeps ≥ 3:1 against every %s surface and sky', (mode, index) => {
    const edge = onlyValue(border, index)
    const backgrounds = [onlyValue(surface, index), onlyValue(surface2, index), ...skies(mode)]
    expect(backgrounds.length).toBeGreaterThan(8)
    for (const background of backgrounds) {
      expect(contrastRatio(edge, background), `${edge} on ${background}`).toBeGreaterThanOrEqual(3)
    }
  })

  it.each([
    ['light', 0],
    ['dark', 1],
  ] as const)(
    'keeps the %s switch thumb ≥ 3:1 against its track in both states',
    (_mode, index) => {
      // Off: control-border thumb on a surface-2 track; on: surface thumb on a success track.
      expect(
        contrastRatio(onlyValue(border, index), onlyValue(surface2, index)),
      ).toBeGreaterThanOrEqual(3)
      expect(
        contrastRatio(onlyValue(surface, index), onlyValue(success, index)),
      ).toBeGreaterThanOrEqual(3)
      // The on-track itself stands out from the panel.
      expect(
        contrastRatio(onlyValue(success, index), onlyValue(surface, index)),
      ).toBeGreaterThanOrEqual(3)
    },
  )
})
