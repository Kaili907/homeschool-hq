import type { Profile, TutorChat, TutorMessage } from '../../types'
import { recentChats, callsOnDay, callsInMonth, dailyCap } from '../../tutor/tutorChat'

/**
 * Grown-Ups "Tutor chats" — read-only transcripts + usage meter for the MT-2
 * conversational tutor. Dad-facing, plain slate/white palette (no kid themes).
 * Renders only; no writes, no mutating callbacks.
 */
export function TutorChatsView({ profile, today }: { profile: Profile; today: string }) {
  const chats = recentChats(profile)
  const usedToday = callsOnDay(profile, today)
  const cap = dailyCap(profile)
  const usedMonth = callsInMonth(profile, today)
  const capReached = usedToday >= cap

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-slate-800">Tutor chats</h2>
          {capReached && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              daily cap reached
            </span>
          )}
        </div>
        <p className="text-sm text-slate-700">
          Tutor calls — today: {usedToday}/{cap} · this month: {usedMonth}
        </p>
        <p className="text-xs text-slate-500">Chats auto-prune after 60 days.</p>
      </header>

      {chats.length === 0 ? (
        <p className="text-sm text-slate-500">No tutor chats yet.</p>
      ) : (
        <ul className="space-y-3">
          {chats.map((chat) => (
            <li key={chat.id}>
              <ChatCard chat={chat} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ChatCard({ chat }: { chat: TutorChat }) {
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-3" open>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-semibold text-slate-800">{chat.problem}</p>
          <div className="flex shrink-0 items-center gap-2">
            <OutcomeBadge outcome={chat.outcome} />
            <span className="text-xs font-medium text-slate-500">{chat.day}</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          her answer: {chat.herAnswer} · correct: {chat.correctAnswer}
        </p>
      </summary>

      {chat.messages.length > 0 && (
        <ol className="mt-3 space-y-2">
          {chat.messages.map((msg, i) => (
            <li key={`${chat.id}-${i}`} className={msg.role === 'kid' ? 'flex justify-end' : 'flex justify-start'}>
              <MessageBubble msg={msg} />
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}

function OutcomeBadge({ outcome }: { outcome?: TutorChat['outcome'] }) {
  if (outcome === 'flagged') {
    return (
      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
        flagged for Dad
      </span>
    )
  }
  if (outcome === 'closed') {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">closed</span>
    )
  }
  return null
}

function MessageBubble({ msg }: { msg: TutorMessage }) {
  const isKid = msg.role === 'kid'
  const bubble = isKid
    ? 'bg-slate-800 text-white'
    : 'bg-slate-100 text-slate-700'
  return (
    <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${bubble}`}>
      {!isKid && msg.source === 'scripted' && (
        <span className="mr-1.5 rounded bg-slate-200 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          auto
        </span>
      )}
      <span>{msg.text}</span>
    </div>
  )
}
