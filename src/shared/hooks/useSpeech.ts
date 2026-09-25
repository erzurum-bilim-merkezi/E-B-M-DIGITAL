import { useCallback, useEffect, useId, useSyncExternalStore } from 'react'

/**
 * Read-aloud with the browser's speech engine, tuned like the reference kit (R3–R4):
 * tr-TR, rate 0.92, pitch 1.1. Only one text speaks at a time app-wide; pressing again stops.
 */
export const SPEECH_RATE = 0.92
export const SPEECH_PITCH = 1.1

let speakingId: string | null = null
const listeners = new Set<() => void>()
// iOS Safari garbage-collects utterances mid-sentence unless something keeps a reference.
let activeUtterance: SpeechSynthesisUtterance | null = null

function emit() {
  for (const listener of listeners) listener()
}

function setSpeaking(id: string | null) {
  speakingId = id
  emit()
}

export function isSpeechSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  )
}

/** Stops whatever is being read (route changes, unmounts, global mute). */
export function stopSpeech() {
  if (isSpeechSupported()) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      // Engine unavailable — nothing is speaking.
    }
  }
  activeUtterance = null
  if (speakingId !== null) setSpeaking(null)
}

function pickTurkishVoice() {
  try {
    return (
      window.speechSynthesis
        .getVoices()
        .find((voice) => voice.lang.toLowerCase().startsWith('tr')) ?? null
    )
  } catch {
    return null
  }
}

function speak(id: string, text: string) {
  stopSpeech()
  if (!isSpeechSupported() || !text.trim()) return
  try {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'tr-TR'
    utterance.rate = SPEECH_RATE
    utterance.pitch = SPEECH_PITCH
    const voice = pickTurkishVoice()
    if (voice) utterance.voice = voice
    const finish = () => {
      if (activeUtterance === utterance) {
        activeUtterance = null
        setSpeaking(null)
      }
    }
    utterance.addEventListener('end', finish)
    utterance.addEventListener('error', finish)
    activeUtterance = utterance
    setSpeaking(id)
    window.speechSynthesis.speak(utterance)
  } catch {
    setSpeaking(null)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export type SpeechControls = {
  supported: boolean
  speaking: boolean
  /** Speaks `text`, or stops if this control is already speaking. */
  toggle: () => void
  stop: () => void
}

export function useSpeech(
  text: string,
  { muted = false }: { muted?: boolean } = {},
): SpeechControls {
  const id = useId()
  const current = useSyncExternalStore(
    subscribe,
    () => speakingId,
    () => null,
  )
  const speaking = current === id
  const supported = isSpeechSupported()

  const stop = useCallback(() => {
    if (speakingId === id) stopSpeech()
  }, [id])

  const toggle = useCallback(() => {
    if (speakingId === id) stopSpeech()
    else if (!muted) speak(id, text)
  }, [id, muted, text])

  // Stop when the component goes away or the app gets muted mid-sentence.
  useEffect(
    () => () => {
      if (speakingId === id) stopSpeech()
    },
    [id],
  )
  useEffect(() => {
    if (muted && speakingId === id) stopSpeech()
  }, [id, muted])

  return { supported, speaking, toggle, stop }
}
