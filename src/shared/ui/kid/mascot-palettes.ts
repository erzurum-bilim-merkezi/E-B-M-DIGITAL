/** Avatar palettes — the robot-astronaut from the Kâşif logo in six colors. */
export const MASCOT_PALETTES = {
  indigo: {
    bg: ['#3B3486', '#1E1B54'],
    eyes: '#4FE3D8',
    antenna: '#FFB13D',
    ring: '#2BE0C8',
    spark: '#FFD653',
  },
  teal: {
    bg: ['#12908A', '#0B4F4A'],
    eyes: '#FFD653',
    antenna: '#FF8A5B',
    ring: '#FFD653',
    spark: '#FFFFFF',
  },
  sun: {
    bg: ['#F4A91F', '#B86A08'],
    eyes: '#4FE3D8',
    antenna: '#5249D8',
    ring: '#FFFFFF',
    spark: '#FFFFFF',
  },
  coral: {
    bg: ['#E8675F', '#A73B36'],
    eyes: '#FFE8A3',
    antenna: '#2BE0C8',
    ring: '#FFD653',
    spark: '#FFE8A3',
  },
  leaf: {
    bg: ['#3C9A52', '#17552A'],
    eyes: '#B9F0B0',
    antenna: '#FFD653',
    ring: '#B9F0B0',
    spark: '#FFD653',
  },
  berry: {
    bg: ['#8A58D2', '#472977'],
    eyes: '#FFB6E1',
    antenna: '#2BE0C8',
    ring: '#FF8AC6',
    spark: '#FFD653',
  },
} as const

export type MascotColor = keyof typeof MASCOT_PALETTES
export type MascotPose = 'hello' | 'thinking' | 'celebrate' | 'idle'

/** Avatar colors in palette order (the Kâşif avatar picker offers exactly these). */
export const MASCOT_COLORS = Object.keys(MASCOT_PALETTES).filter(
  (key): key is MascotColor => key in MASCOT_PALETTES,
)
