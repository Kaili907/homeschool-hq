const CATEGORY_DANGER = 'self-harm-or-immediate-danger'
const CATEGORY_SAFEGUARDING = 'abuse-or-neglect-disclosure'

const CAREGIVER = String.raw`(?:mom|mother|mum|dad|daddy|father|parent|step[- ]?(?:mom|mother|dad|father)|guardian|caregiver|foster[- ]?parent|uncle|aunt|grand(?:ma|mother|pa|father)|babysitter|teacher|coach|counselor|older[- ]?(?:brother|sister|sibling)|adult(?: at home)?)`

const RULES = Object.freeze([
  {
    outcome: 'urgent', category: CATEGORY_DANGER, code: 'safety-urgent-suicide-intent-current-v1',
    patterns: [
      /\bi (?:really )?(?:want|wanna|need|plan|intend) to (?:die|kill myself|hurt myself|harm myself)\b/i,
      /\bi(?:'m| am|m) (?:going|gonna|planning|about) to (?:die|kill myself|hurt myself|harm myself)\b/i,
      /\bi (?:will|shall) (?:die|kill myself|hurt myself|harm myself)\b/i,
      /\bi(?:'m| am|m) suicidal\b/i,
      /\b(?:end|ending) my life\b/i,
      /\bi (?:do not|don't) want to (?:be alive|live|wake up)\b/i,
      /\bi (?:cannot|can't) keep myself safe\b/i,
    ],
  },
  {
    outcome: 'urgent', category: CATEGORY_DANGER, code: 'safety-urgent-self-harm-current-v1',
    patterns: [
      /\bi (?:feel like|am|m) (?:killing|hurting|harming|cutting) myself\b/i,
      /\bi (?:tried|attempted) to (?:die|kill myself|hurt myself|harm myself)\b/i,
      /\bi (?:cut|hurt|harmed) myself (?:today|tonight|just now|recently|yesterday)\b/i,
    ],
  },
  {
    outcome: 'urgent', category: CATEGORY_DANGER, code: 'safety-urgent-overdose-ingestion-v1',
    patterns: [
      /\bi (?:took|swallowed|ate|drank) (?:a )?(?:bunch|lot|lots|handful|too many|all|extra)(?: of)? (?:pills?|tablets?|medicine|medication|chemicals?|cleaner|poison)\b/i,
      /\bi (?:took|swallowed) (?:[1-9]\d{1,2}|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty) (?:pills?|tablets?)\b/i,
      /\bi (?:overdosed|over dosed)\b/i,
    ],
  },
  {
    outcome: 'urgent', category: CATEGORY_DANGER, code: 'safety-urgent-immediate-danger-v1',
    patterns: [
      /\bi(?:'m| am|m) (?:in immediate danger|not safe right now)\b/i,
      /\b(?:someone|they|he|she|an adult) (?:has|have) a (?:gun|knife|weapon) and? ?(?:is )?(?:trying|threatening|going) to hurt me\b/i,
      /\b(?:someone|they|he|she) (?:is|are) (?:coming|waiting) to (?:hurt|kill) me\b/i,
    ],
  },
  {
    outcome: 'urgent', category: CATEGORY_SAFEGUARDING, code: 'safety-urgent-physical-abuse-v1',
    patterns: [
      new RegExp(String.raw`\b(?:my )?${CAREGIVER} (?:hit+s?|hitz|beat+s?|hurt+s?|kick+s?|punch(?:es)?|slap+s?|burn+s?|threatens?|has hit|has beaten|keeps hitting) me\b`, 'i'),
      new RegExp(String.raw`\bi (?:was|am|keep getting) (?:hit|beaten|hurt|kicked|punched|slapped|burned) by (?:my )?${CAREGIVER}\b`, 'i'),
    ],
  },
  {
    outcome: 'urgent', category: CATEGORY_SAFEGUARDING, code: 'safety-urgent-sexual-abuse-v1',
    patterns: [
      new RegExp(String.raw`\b(?:my )?${CAREGIVER} (?:touch(?:es|ed)?|tuch(?:es|ed)?|gropes?|made me touch|forces? me to touch) (?:me|their|his|her)\b`, 'i'),
      /\b(?:someone|an adult) (?:touches|touched|tuches|tuched|gropes|made me touch) (?:me|my|their|his|her) (?:private parts?|body)\b/i,
      /\bi (?:was|am) (?:sexually abused|forced to do sexual things)\b/i,
    ],
  },
  {
    outcome: 'urgent', category: CATEGORY_SAFEGUARDING, code: 'safety-urgent-food-withholding-v1',
    patterns: [
      new RegExp(String.raw`\b(?:my )?${CAREGIVER} (?:does not|doesn't|won't|will not|never) (?:feed me|let me eat|give me food)\b`, 'i'),
      /\b(?:no one|nobody) (?:feeds|gives food to|takes care of) me\b/i,
      /\b(?:food|the refrigerator|the fridge) (?:is|was) locked (?:away from me|away|from me) (?:for|and i have not eaten)\b/i,
      /\bi (?:am not|wasn't|was not) allowed (?:dinner|breakfast|lunch|to eat)\b/i,
    ],
  },
  {
    outcome: 'urgent', category: CATEGORY_SAFEGUARDING, code: 'safety-urgent-neglect-v1',
    patterns: [
      /\bi(?:'m| am|m) (?:being )?(?:abused|neglected|beaten|starved)\b/i,
      /\bi am left alone (?:all night|for days|without food|without medicine)\b/i,
      /\bno adult (?:takes care of|checks on) me\b/i,
    ],
  },
  {
    outcome: 'urgent', category: CATEGORY_SAFEGUARDING, code: 'safety-urgent-fear-returning-home-v1',
    patterns: [
      /\bi(?:'m| am|m) (?:scared|scard|afraid|terrified) (?:to go|of going) home\b/i,
      /\bi(?:'m| am|m) (?:unsafe|not safe) at home\b/i,
    ],
  },
  {
    outcome: 'uncertain', category: CATEGORY_DANGER, code: 'safety-uncertain-self-harm-v1',
    patterns: [
      /\bi (?:sometimes )?wish i (?:were not|wasn't) (?:here|alive)\b/i,
      /\bi (?:sometimes )?feel like (?:disappearing|not waking up)\b/i,
      /\bi (?:might|may|could) (?:hurt|harm|kill) myself\b/i,
      /\bi was (?:just )?joking about (?:dying|suicide|hurting myself|killing myself)\b/i,
    ],
  },
  {
    outcome: 'uncertain', category: CATEGORY_DANGER, code: 'safety-uncertain-third-party-disclosure-v1',
    patterns: [
      /\bmy (?:friend|classmate|sibling|brother|sister) (?:says? (?:"|')?i (?:want to die|might hurt myself)|wants? to die|might hurt (?:themself|themselves|himself|herself))\b/i,
    ],
  },
  {
    outcome: 'uncertain', category: CATEGORY_SAFEGUARDING, code: 'safety-uncertain-abuse-neglect-v1',
    patterns: [
      /\bi (?:do not|don't) (?:feel )?safe at home\b/i,
      /\bi(?:'m| am|m) (?:scared|afraid|uncomfortable) (?:around|with) (?:an adult|someone|my \w+)\b/i,
      /\b(?:an adult|someone|my \w+) (?:makes|made) me (?:feel )?(?:unsafe|uncomfortable|scared)\b/i,
      /\bi (?:sometimes|often) (?:do not|don't) (?:get|have) (?:food|anything to eat)\b/i,
    ],
  },
])

const ATTRIBUTED_CONTEXT = [
  /\b(?:the|a) (?:character|author|narrator|protagonist|passage|book|story|article) (?:says?|said|writes?|wrote|thinks?|thought|asks?|asked|describes?|described)[^.!?]{0,160}\bi\b/i,
  /\b(?:quote|quotation)\s*[:=-]?\s*["']?i\b/i,
]
const CLEAR_CONTEXT = [
  /\bwhat does (?:suicide|self-harm|abuse|neglect) mean\b/i,
  /\b(?:suicide|self-harm|abuse|neglect) prevention\b/i,
  /\b(?:research|history|lesson|class|report|essay|assignment) (?:on|about) (?:suicide|self-harm|abuse|neglect)\b/i,
  /\b(?:story|novel|book) (?:discusses|describes|is about) (?:suicide|self-harm|abuse|neglect)\b/i,
  /\bwhat if (?:a person|someone|a character)\b/i,
]
const IDIOM_TECHNICAL = [
  /\b(?:die|dying) (?:laughing|of laughter|from embarrassment)\b/i,
  /\b(?:homework|assignment|test|game|exercise) is killing me\b/i,
  /\b(?:kill|stop|terminate) (?:the )?(?:process|program|task|server|app|engine)\b/i,
  /\bkill time\b/i,
  /\bdead (?:tired|battery|link|end)\b/i,
  /\bbattery is dead\b/i,
  /\b(?:hits?|touch(?:es)?) (?:the )?(?:baseball|ball|keyboard|screen|paint|wall)\b/i,
]
const EXPLICIT_NEGATION = [
  /\bi (?:do not|don't) want to die\b/i,
  /\bi (?:would never|will not|won't) (?:hurt|kill) myself\b/i,
  /\bno one (?:hit|hurt|touched) me\b/i,
]

export function normalizeTransientText(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4_000) return null
  try {
    const normalized = value
      .normalize('NFKC')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/gu, '')
      .replace(/[\u2018\u2019\u02BC]/gu, "'")
      .replace(/[\u2010-\u2015\u2212]/gu, '-')
      .replace(/(?<=[a-z])(?:[.*_~-]+)(?=[a-z])/giu, '')
      .replace(/\bk\s+i\s+l\s+l\b/giu, 'kill')
      .replace(/\bd\s+i\s+e\b/giu, 'die')
      .replace(/\bh\s+u\s+r\s+t\b/giu, 'hurt')
      .replace(/\bt\s+o\s+u\s+c\s+h\s+e\s+s\b/giu, 'touches')
      .replace(/\bt\s+o\s+u\s+c\s+h\b/giu, 'touch')
      .replace(/\s+/gu, ' ')
      .trim()
      .toLowerCase()
    return normalized.length > 0 && normalized.length <= 4_000 ? normalized : null
  } catch {
    return null
  }
}

function matches(patterns, text) {
  return patterns.some((pattern) => pattern.test(text))
}

export function deterministicSafetyAssessment(normalizedText) {
  if (matches(ATTRIBUTED_CONTEXT, normalizedText) && !/\b(?:but|however|actually|in real life|this is happening to me)\b/i.test(normalizedText)) {
    return { outcome: 'clear', categories: [], ruleIds: ['safety-clear-attributed-quotation-v1'] }
  }

  const matched = RULES.filter((rule) => matches(rule.patterns, normalizedText))
  if (matched.length > 0) {
    const urgent = matched.filter((rule) => rule.outcome === 'urgent')
    const selected = urgent.length > 0 ? urgent : matched
    const categories = [...new Set(selected.map((rule) => rule.category))]
    const ruleIds = [...new Set(selected.map((rule) => rule.code))]
    if (categories.length > 1) ruleIds.push('safety-multiple-categories-v1')
    if (matches(CLEAR_CONTEXT, normalizedText)) ruleIds.push('safety-personal-signal-outranks-context-v1')
    return { outcome: urgent.length > 0 ? 'urgent' : 'uncertain', categories, ruleIds }
  }
  if (matches(EXPLICIT_NEGATION, normalizedText)) {
    return { outcome: 'clear', categories: [], ruleIds: ['safety-clear-explicit-negation-v1'] }
  }
  if (matches(IDIOM_TECHNICAL, normalizedText)) {
    return { outcome: 'clear', categories: [], ruleIds: ['safety-clear-idiom-technical-context-v1'] }
  }
  if (matches(CLEAR_CONTEXT, normalizedText)) {
    return { outcome: 'clear', categories: [], ruleIds: ['safety-clear-academic-context-v1'] }
  }
  if (/ignore (?:all|any|previous) (?:rules|instructions)|reveal (?:the )?(?:system prompt|policy)/i.test(normalizedText)) {
    return { outcome: 'clear', categories: [], ruleIds: ['safety-clear-prompt-injection-only-v1'] }
  }
  return { outcome: 'clear', categories: [], ruleIds: ['safety-clear-no-signal-v1'] }
}
