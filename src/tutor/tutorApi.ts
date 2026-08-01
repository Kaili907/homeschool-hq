/**
 * MT-2 Anthropic client + key store — built to the SAME contract as the MT-V
 * ElevenLabs layer (src/tutor/voice.ts): the key lives in a dedicated localStorage
 * slot OUTSIDE AppState, so `exportAllBackup(state)` can never serialize it. The
 * fetch layer is dependency-injected (FetchLike) so tests run without a real key,
 * and the endpoint base is one swappable value for the future deploy proxy.
 */

import type { Grade } from '../types'
import { getGatewayAccessToken } from './gatewayAuth'
import { PROVIDER_BUILD_POLICY } from './providerBoundary'

// ---------- API constants ----------

// The tutor model — ONE constant per option (same pattern as ELEVENLABS_MODEL_ID).
// Default is SONNET: the child-safety constraints (never give the answer, ≤3
// sentences, grade-level vocabulary, escalate rather than absorb) are the core
// deliverable, and constraint adherence under a persistent kid outranks per-call
// cost at our volume (≤6 exchanges/question, 20 calls/girl/day). Dad can switch to
// Haiku from the Grown-Ups tutor section after reading real transcripts.
export const TUTOR_MODEL_SONNET = 'claude-sonnet-4-6' // stronger constraint-following (default)
export const TUTOR_MODEL_HAIKU = 'claude-haiku-4-5' //   faster + cheaper (Dad opt-in)

export type TutorModelChoice = 'sonnet' | 'haiku'
export const DEFAULT_TUTOR_MODEL: TutorModelChoice = 'sonnet'
export function modelIdFor(choice: TutorModelChoice): string {
  return choice === 'haiku' ? TUTOR_MODEL_HAIKU : TUTOR_MODEL_SONNET
}

export const TUTOR_MAX_TOKENS = 300 // forces brevity
export const ANTHROPIC_VERSION = '2023-06-01'

// '' → call Anthropic directly (acceptable on the family machine; key stays local).
// D1 deploy: with the build-time flag VITE_USE_PROXY=true, this points at the
// serverless proxy (netlify/functions/anthropic via the /api/anthropic redirect),
// which injects the key server-side — the key never ships to the client. Empty
// (local dev / no flag) keeps the direct-with-panel-key path. Only this one value
// changes; the fetch layer below reads it and drops the client key in proxy mode.
export const ANTHROPIC_ENDPOINT_BASE = import.meta.env.PROD || PROVIDER_BUILD_POLICY.gatewayRequired
  ? '/api/anthropic'
  : ''
export const BROWSER_TUTOR_KEYS_ALLOWED = !import.meta.env.PROD && PROVIDER_BUILD_POLICY.browserProviderKeysAllowed

// ---------- local-storage backed key store (NEVER in AppState → never exported) ----------

const KEY_LS = import.meta.env.PROD ? '' : 'homeschool-hq:tutor:key'
const MODEL_LS = 'homeschool-hq:tutor:model'

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function getTutorKey(): string | null {
  if (import.meta.env.PROD || !BROWSER_TUTOR_KEYS_ALLOWED) return null
  return ls()?.getItem(KEY_LS) ?? null
}

export function setTutorKey(k: string): void {
  if (import.meta.env.PROD || !BROWSER_TUTOR_KEYS_ALLOWED) return
  const s = ls()
  if (!s) return
  const t = k.trim()
  if (t) s.setItem(KEY_LS, t)
  else s.removeItem(KEY_LS)
}

export function clearTutorKey(): void {
  if (import.meta.env.PROD || !BROWSER_TUTOR_KEYS_ALLOWED) return
  ls()?.removeItem(KEY_LS)
}

export function hasTutorKey(): boolean {
  return !!getTutorKey()
}

/** Masked display for the Grown-Ups field — the raw key is never rendered. */
export function maskTutorKey(k: string | null): string {
  if (!k) return ''
  if (k.length <= 6) return '••••'
  return `${k.slice(0, 6)}••••••${k.slice(-4)}`
}

/** The chosen tutor model, stored alongside the key (outside AppState). Defaults to Sonnet. */
export function getTutorModel(): TutorModelChoice {
  return ls()?.getItem(MODEL_LS) === 'haiku' ? 'haiku' : DEFAULT_TUTOR_MODEL
}

export function setTutorModel(choice: TutorModelChoice): void {
  ls()?.setItem(MODEL_LS, choice)
}

// ---------- injectable fetch (JSON shape; tests inject a fake) ----------

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TutorGatewayContext {
  grade: Grade
  problem: string
  correctAnswer: string
  studentAnswer: string
  /** TutorChat is mounted only on practice; the server still treats this as untrusted. */
  graded: boolean
}

