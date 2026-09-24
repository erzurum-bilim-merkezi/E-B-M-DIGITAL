import { hashString } from '@/entities/kit'

/**
 * Deterministic stand-in for Gemini (AI_PROVIDER=fake): used by local development, the mock
 * backend and CI. Produces contract-conformant SVGs (viewBox 400×260, <title>/<desc>, CSS
 * keyframes, reduced-motion rule, no external references) and simple Turkish texts.
 *
 * Prompt markers trigger error paths for tests: "[filtre]" (safety block),
 * "[zaman-aşımı]" (timeout), "[kötü-svg]" (malicious output that the checker must reject).
 */
export const FAKE_TRIGGERS = {
  filter: '[filtre]',
  timeout: '[zaman-aşımı]',
  malicious: '[kötü-svg]',
} as const

const KEYWORD_EMOJI: [RegExp, string][] = [
  [/tohum|çekirdek/i, '🌱'],
  [/marul|sebze/i, '🥬'],
  [/bitki|yaprak|fotosentez/i, '🌿'],
  [/çiçek|polen/i, '🌸'],
  [/ağaç|orman/i, '🌳'],
  [/güneş/i, '☀️'],
  [/ışık|ampul|lamba/i, '💡'],
  [/yağmur/i, '🌧️'],
  [/su|damla|nem/i, '💧'],
  [/mıknatıs|manyet/i, '🧲'],
  [/elektrik|devre|akım/i, '⚡'],
  [/pil|batarya|enerji/i, '🔋'],
  [/gezegen|satürn/i, '🪐'],
  [/roket|uzay|astronot/i, '🚀'],
  [/ay\b|dolunay/i, '🌙'],
  [/yıldız/i, '⭐'],
  [/dünya|küre/i, '🌍'],
  [/yanardağ|volkan|lav/i, '🌋'],
  [/kalp|kan/i, '❤️'],
  [/beyin|düşün/i, '🧠'],
  [/göz|görme/i, '👁️'],
  [/robot|kodlama/i, '🤖'],
  [/arı|bal\b/i, '🐝'],
  [/kelebek/i, '🦋'],
  [/balık|deniz/i, '🐟'],
  [/kuş|uçmak/i, '🐦'],
  [/ateş|yanma/i, '🔥'],
  [/buz|donma/i, '🧊'],
  [/kar\b|kış/i, '❄️'],
  [/rüzgâr|rüzgar|hava/i, '🌬️'],
  [/bulut/i, '☁️'],
  [/mikroskop|hücre/i, '🔬'],
  [/deney|kimya/i, '🧪'],
  [/atom|molekül/i, '⚛️'],
  [/ses|titreşim/i, '🔊'],
  [/müzik/i, '🎵'],
  [/renk|gökkuşağı/i, '🌈'],
  [/sıcaklık|termometre|ısı/i, '🌡️'],
]

const STATE_EMOJI: Record<string, string> = {
  sun: '☀️',
  water: '💧',
  temp: '🌡️',
  air: '🌬️',
  seed: '🌰',
  sprout: '🌱',
  seedling: '🌿',
  grown: '🥬',
}

const PALETTES = [
  { top: '#BDE9FF', bottom: '#EAFBEF', ground: '#8A5A3B', accent: '#2F8545' },
  { top: '#D9D6FF', bottom: '#F7F6FF', ground: '#5249D8', accent: '#3F37B0' },
  { top: '#FFE3C7', bottom: '#FFF7EF', ground: '#C0560D', accent: '#A2470A' },
  { top: '#BFE6FF', bottom: '#F2FAFF', ground: '#1C70B5', accent: '#155C97' },
  { top: '#FFD3E6', bottom: '#FFF5FA', ground: '#C0336B', accent: '#A12857' },
] as const

export function pickEmoji(text: string) {
  return KEYWORD_EMOJI.find(([pattern]) => pattern.test(text))?.[1] ?? '✨'
}

function escapeXml(text: string) {
  return text.replace(
    /[<>&"']/g,
    (char) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char] ?? char,
  )
}

const STATE_LABEL: Record<string, string> = {
  before: 'önce',
  after: 'sonra',
  on: 'açık',
  off: 'kapalı',
  idle: 'başlangıç',
  success: 'başarı',
  play: 'hareketli',
  static: 'durağan',
}

export function describeState(title: string, state: string) {
  return `${title} — ${STATE_LABEL[state] ?? state} hâli`
}

