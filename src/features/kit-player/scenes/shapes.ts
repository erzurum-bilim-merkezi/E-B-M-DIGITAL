/**
 * Path builders for the scene illustrations (400 × 260 viewBox, y grows downwards). Shared so every
 * scene uses the same ground, leaf and drop language.
 */

/** One decimal keeps generated path data and coordinates short and deterministic. */
export function round1(value: number) {
  return Math.round(value * 10) / 10
}

const n = round1

/** Top edge of the rounded ground mound; `top` is its height at the centre, the sides sit 10 lower. */
export function groundEdgePath(top: number) {
  const side = top + 10
  return `M-10 ${side}C92 ${side} 122 ${top} 200 ${top}C278 ${top} 308 ${side} 410 ${side}`
}

export function groundPath(top: number) {
  return `${groundEdgePath(top)}V290H-10Z`
}

/** Pale far hills peeking above a ground line at `top`. */
export function farHillsPath(top: number) {
  const t = top
  return `M-10 ${t - 6}C36 ${t - 34} 90 ${t - 40} 140 ${t - 18}C176 ${t - 32} 222 ${t - 42} 268 ${t - 24}C306 ${t - 38} 356 ${t - 42} 410 ${t - 14}V${t + 20}H-10Z`
}

export function nearHillsPath(top: number) {
  const t = top
  return `M-10 ${t + 4}C44 ${t - 16} 100 ${t - 18} 150 ${t - 4}C196 ${t - 16} 256 ${t - 18} 314 ${t - 6}C350 ${t - 14} 384 ${t - 14} 410 ${t - 6}V${t + 20}H-10Z`
}

/** Leaf pointing straight up from its base at (0, 0), widest a little below the middle. */
export function leafPath(length: number, width: number) {
  const a = width * 0.87
  const l = length
  return `M0 0C${n(a * 0.5)} ${n(-l * 0.08)} ${n(a)} ${n(-l * 0.52)} 0 ${n(-l)}C${n(-a)} ${n(-l * 0.52)} ${n(-a * 0.5)} ${n(-l * 0.08)} 0 0Z`
}

/** Midrib of a leaf built by `leafPath` or `lettuceLeafPath`. */
export function veinPath(length: number) {
  return `M0 -3Q${n(length * 0.05)} ${n(-length * 0.46)} 0 ${n(-length * 0.84)}`
}

/** Romaine ("marul") leaf pointing up from (0, 0): narrow base widening into a ruffled crown. */
export function lettuceLeafPath(length: number, width: number, waves = 5) {
  const half = width / 2
  const ry = length * 0.3
  const cy = ry - length
  const parts = [
    `M0 0C${n(half * 0.3)} ${n(-length * 0.12)} ${n(half * 1.02)} ${n(cy * 0.62)} ${n(half)} ${n(cy)}`,
  ]
  for (let i = 1; i <= waves; i++) {
    const end = (Math.PI * i) / waves
    const mid = (Math.PI * (i - 0.5)) / waves
    const qx = half * 1.13 * Math.cos(mid)
    const qy = cy - ry * 1.13 * Math.sin(mid)
    parts.push(`Q${n(qx)} ${n(qy)} ${n(half * Math.cos(end))} ${n(cy - ry * Math.sin(end))}`)
  }
  parts.push(`C${n(-half * 1.02)} ${n(cy * 0.62)} ${n(-half * 0.3)} ${n(-length * 0.12)} 0 0Z`)
  return parts.join('')
}

/** Grass tuft: three tapered blades rising from one point at (0, 0). */
export const GRASS_TUFT_PATH =
  'M-2.4 0Q-3.8 -8.6 -2.2 -16Q1.8 -8.4 2.4 0ZM-2.6 0Q-8.4 -2.4 -13 -9Q-6.2 -5.8 0.6 0ZM-0.6 0Q6 -6 11.5 -11Q7.6 -2.6 2.6 0Z'

/** Water drop; (0, 0) is the centre of its round part, the tip points up. */
export function dropPath(r: number) {
  return `M0 ${n(-r * 1.9)}C${n(r * 0.45)} ${n(-r * 1.2)} ${r} ${n(-r * 0.62)} ${r} 0A${r} ${r} 0 0 1 ${-r} 0C${-r} ${n(-r * 0.62)} ${n(-r * 0.45)} ${n(-r * 1.2)} 0 ${n(-r * 1.9)}Z`
}

/** Four-point twinkle centred on (0, 0). */
export function sparklePath(r: number) {
  const k = n(r * 0.2)
  return `M0 ${-r}Q${k} ${-k} ${r} 0Q${k} ${k} 0 ${r}Q${-k} ${k} ${-r} 0Q${-k} ${-k} 0 ${-r}Z`
}

/** Five-point star centred on (0, 0). */
export function starPath(r: number) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.48
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    return `${n(radius * Math.cos(angle))} ${n(radius * Math.sin(angle))}`
  })
  return `M${points.join('L')}Z`
}

/** Scalloped theatre valance across the top edge; `depth` is where the scallops start. */
export function valancePath(depth: number, count = 10) {
  const width = 400 / count
  const parts = [`M-10 -10H410V${depth}H400`]
  for (let i = count; i > 0; i--) {
    parts.push(`Q${n((i - 0.5) * width)} ${depth + 18} ${n((i - 1) * width)} ${depth}`)
  }
  parts.push('H-10Z')
  return parts.join('')
}

/** Just the scallop line of `valancePath` (for the gold trim). */
export function valanceEdgePath(depth: number, count = 10) {
  const width = 400 / count
  const parts = [`M400 ${depth}`]
  for (let i = count; i > 0; i--) {
    parts.push(`Q${n((i - 0.5) * width)} ${depth + 18} ${n((i - 1) * width)} ${depth}`)
  }
  return parts.join('')
}