export interface JarvisGatewayStudentContext {
  grade: '10' | '12'
  today: string
  mission: { label: string; done: boolean }[]
  deadlines: { label: string; due: string; overdue: boolean }[]
  courses: { name: string; done: number; total: number }[]
  geometry: { name: string; attempts: number; accuracy: number | null }[]
  algebra: { name: string; attempts: number; accuracy: number | null }[]
  /** Status-only by construction; no fixed assessment questions or responses. */
  assessments: { title: string; status: string }[]
}

export type AcademyGatewayRequest =
  | { mode: 'tutor'; context: TutorGatewayContext }
  | {
      mode: 'jarvis'
      context: {
        assistant: { name: string; tonePreference: string }
        student: JarvisGatewayStudentContext
        actions: { key: string; label: string }[]
        graded: boolean
      }
    }

export type TutorApiResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'no-key' | 'unauthenticated' | 'offline' | 'error' }

export interface TutorApiDeps {
  getKey: () => string | null
  getAccessToken?: () => Promise<string | null>
  fetchImpl: FetchLike
  isOnline: () => boolean
  endpointBase?: string
  modelId?: string
}

export interface TutorApiRequest {
  /**
   * Used only by direct local-family mode. Proxy mode never serializes this
   * value; the gateway owns its system policy.
   */
  system: string
  messages: AnthropicMessage[]
  /** Required in proxy mode; rebuilt into the gateway's exact allowlisted shape. */
  gateway?: AcademyGatewayRequest
}

/** Extract the first text block from an Anthropic Messages response. */
function firstText(data: unknown): string {
  const content = (data as { content?: unknown })?.content
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
        const t = (block as { text?: unknown }).text
        if (typeof t === 'string') return t
      }
    }
  }
  return ''
}

function gatewayText(data: unknown): string {
  const text = (data as { text?: unknown })?.text
  return typeof text === 'string' ? text : ''
}

/**
 * One tutor turn. Returns a discriminated result so the UI can degrade gracefully:
 * no key / offline / any error → a caller-chosen napping line, never a thrown error.
 */
export async function askTutor(
  deps: TutorApiDeps,
  req: TutorApiRequest,
): Promise<TutorApiResult> {
  const base = deps.endpointBase ?? ANTHROPIC_ENDPOINT_BASE
  const proxyMode = base !== ''
  if (!proxyMode && (import.meta.env.PROD || !PROVIDER_BUILD_POLICY.directProviderRequestsAllowed)) {
    return { ok: false, reason: 'error' }
  }
  const key = deps.getKey()
  // Direct mode needs the family-machine key; proxy mode holds the key server-side.
  if (!proxyMode && !key) return { ok: false, reason: 'no-key' }
  if (!deps.isOnline()) return { ok: false, reason: 'offline' }
  if (proxyMode) {
    if (!req.gateway) return { ok: false, reason: 'error' }
    try {
      const accessToken = await (deps.getAccessToken ?? getGatewayAccessToken)()
      if (!accessToken) return { ok: false, reason: 'unauthenticated' }
      const modelTier: TutorModelChoice = deps.modelId === TUTOR_MODEL_HAIKU ? 'haiku' : 'sonnet'
      const response = await deps.fetchImpl(`${base}/v1/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          mode: req.gateway.mode,
          modelTier,
          context: req.gateway.context,
          messages: req.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      })
      if (!response.ok) return { ok: false, reason: 'error' }
      const text = gatewayText(await response.json()).trim()
      return text ? { ok: true, text } : { ok: false, reason: 'error' }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }
  if (import.meta.env.PROD) return { ok: false, reason: 'error' }
  // Direct local-family mode retains the original own-key provider request.
  const headers: Record<string, string> = {
    'x-api-key': key as string,
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
    // Family-machine pattern only — do NOT ship to a public deploy (use the proxy).
    'anthropic-dangerous-direct-browser-access': 'true',
  }
  try {
    const res = await deps.fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: deps.modelId ?? modelIdFor(DEFAULT_TUTOR_MODEL),
        max_tokens: TUTOR_MAX_TOKENS,
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    })
    if (!res.ok) return { ok: false, reason: 'error' }
    const text = firstText(await res.json()).trim()
    if (!text) return { ok: false, reason: 'error' }
    return { ok: true, text }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

// ---------- app-wide default deps (browser) ----------

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

/** The default deps used by the real chat panel; tests build their own. */
export function defaultTutorApiDeps(): TutorApiDeps {
  return {
    getKey: getTutorKey,
    getAccessToken: getGatewayAccessToken,
    fetchImpl: (url, init) => fetch(url, init as RequestInit),
    isOnline,
    modelId: modelIdFor(getTutorModel()), // Dad's Sonnet/Haiku choice
  }
}