/** One scene frame. `variant` shifts the palette for "Farklı bir öneri". */
export function fakeSceneSvg({
  title,
  topic,
  state,
  variant = 0,
}: {
  title: string
  topic: string
  state: string
  variant?: number
}) {
  const palette = PALETTES[(hashString(topic) + variant) % PALETTES.length] ?? PALETTES[0]
  const hero = pickEmoji(`${topic} ${title}`)
  const extra = STATE_EMOJI[state]
  const dim = state === 'off' || state === 'before' || state === 'idle'
  const happy = state === 'after' || state === 'on' || state === 'success'
  const animated = state !== 'static'
  const heroSize = state === 'before' ? 64 : happy ? 104 : 88

  const sparkles = happy
    ? `<g class="twinkle" fill="${palette.accent}"><path d="M86 70 l5 13 13 5 -13 5 -5 13 -5 -13 -13 -5 13 -5 Z"/><path d="M312 58 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 Z"/><path d="M300 150 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z"/></g>`
    : ''
  const badge = extra
    ? `<g class="pop2"><circle cx="318" cy="84" r="34" fill="#ffffff" opacity=".92"/><text x="318" y="98" text-anchor="middle" font-size="36">${extra}</text></g>`
    : ''
  const question =
    state === 'before'
      ? `<text x="258" y="110" font-size="38" font-weight="700" fill="${palette.accent}" font-family="sans-serif">?</text>`
      : ''
  const night =
    dim && state === 'off' ? '<rect width="400" height="260" fill="#0D0B2E" opacity=".35"/>' : ''
  const check =
    state === 'success'
      ? `<g class="pop2"><circle cx="84" cy="200" r="22" fill="${palette.accent}"/><path d="M73 200 l8 8 15 -16" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/></g>`
      : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">`,
    `<title>${escapeXml(title)}</title>`,
    `<desc>${escapeXml(describeState(title, state))}</desc>`,
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.top}"/><stop offset="1" stop-color="${palette.bottom}"/></linearGradient></defs>`,
    animated
      ? `<style>@keyframes pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes tw{0%,100%{opacity:1}50%{opacity:.35}}.hero{transform-origin:200px 150px;animation:pop .6s cubic-bezier(.2,1.4,.4,1) both${state === 'play' ? ',float 2.4s ease-in-out .6s infinite' : ''}}.pop2{transform-origin:318px 84px;animation:pop .5s .25s cubic-bezier(.2,1.4,.4,1) both}.twinkle{animation:tw 1.6s ease-in-out infinite}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>`
      : '',
    `<rect width="400" height="260" fill="url(#sky)"/>`,
    `<ellipse cx="200" cy="262" rx="240" ry="46" fill="${palette.ground}" opacity=".85"/>`,
    sparkles,
    `<g class="hero"><text x="200" y="${150 + heroSize / 3}" text-anchor="middle" font-size="${heroSize}"${dim ? ' opacity=".7"' : ''}>${hero}</text></g>`,
    question,
    badge,
    check,
    night,
    `</svg>`,
  ].join('')
}

/** Deliberately unsafe output — the checker must reject it before anything is stored. */
export function maliciousSvg(title: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" onload="alert(1)"><title>${escapeXml(title)}</title><desc>x</desc><script>alert(1)</script><image href="https://evil.example/x.png"/></svg>`
}

export function fakeIconSvg(concept: string, variant: number) {
  const palette = PALETTES[(hashString(concept) + variant) % PALETTES.length] ?? PALETTES[0]
  const emoji = pickEmoji(concept)
  const shape =
    variant % 2 === 0
      ? `<circle cx="32" cy="32" r="30" fill="${palette.accent}"/>`
      : `<rect x="3" y="3" width="58" height="58" rx="16" fill="${palette.accent}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>${escapeXml(concept)}</title><desc>${escapeXml(`${concept} ikonu`)}</desc>${shape}<text x="32" y="43" text-anchor="middle" font-size="30">${emoji}</text></svg>`
}

function capitalizeTr(text: string) {
  return text.charAt(0).toLocaleUpperCase('tr') + text.slice(1)
}

export function fakeCardText(topic: string, blockType: string) {
  const subject = capitalizeTr(topic.trim() || 'Bilim')
  const lower = subject.toLocaleLowerCase('tr')
  const base = {
    title: `${subject} nedir?`,
    answer: `**${subject}**, çevremizde her gün karşılaştığımız ilginç bir bilim konusudur. Gözlem yaparak ve soru sorarak **${lower}** hakkında çok şey öğrenebiliriz.`,
    narration: `${subject}, çevremizde her gün karşılaştığımız ilginç bir bilim konusudur. Gözlem yaparak ve soru sorarak çok şey öğrenebiliriz.`,
    hint: `👆 Dokun ve ${lower} hakkında keşfet!`,
    celebration: '🎉 Harika keşif!',
    options: [] as string[],
    correctCount: 0,
  }
  switch (blockType) {
    case 'choose-correct':
      return {
        ...base,
        title: `${subject} için neler gerekir?`,
        options: ['Gözlem', 'Merak', 'Sihirli değnek'],
        correctCount: 2,
      }
    case 'quiz':
      return {
        ...base,
        title: `${subject} sorusu`,
        options: [
          `${subject} bir bilim konusudur`,
          `${subject} bir oyuncaktır`,
          `${subject} bir renktir`,
        ],
        correctCount: 1,
      }
    case 'sequence':
      return {
        ...base,
        title: `${subject}: sırayı bul`,
        options: ['Gözlemle', 'Soru sor', 'Deney yap', 'Sonucu paylaş'],
        correctCount: 4,
      }
    case 'matching':
      return {
        ...base,
        title: `${subject}: eşleştir`,
        options: ['Göz', 'Gözlem', 'Kulak', 'Dinleme', 'El', 'Dokunma'],
        correctCount: 3,
      }
    case 'compare-cards':
      return {
        ...base,
        title: `${subject}: farkı bul`,
        options: ['Önce', 'Sonra'],
        correctCount: 0,
      }
    default:
      return base
  }
}
