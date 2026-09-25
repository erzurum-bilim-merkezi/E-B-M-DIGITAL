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

/**
 * Once the camera is blocked, browsers answer `getUserMedia` without asking again, and no page can
 * reopen the prompt. Calls `onGranted` when the permission turns `granted` — in site or app
 * settings, noticed via the permission's `change` event or when the page becomes visible again.
 * Browsers that cannot query the camera permission never call back. Returns a cleanup.
 */
export function watchCameraPermission(onGranted: () => void) {
  const permissions: Permissions | undefined = navigator.permissions
  if (typeof permissions?.query !== 'function') return () => {}
  let stopped = false
  let status: PermissionStatus | null = null

  const check = () => {
    if (!stopped && status?.state === 'granted') onGranted()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') check()
  }

  permissions.query({ name: 'camera' }).then(
    (result) => {
      if (stopped) return
      status = result
      result.addEventListener('change', check)
    },
    () => {},
  )
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    stopped = true
    status?.removeEventListener('change', check)
    document.removeEventListener('visibilitychange', onVisible)
  }
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
