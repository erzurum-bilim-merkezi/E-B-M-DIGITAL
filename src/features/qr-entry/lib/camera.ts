export type CameraProblem = 'denied' | 'not-found' | 'failed'

const DENIED = new Set(['NotAllowedError', 'PermissionDeniedError', 'SecurityError'])
const NOT_FOUND = new Set(['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'])

/** `false` on devices without a camera API (and on insecure http:// origins). */
export function hasCameraSupport() {
  const mediaDevices: MediaDevices | undefined = navigator.mediaDevices
  return typeof mediaDevices?.getUserMedia === 'function'
}

/** Maps a `getUserMedia` / `play()` failure to what we tell the child. */
export function cameraProblemFrom(error: unknown): CameraProblem {
  const name =
    typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
      ? error.name
      : ''
  if (DENIED.has(name)) return 'denied'
  if (NOT_FOUND.has(name)) return 'not-found'
  return 'failed'
}

export function stopStream(stream: MediaStream | null) {
  if (!stream) return
  for (const track of stream.getTracks()) track.stop()
}

// The torch is part of the Image Capture extensions, which the TypeScript DOM lib leaves out.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }
type TorchConstraintSet = MediaTrackConstraintSet & { torch?: boolean }

/** Never throws: a camera that works without a torch must not fail because of it. */
export function supportsTorch(track: MediaStreamTrack) {
  if (typeof track.getCapabilities !== 'function') return false
  try {
    const capabilities: TorchCapabilities = track.getCapabilities()
    return capabilities.torch === true
  } catch {
    return false
  }
}

export function setTorch(track: MediaStreamTrack, on: boolean) {
  const torch: TorchConstraintSet = { torch: on }
  return track.applyConstraints({ advanced: [torch] })
}
