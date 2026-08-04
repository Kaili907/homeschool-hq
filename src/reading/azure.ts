/**
 * Azure Speech Pronunciation Assessment provider.
 *
 * The subscription key and region live in dedicated localStorage slots outside
 * AppState. In production, VITE_USE_PROXY routes token acquisition through the
 * serverless proxy, which injects both values and returns only a short-lived
 * authorization token.
 *
 * Privacy: the Speech SDK owns the live microphone stream. This module retains
 * only transcript text and numeric assessment results; no sound is buffered,
 * serialized, cached, or persisted by the app.
 */

import type {
  PronunciationAssessment,
  RecognitionHandlers,
  ReadingRecognition,
} from './recognition'

const KEY_LS = 'homeschool-hq:reading:azure:key'
const REGION_LS = 'homeschool-hq:reading:azure:region'

export const AZURE_SPEECH_ENDPOINT_BASE =
  import.meta.env.VITE_USE_PROXY === 'true' ? '/api/azure-speech' : ''

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function getAzureSpeechKey(): string | null {
  return ls()?.getItem(KEY_LS) ?? null
}

export function setAzureSpeechKey(key: string): void {
  const storage = ls()
  if (!storage) return
  const trimmed = key.trim()
  if (trimmed) storage.setItem(KEY_LS, trimmed)
  else storage.removeItem(KEY_LS)
}

export function clearAzureSpeechKey(): void {
  ls()?.removeItem(KEY_LS)
}

export function getAzureSpeechRegion(): string | null {
  return ls()?.getItem(REGION_LS) ?? null
}

export function setAzureSpeechRegion(region: string): void {
  const storage = ls()
  if (!storage) return
  const trimmed = region.trim().toLowerCase()
  if (trimmed) storage.setItem(REGION_LS, trimmed)
  else storage.removeItem(REGION_LS)
}

export function maskAzureSpeechKey(key: string | null): string {
  if (!key) return ''
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}••••••${key.slice(-4)}`
}

/** Proxy mode is server-configured; direct mode needs both device-local values. */
export function azureSpeechConfigured(
  endpointBase: string = AZURE_SPEECH_ENDPOINT_BASE,
): boolean {
  return endpointBase !== '' || (!!getAzureSpeechKey() && !!getAzureSpeechRegion())
}

interface AzureTokenResponse {
  token: string
  region: string
}

export type AzureTokenFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

export interface AzureRecognitionOptions {
  referenceText: string
  endpointBase?: string
  getKey?: () => string | null
  getRegion?: () => string | null
  fetchImpl?: AzureTokenFetch
}

export async function requestAzureSpeechToken(
  endpointBase: string,
  fetchImpl: AzureTokenFetch,
): Promise<AzureTokenResponse> {
  const response = await fetchImpl(`${endpointBase}/token`, { method: 'POST' })
  if (!response.ok) throw new Error(`azure-speech: token http ${response.status}`)
  const body = (await response.json()) as Partial<AzureTokenResponse>
  if (!body.token || !body.region) throw new Error('azure-speech: invalid token response')
  return { token: body.token, region: body.region }
}

/**
 * Azure recognizer with startup-only browser fallback. Once Azure has begun, a
 * service cancellation stays silent and the timer can still finish normally.
 */
export function createAzureRecognition(
  options: AzureRecognitionOptions,
  fallback: ReadingRecognition,
): ReadingRecognition {
  let recognizer:
    | import('microsoft-cognitiveservices-speech-sdk').SpeechRecognizer
    | null = null
  let startPromise: Promise<void> | null = null
  let fallbackStarted = false
  let stopped = false
  let finalText = ''
  let activeHandlers: RecognitionHandlers | null = null
  const assessedWords: PronunciationAssessment['words'] = []

  const startFallback = (handlers: RecognitionHandlers) => {
    if (stopped || fallbackStarted) return
    fallbackStarted = true
    fallback.start({
      ...handlers,
      onTranscript: (fallbackText, isFinal) => {
        handlers.onTranscript(
          [finalText, fallbackText].filter(Boolean).join(' '),
          isFinal,
        )
      },
    })
  }

  const assessment = (): PronunciationAssessment => ({
    words: [...assessedWords],
  })

  return {
    provider: 'azure',
    supported: () => true,
    start(handlers) {
      activeHandlers = handlers
      stopped = false
      finalText = ''
      assessedWords.length = 0

      startPromise = (async () => {
        const SpeechSDK = await import('microsoft-cognitiveservices-speech-sdk')
        const endpointBase = options.endpointBase ?? AZURE_SPEECH_ENDPOINT_BASE
        let speechConfig: import('microsoft-cognitiveservices-speech-sdk').SpeechConfig

        if (endpointBase) {
          const credentials = await requestAzureSpeechToken(
            endpointBase,
            options.fetchImpl ?? ((url, init) => fetch(url, init as RequestInit)),
          )
          speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
            credentials.token,
            credentials.region,
          )
        } else {
          const key = (options.getKey ?? getAzureSpeechKey)()
          const region = (options.getRegion ?? getAzureSpeechRegion)()
          if (!key || !region) throw new Error('azure-speech: not configured')
          speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region)
        }

        speechConfig.speechRecognitionLanguage = 'en-US'
        speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed

        const microphone = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()
        const nextRecognizer = new SpeechSDK.SpeechRecognizer(speechConfig, microphone)
        recognizer = nextRecognizer

        const pronunciation = new SpeechSDK.PronunciationAssessmentConfig(
          options.referenceText,
          SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
          SpeechSDK.PronunciationAssessmentGranularity.Word,
          true,
        )
        pronunciation.applyTo(nextRecognizer)

        nextRecognizer.recognizing = (_sender, event) => {
          const interim = event.result.text.trim()
          handlers.onTranscript([finalText, interim].filter(Boolean).join(' '), false)
        }

        nextRecognizer.recognized = (_sender, event) => {
          if (event.result.reason !== SpeechSDK.ResultReason.RecognizedSpeech) return
          const text = event.result.text.trim()
          if (text) finalText = [finalText, text].filter(Boolean).join(' ')

          try {
            const result = SpeechSDK.PronunciationAssessmentResult.fromResult(event.result)
            for (const word of result.detailResult.Words ?? []) {
              const detail = word.PronunciationAssessment
              if (!detail) continue
              assessedWords.push({
                word: word.Word,
                accuracyScore: detail.AccuracyScore,
                errorType: detail.ErrorType,
              })
            }
          } catch {
            // A transcript without assessment data remains usable as an estimate.
          }
          handlers.onTranscript(finalText, true)
        }

        nextRecognizer.canceled = () => {
          recognizer = null
          nextRecognizer.close()
          startFallback(handlers)
        }
        nextRecognizer.sessionStopped = () => handlers.onEnd?.()

        await new Promise<void>((resolve, reject) => {
          nextRecognizer.startContinuousRecognitionAsync(resolve, reject)
        })
      })().catch(() => {
        recognizer?.close()
        recognizer = null
        startFallback(handlers)
      })
    },
    async stop() {
      stopped = true
      await startPromise
      if (fallbackStarted) {
        await fallback.stop()
        return
      }
      const current = recognizer
      recognizer = null
      if (!current) return
      await new Promise<void>((resolve) => {
        current.stopContinuousRecognitionAsync(
          () => {
            if (assessedWords.length) activeHandlers?.onAssessment?.(assessment())
            current.close()
            resolve()
          },
          () => {
            current.close()
            resolve()
          },
        )
      })
    },
  }
}
