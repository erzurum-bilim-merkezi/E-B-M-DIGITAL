import { useCallback, useEffect, useRef, useState } from 'react'

import {
  cameraProblemFrom,
  hasCameraSupport,
  setTorch,
  stopStream,
  supportsTorch,
  type CameraProblem,
} from '../lib/camera'
import { createFrameDecoder, type FrameDecoder } from '../lib/frame-decoder'

export type CameraStatus = 'starting' | 'scanning' | CameraProblem
export type TorchState = 'unsupported' | 'off' | 'on'

/** ~8 frames per second: fast enough to feel instant, light on the battery. */
const SCAN_INTERVAL_MS = 125

/**
 * Opens the back camera when the component mounts and scans frames for QR codes until it
 * unmounts; every track is stopped on unmount. Never throws: failures become a status.
 */
export function useQrCamera(onDetected: (text: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const onDetectedRef = useRef(onDetected)
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [torch, setTorchState] = useState<TorchState>('unsupported')

  useEffect(() => {
    onDetectedRef.current = onDetected
  })

  useEffect(() => {
    const video = videoRef.current
    let cancelled = false
    let stream: MediaStream | null = null
    let timer: number | undefined

    const scan = async (decoder: FrameDecoder) => {
      if (cancelled || !video) return
      try {
        if (
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          document.visibilityState !== 'hidden'
        ) {
          const text = await decoder.decode(video).catch(() => null)
          if (cancelled) return
          if (text) onDetectedRef.current(text)
        }
      } finally {
        // Whatever a handler does with a strange code, keep scanning.
        if (!cancelled) timer = window.setTimeout(() => void scan(decoder), SCAN_INTERVAL_MS)
      }
    }

    const start = async () => {
      try {
        if (!video) throw new Error('Video element is not mounted.')
        if (!hasCameraSupport()) throw new DOMException('No camera API.', 'NotFoundError')
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        })
        if (cancelled) {
          stopStream(stream)
          return
        }
        video.srcObject = stream
        await video.play()
        if (cancelled) return

        const [track] = stream.getVideoTracks()
        trackRef.current = track ?? null
        setTorchState(track && supportsTorch(track) ? 'off' : 'unsupported')
        setStatus('scanning')

        const decoder = await createFrameDecoder()
        if (cancelled) return
        void scan(decoder)
      } catch (error) {
        if (cancelled) return
        stopStream(stream)
        trackRef.current = null
        setTorchState('unsupported')
        setStatus(cameraProblemFrom(error))
      }
    }

    void start()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      stopStream(stream)
      trackRef.current = null
      if (video) video.srcObject = null
    }
  }, [])

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current
    if (!track) return
    const next = torch !== 'on'
    try {
      await setTorch(track, next)
      setTorchState(next ? 'on' : 'off')
    } catch {
      // Some devices advertise a torch they cannot switch: hide the button instead of failing.
      setTorchState('unsupported')
    }
  }, [torch])

  return { videoRef, status, torch, toggleTorch }
}
