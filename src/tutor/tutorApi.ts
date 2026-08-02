/** Same-origin client for the policy-owned Academy AI gateway. */

import type { Grade } from '../types'
import { getGatewayAccessToken } from './gatewayAuth'

export const TUTOR_MODEL_SONNET = 'claude-sonnet-4-6'
export const TUTOR_MODEL_HAIKU = 'claude-haiku-4-5'

export type TutorModelChoice = 'sonnet' | 'haiku'
export const DEFAULT_TUTOR_MODEL: TutorModelChoice = 'sonnet'
export function modelIdFor(choice: TutorModelChoice): string {
  return choice === 'haiku' ? TUTOR_MODEL_HAIKU : TUTOR_MODEL_SONNET
}

/** Production always uses the same-origin gateway; there is no browser-provider path. */
export const ANTHROPIC_ENDPOINT_BASE = '/api/anthropic'

// The selected tier is a non-secret preference. The gateway owns provider credentials.
const MODEL_LS = 'homeschool-hq:tutor:model'

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function getTutorModel(): TutorModelChoice {
  return ls()?.getItem(MODEL_LS) === 'haiku' ? 'haiku' : DEFAULT_TUTOR_MODEL
}

export function setTutorModel(choice: TutorModelChoice): void {
  ls()?.setItem(MODEL_LS, choice)
}

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

export type TutorApiFailureReason =
  | 'unauthenticated'
  | 'not_entitled'
  | 'usage_limit'
  | 'gateway_disabled'
  | 'offline'
  | 'error'

export type TutorApiResult =
  | { ok: true; text: string }
  | { ok: false; reason: TutorApiFailureReason }

export interface TutorApiDeps {
  getAccessToken?: () => Promise<string | null>
  fetchImpl: FetchLike
  isOnline: () => boolean
  /** Test seam only; production uses ANTHROPIC_ENDPOINT_BASE. */
  endpointBase?: string
  modelId?: string
}

export interface TutorApiRequest {
  messages: AnthropicMessage[]
  gateway: AcademyGatewayRequest
}

function gatewayText(data: unknown): string {
  const text = (data as { text?: unknown })?.text
  return typeof text === 'string' ? text : ''
}

function gatewayFailure(data: unknown): TutorApiResult {
  const code = (data as { error?: { code?: unknown } })?.error?.code
  if (
    code === 'unauthenticated' ||
    code === 'not_entitled' ||
    code === 'usage_limit' ||
    code === 'gateway_disabled'
  ) {
    return { ok: false, reason: code }
  }
  return { ok: false, reason: 'error' }
}

/** One gateway turn. Failures are typed so child-facing surfaces can degrade safely. */
export async function askTutor(
  deps: TutorApiDeps,
  req: TutorApiRequest,
): Promise<TutorApiResult> {
  const base = deps.endpointBase?.trim() || ANTHROPIC_ENDPOINT_BASE
  if (!deps.isOnline()) return { ok: false, reason: 'offline' }

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
    const data = await response.json()
    if (!response.ok) return gatewayFailure(data)
    const text = gatewayText(data).trim()
    return text ? { ok: true, text } : { ok: false, reason: 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

export function defaultTutorApiDeps(): TutorApiDeps {
  return {
    getAccessToken: getGatewayAccessToken,
    fetchImpl: (url, init) => fetch(url, init as RequestInit),
    isOnline,
    modelId: modelIdFor(getTutorModel()),
  }
}
