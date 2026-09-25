// Type only — the library itself is loaded on demand in `loadJsQr`.
import type jsQR from 'jsqr'

/** Reads the QR text visible in the current video frame, or `null` when there is none. */
export type FrameDecoder = { decode: (video: HTMLVideoElement) => Promise<string | null> }

// Shape Detection API — not in the TypeScript DOM lib yet, so typed locally.
type DetectedBarcode = { rawValue: string; format: string }
type BarcodeDetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>
}
type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
  getSupportedFormats?: () => Promise<string[]>
}
type ShapeDetectionScope = typeof globalThis & { BarcodeDetector?: BarcodeDetectorConstructor }

/** Longest side of the frame handed to jsQR: enough for a label at arm's length, cheap to scan. */
const MAX_DECODE_SIDE = 640

async function createNativeDecoder(): Promise<FrameDecoder | null> {
  const scope: ShapeDetectionScope = globalThis
  const Detector = scope.BarcodeDetector
  if (!Detector) return null
  try {
    const formats =
      typeof Detector.getSupportedFormats === 'function' ? await Detector.getSupportedFormats() : []
    if (!formats.includes('qr_code')) return null
    const detector = new Detector({ formats: ['qr_code'] })
    return {
      async decode(video) {
        const codes = await detector.detect(video)
        return codes.find((code) => code.rawValue)?.rawValue ?? null
      },
    }
  } catch {
    return null
  }
}

type JsQr = typeof jsQR

async function loadJsQr(): Promise<JsQr> {
  // jsQR is CommonJS with `exports.default`: depending on the bundler's interop, `default` is
  // either the function itself or the whole `exports` object.
  const module: { default: JsQr | { default?: JsQr } } = await import('jsqr')
  const exported = module.default
  if (typeof exported === 'function') return exported
  if (exported.default) return exported.default
  throw new Error('jsQR could not be loaded.')
}

async function createJsQrDecoder(): Promise<FrameDecoder> {
  const decodeImage = await loadJsQr()
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas 2D context is not available.')

  return {
    async decode(video) {
      const { videoWidth, videoHeight } = video
      if (!videoWidth || !videoHeight) return null
      const scale = Math.min(1, MAX_DECODE_SIDE / Math.max(videoWidth, videoHeight))
      const width = Math.round(videoWidth * scale)
      const height = Math.round(videoHeight * scale)
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      context.drawImage(video, 0, 0, width, height)
      const { data } = context.getImageData(0, 0, width, height)
      return decodeImage(data, width, height, { inversionAttempts: 'dontInvert' })?.data || null
    },
  }
}

/**
 * The browser's own `BarcodeDetector` when it can read QR codes (e.g. Chrome on Android),
 * otherwise jsQR, loaded on demand.
 */
export async function createFrameDecoder(): Promise<FrameDecoder> {
  return (await createNativeDecoder()) ?? createJsQrDecoder()
}
