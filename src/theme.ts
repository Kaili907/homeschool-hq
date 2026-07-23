import { createContext, useContext } from 'react'
import type { ThemeId } from './types'

export type CheerLevel = 'full' | 'brief' | 'minimal'

export interface ThemeTokens {
  id: ThemeId
  /** css font-family value applied to the themed root */
  font: string
  /** css background value applied to the themed root */
  appBg: string
  heading: string
  sub: string
  card: string
  statPill: string
  primaryBtn: string
  secondaryBtn: string
  choiceIdle: string
  choiceCorrect: string
  choiceWrong: string
  choiceDisabled: string
  progressTrack: string
  progressFill: string
  chipMastered: string
  chipDeveloping: string
  chipNotStarted: string
  barMastered: string
  barDeveloping: string
  barNotStarted: string
  confetti: boolean
  cheers: CheerLevel
  /** big decorative emoji (skill icons, headers) */
  bigEmoji: boolean
}

const KID_FONT = '"Comic Sans MS", "Comic Neue", "Segoe UI", system-ui, sans-serif'
const COOL_FONT = '"Segoe UI", "Trebuchet MS", system-ui, sans-serif'
const CLEAN_FONT = 'ui-sans-serif, system-ui, "Segoe UI", Helvetica, Arial, sans-serif'

export const THEMES: Record<ThemeId, ThemeTokens> = {
  playful: {
    id: 'playful',
    font: KID_FONT,
    appBg: 'linear-gradient(160deg, #ede9fe 0%, #e0f2fe 45%, #fef9c3 100%)',
    heading: 'text-violet-900',
    sub: 'text-violet-600',
    card: 'rounded-3xl bg-white shadow-xl',
    statPill: 'rounded-full bg-white/80 shadow',
    primaryBtn:
      'rounded-3xl border-b-8 border-emerald-700 bg-emerald-500 font-extrabold text-white shadow-xl active:translate-y-1 active:border-b-4',
    secondaryBtn:
      'rounded-3xl border-b-8 border-violet-300 bg-white font-extrabold text-violet-800 shadow-xl active:translate-y-1 active:border-b-4',
    choiceIdle:
      'rounded-3xl border-b-8 border-violet-300 bg-white text-violet-900 shadow-lg hover:bg-violet-50 active:translate-y-1 active:border-b-4',
    choiceCorrect: 'rounded-3xl border-b-8 border-green-600 bg-green-400 text-white shadow-lg',
    choiceWrong: 'rounded-3xl border-b-8 border-rose-600 bg-rose-400 text-white shadow-lg',
    choiceDisabled: 'rounded-3xl border-b-8 border-slate-200 bg-slate-100 text-slate-400 shadow-lg',
    progressTrack: 'bg-white/70 shadow-inner',
    progressFill: 'bg-gradient-to-r from-violet-500 to-fuchsia-500',
    chipMastered: 'bg-green-500 text-white',
    chipDeveloping: 'bg-amber-400 text-amber-950',
    chipNotStarted: 'bg-slate-200 text-slate-500',
    barMastered: 'bg-green-500',
    barDeveloping: 'bg-amber-400',
    barNotStarted: 'bg-slate-300',
    confetti: true,
    cheers: 'full',
    bigEmoji: true,
  },
  cool: {
    id: 'cool',
    font: COOL_FONT,
    appBg: 'linear-gradient(160deg, #ecfeff 0%, #eef2ff 60%, #f0fdfa 100%)',
    heading: 'text-slate-800',
    sub: 'text-cyan-700',
    card: 'rounded-2xl bg-white shadow-lg',
    statPill: 'rounded-full bg-white/90 shadow',
    primaryBtn:
      'rounded-2xl bg-cyan-600 font-bold text-white shadow-lg hover:bg-cyan-700 active:scale-[0.99]',
    secondaryBtn:
      'rounded-2xl border-2 border-slate-200 bg-white font-bold text-slate-700 shadow hover:bg-slate-50',
    choiceIdle:
      'rounded-2xl border-2 border-slate-200 bg-white text-slate-800 shadow hover:border-cyan-400 hover:bg-cyan-50',
    choiceCorrect: 'rounded-2xl border-2 border-emerald-500 bg-emerald-500 text-white shadow',
    choiceWrong: 'rounded-2xl border-2 border-rose-400 bg-rose-400 text-white shadow',
    choiceDisabled: 'rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-400',
    progressTrack: 'bg-slate-200',
    progressFill: 'bg-cyan-500',
    chipMastered: 'bg-emerald-500 text-white',
    chipDeveloping: 'bg-cyan-100 text-cyan-800',
    chipNotStarted: 'bg-slate-100 text-slate-500',
    barMastered: 'bg-emerald-500',
    barDeveloping: 'bg-cyan-400',
    barNotStarted: 'bg-slate-300',
    confetti: true,
    cheers: 'brief',
    bigEmoji: false,
  },
  clean: {
    id: 'clean',
    font: CLEAN_FONT,
    appBg: '#f8fafc',
    heading: 'text-slate-900',
    sub: 'text-slate-500',
    card: 'rounded-xl border border-slate-200 bg-white shadow-sm',
    statPill: 'rounded-md border border-slate-200 bg-white',
    primaryBtn: 'rounded-lg bg-slate-900 font-semibold text-white hover:bg-slate-700',
    secondaryBtn:
      'rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50',
    choiceIdle:
      'rounded-lg border border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-50',
    choiceCorrect: 'rounded-lg border border-emerald-600 bg-emerald-600 text-white',
    choiceWrong: 'rounded-lg border border-rose-500 bg-rose-500 text-white',
    choiceDisabled: 'rounded-lg border border-slate-200 bg-slate-50 text-slate-400',
    progressTrack: 'bg-slate-200',
    progressFill: 'bg-slate-700',
    chipMastered: 'bg-emerald-600 text-white',
    chipDeveloping: 'bg-slate-200 text-slate-700',
    chipNotStarted: 'bg-slate-100 text-slate-400',
    barMastered: 'bg-emerald-600',
    barDeveloping: 'bg-slate-500',
    barNotStarted: 'bg-slate-300',
    confetti: false,
    cheers: 'minimal',
    bigEmoji: false,
  },
}

export const ThemeContext = createContext<ThemeTokens>(THEMES.playful)
export const useTheme = () => useContext(ThemeContext)
