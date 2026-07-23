import { useEffect, useState } from 'react'

/**
 * MT-1 voice: browser `speechSynthesis` only (no third-party audio APIs). Text
 * is always displayed alongside speech — speaking is never the only channel.
 */

export function voiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!voiceSupported()) return []
  return window.speechSynthesis.getVoices()
}

/** Subscribe to the (async-loading) system voice list. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => getVoices())
  useEffect(() => {
    if (!voiceSupported()) return
    const synth = window.speechSynthesis
    const update = () => setVoices(synth.getVoices())
    update()
    synth.addEventListener('voiceschanged', update)
    return () => synth.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

const clampRate = (r: number) => Math.max(0.5, Math.min(1.5, r))

export interface SpeakOptions {
  voiceURI?: string
  rate?: number
}

/** Speak one line, cancelling anything already in progress. No-op if unsupported. */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!voiceSupported() || !text.trim()) return
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  if (opts.voiceURI) {
    const v = synth.getVoices().find((vv) => vv.voiceURI === opts.voiceURI)
    if (v) u.voice = v
  }
  u.rate = clampRate(opts.rate ?? 1)
  synth.speak(u)
}

export function cancelSpeech(): void {
  if (voiceSupported()) window.speechSynthesis.cancel()
}
