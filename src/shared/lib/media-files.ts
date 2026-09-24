/** Upload budgets that keep the Supabase Free egress/storage quotas safe (ADR 0020). */
export const IMAGE_MAX_EDGE = 1200
export const IMAGE_TARGET_BYTES = 150 * 1000
export const IMAGE_MAX_INPUT_BYTES = 15 * 1000 * 1000
export const ICON_MAX_BYTES = 200 * 1000
export const AUDIO_MAX_BYTES = 1000 * 1000
export const CAPTIONS_MAX_BYTES = 100 * 1000

export class MediaFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaFileError'
  }
}

/** Target size that fits `maxEdge` while keeping the aspect ratio (never upscales). */
export function planResize(width: number, height: number, maxEdge = IMAGE_MAX_EDGE) {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** Center square crop for icons. */
export function planSquareCrop(width: number, height: number) {
  const size = Math.min(width, height)
  return { sx: Math.round((width - size) / 2), sy: Math.round((height - size) / 2), size }
}

const QUALITY_STEPS = [0.86, 0.78, 0.7, 0.6, 0.5, 0.42]

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

/** WebP at `quality`, or JPEG on browsers without a WebP encoder (they fall back to PNG). */
async function encodeImage(canvas: HTMLCanvasElement, quality: number) {
  const webp = await canvasToBlob(canvas, 'image/webp', quality)
  return webp && webp.type === 'image/webp'
    ? webp
    : await canvasToBlob(canvas, 'image/jpeg', quality)
}

export type ProcessedImage = { blob: Blob; width: number; height: number; mime: string }

/**
 * Re-encodes an image in the browser (Free plan has no image transformations): orientation
 * applied, EXIF/GPS dropped, longest edge ≤ 1200 px, WebP (JPEG on browsers without a WebP
 * encoder) under ~150 kB. Throws `MediaFileError` with a user-facing message.
 */
export async function processImage(
  file: Blob,
  { maxEdge = IMAGE_MAX_EDGE, targetBytes = IMAGE_TARGET_BYTES, square = false } = {},
): Promise<ProcessedImage> {
  if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(file.type)) {
    throw new MediaFileError('Yalnızca PNG, JPEG, WebP, GIF ya da AVIF görseller yüklenebilir.')
  }
  if (file.size > IMAGE_MAX_INPUT_BYTES) {
    throw new MediaFileError('Görsel çok büyük (en fazla 15 MB).')
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new MediaFileError('Görsel açılamadı. Dosya bozuk olabilir.')
  }

  const crop = square ? planSquareCrop(bitmap.width, bitmap.height) : null
  const sourceWidth = crop ? crop.size : bitmap.width
  const sourceHeight = crop ? crop.size : bitmap.height
  let { width, height } = planResize(sourceWidth, sourceHeight, maxEdge)

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new MediaFileError('Tarayıcı görseli işleyemedi.')

  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = width
      canvas.height = height
      context.clearRect(0, 0, width, height)
      if (crop)
        context.drawImage(bitmap, crop.sx, crop.sy, crop.size, crop.size, 0, 0, width, height)
      else context.drawImage(bitmap, 0, 0, width, height)

      for (const quality of QUALITY_STEPS) {
        // oxlint-disable-next-line no-await-in-loop -- sequential on purpose: highest quality first, stop at the first one under budget
        const blob = await encodeImage(canvas, quality)
        if (blob && blob.size <= targetBytes) return { blob, width, height, mime: blob.type }
      }
      width = Math.max(1, Math.round(width * 0.8))
      height = Math.max(1, Math.round(height * 0.8))
    }
  } finally {
    bitmap.close()
  }
  throw new MediaFileError(
    'Görsel hedef boyuta (150 kB) küçültülemedi. Daha sade bir görsel deneyin.',
  )
}

/** Reads the duration of an audio file (metadata only). */
export function probeAudioDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0)
    })
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new MediaFileError('Ses dosyası okunamadı.'))
    })
    audio.src = url
  })
}

export function checkAudioFile(file: Blob) {
  if (!/^audio\/(mpeg|mp3|mp4|x-m4a|aac|ogg|webm|wav)$/.test(file.type)) {
    throw new MediaFileError('Yalnızca MP3, M4A, OGG ya da WAV ses dosyaları yüklenebilir.')
  }
  if (file.size > AUDIO_MAX_BYTES) {
    throw new MediaFileError(
      'Ses dosyası en fazla 1 MB olabilir. Daha kısa ya da sıkıştırılmış bir kayıt deneyin.',
    )
  }
}

export async function checkCaptionsFile(file: Blob) {
  if (file.size > CAPTIONS_MAX_BYTES)
    throw new MediaFileError('Altyazı dosyası en fazla 100 kB olabilir.')
  const head = (await file.slice(0, 16).text()).replace(/^﻿/, '')
  if (!head.startsWith('WEBVTT')) {
    throw new MediaFileError('Altyazı dosyası WebVTT (.vtt) biçiminde olmalı.')
  }
}

export function isVideoFile(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(file.name)
}
