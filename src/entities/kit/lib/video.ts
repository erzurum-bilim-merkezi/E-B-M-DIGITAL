export type ParsedVideoUrl =
  | { ok: true; provider: 'youtube'; videoId: string }
  | { ok: true; provider: 'mp4'; url: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'not-https' | 'unrecognized' }

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
])
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const VIDEO_FILE = /\.(?:mp4|m4v|webm)$/i

/**
 * Videos are linked, never uploaded. Accepts YouTube links (`watch?v=`, `youtu.be/`, `shorts/`,
 * `embed/`, `live/`) and direct https video files (.mp4, .m4v, .webm).
 */
export function parseVideoUrl(input: string): ParsedVideoUrl {
  const value = input.trim()
  if (!value) return { ok: false, reason: 'empty' }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (url.protocol !== 'https:') {
    return url.protocol === 'http:'
      ? { ok: false, reason: 'not-https' }
      : { ok: false, reason: 'invalid' }
  }

  if (YOUTUBE_HOSTS.has(url.hostname)) {
    let id: string | null = null
    if (url.hostname === 'youtu.be') id = url.pathname.split('/')[1] ?? null
    else if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const match = /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(url.pathname)
      id = match?.[1] ?? null
    }
    return id && YOUTUBE_ID.test(id)
      ? { ok: true, provider: 'youtube', videoId: id }
      : { ok: false, reason: 'unrecognized' }
  }

  if (VIDEO_FILE.test(url.pathname)) return { ok: true, provider: 'mp4', url: url.toString() }
  return { ok: false, reason: 'unrecognized' }
}

export const VIDEO_URL_ERRORS: Record<Exclude<ParsedVideoUrl, { ok: true }>['reason'], string> = {
  empty: 'Bir video bağlantısı yapıştırın.',
  invalid: 'Bu geçerli bir bağlantı değil.',
  'not-https': 'Güvenlik için yalnızca https:// ile başlayan bağlantılar kabul edilir.',
  unrecognized:
    'Bağlantı tanınmadı. YouTube bağlantısı ya da .mp4/.webm ile biten doğrudan bir video bağlantısı kullanın.',
}

/** Privacy-enhanced embed without related videos from other channels. */
export function youtubeEmbedUrl(videoId: string) {
  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`)
  url.searchParams.set('rel', '0')
  url.searchParams.set('modestbranding', '1')
  url.searchParams.set('playsinline', '1')
  url.searchParams.set('autoplay', '1')
  url.searchParams.set('cc_lang_pref', 'tr')
  url.searchParams.set('hl', 'tr')
  return url.toString()
}
