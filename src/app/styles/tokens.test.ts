import { readFileSync } from 'node:fs'
import path from 'node:path'

/*
 * WCAG 1.4.11: the outline of inputs, selects, checkboxes, radios and switch tracks
 * (`--control-border`) needs 3:1 against every surface such a control sits on, in both themes.
 */

const css = readFileSync(path.resolve('src/app/styles/global.css'), 'utf8')

/** The declarations of the first rule whose selector starts with `selector`. */
function block(selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`${selector} not found in global.css`)
  return css.slice(start, css.indexOf('}', start))
}

type Oklch = readonly [lightness: number, chroma: number, hue: number]

function token(rules: string, name: string): Oklch {
  const value = new RegExp(`--${name}:\\s*([^;]+);`).exec(rules)?.[1]?.trim()
  if (value === 'var(--color-white)') return [1, 0, 0]
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value ?? '')
  if (!match) throw new Error(`--${name} is not a plain oklch() value: ${value}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

const clip = (channel: number) => Math.min(1, Math.max(0, channel))

/** Relative luminance (WCAG) of an OKLCH colour, via linear sRGB. */
function luminance([lightness, chroma, hue]: Oklch) {
  const a = chroma * Math.cos((hue * Math.PI) / 180)
  const b = chroma * Math.sin((hue * Math.PI) / 180)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const red = clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  const green = clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  const blue = clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(first: Oklch, second: Oklch) {
  const [high, low] = [luminance(first), luminance(second)].toSorted((x, y) => y - x)
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05)
}

const themes = {
  light: block(":root,\n  [data-theme='light']"),
  dark: block("[data-theme='dark']"),
  'dark (system)': block(":root:not([data-theme='light'])"),
}

describe.each(Object.entries(themes))('--control-border · %s theme', (_, rules) => {
  it.each(['canvas', 'surface', 'surface-muted', 'surface-raised'])(
    'has at least 3:1 against --%s',
    (surface) => {
      expect(
        contrast(token(rules, 'control-border'), token(rules, surface)),
      ).toBeGreaterThanOrEqual(3)
    },
  )
})
