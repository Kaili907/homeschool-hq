/**
 * Typing lesson ladder — original, neutral drill content generated for this
 * app. Nothing here is copied from any assessment, curriculum, book, song,
 * or other copyrighted source; it is plain, wholesome, generic material
 * written to be safe and friendly for kids in grades 3-6.
 *
 * The ladder introduces keys in the standard home-row-first order (left
 * home row, right home row, combined home row), then the top row, then the
 * bottom row, then shift/capitals and punctuation, then builds up to short
 * words (using only keys already taught) and finally short sentences. Every
 * 'keys' lesson bank sticks strictly to letters taught by that point in the
 * ladder; the full alphabet is complete by the end of the bottom-row block,
 * so the word and sentence lessons after that are unrestricted.
 */

export type LessonKind = 'keys' | 'words' | 'sentences'

export interface Lesson {
  id: string // stable kebab id, unique, e.g. 'l01-home-asdf'
  title: string // kid-facing, e.g. "Home row: a s d f"
  kind: LessonKind
  focusKeys: string[] // lowercase keys this lesson introduces, e.g. ['a','s','d','f']
  hint: string // one short kid-friendly finger-placement hint
  bank: string[] // neutral drill tokens
}

export const LESSONS: Lesson[] = [
  // --- 1. Home row basics --------------------------------------------------
  {
    id: 'l01-home-asdf',
    title: 'Home row: a s d f',
    kind: 'keys',
    focusKeys: ['a', 's', 'd', 'f'],
    hint: 'Rest your left pinky, ring, middle, and pointer on a s d f.',
    bank: ['asdf', 'fdsa', 'asf', 'dfa', 'sad', 'fad', 'dad', 'fads', 'add', 'sass'],
  },
  {
    id: 'l02-home-jkl-semi',
    title: 'Home row: j k l ;',
    kind: 'keys',
    focusKeys: ['j', 'k', 'l', ';'],
    hint: 'Rest your right pointer, middle, ring, and pinky on j k l ;.',
    bank: ['jkl;', ';lkj', 'jkl', 'lkj', 'jj', 'kk', 'll', ';;', 'all', 'fall'],
  },
  {
    id: 'l03-home-combo',
    title: 'Home row together',
    kind: 'keys',
    focusKeys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'],
    hint: 'Both thumbs rest on the space bar between the two home-row halves.',
    bank: ['asdf jkl;', 'flask', 'salad', 'a salad', 'ask', 'fall', 'lads', 'flask salad', 'jak', 'all'],
  },
  {
    id: 'l04-home-g-h',
    title: 'Home row: g h',
    kind: 'keys',
    focusKeys: ['g', 'h'],
    hint: 'g and h sit right in the middle, one for each pointer finger.',
    bank: ['gh', 'hg', 'hash', 'flash', 'half', 'gal', 'hall', 'glad', 'dash', 'flag'],
  },

  // --- 2. Top row ------------------------------------------------------------
  {
    id: 'l05-top-e-i',
    title: 'Top row: e i',
    kind: 'keys',
    focusKeys: ['e', 'i'],
    hint: 'Reach up with your middle fingers to tap e and i.',
    bank: ['ei', 'ie', 'side', 'life', 'like', 'hide', 'kids', 'aside', 'glide', 'ideal'],
  },
  {
    id: 'l06-top-r-u',
    title: 'Top row: r u',
    kind: 'keys',
    focusKeys: ['r', 'u'],
    hint: 'Reach up with your pointer fingers to tap r and u.',
    bank: ['ru', 'ur', 'ride', 'fur', 'rug', 'sure', 'guide', 'rise', 'user', 'girl'],
  },
  {
    id: 'l07-top-t-y',
    title: 'Top row: t y',
    kind: 'keys',
    focusKeys: ['t', 'y'],
    hint: 'Reach up with your pointer fingers to tap t and y.',
    bank: ['ty', 'yt', 'try', 'tidy', 'style', 'dirty', 'tasty', 'trust', 'yeti', 'dusty'],
  },
  {
    id: 'l08-top-w-o',
    title: 'Top row: w o',
    kind: 'keys',
    focusKeys: ['w', 'o'],
    hint: 'Reach up with your ring fingers to tap w and o.',
    bank: ['wo', 'ow', 'wow', 'grow', 'word', 'wood', 'slow', 'glow', 'gold', 'story'],
  },
  {
    id: 'l09-top-q-p',
    title: 'Top row: q p',
    kind: 'keys',
    focusKeys: ['q', 'p'],
    hint: 'Reach up with your pinky fingers to tap q and p.',
    bank: ['qp', 'pq', 'quiet', 'equip', 'quirky', 'quilt', 'quit', 'happy', 'party', 'pride'],
  },

  // --- 3. Bottom row ----------------------------------------------------------
  {
    id: 'l10-bottom-v-m',
    title: 'Bottom row: v m',
    kind: 'keys',
    focusKeys: ['v', 'm'],
    hint: 'Reach down with your pointer fingers to tap v and m.',
    bank: ['vm', 'mv', 'move', 'give', 'must', 'very', 'game', 'mile', 'time', 'video'],
  },
  {
    id: 'l11-bottom-b-n',
    title: 'Bottom row: b n',
    kind: 'keys',
    focusKeys: ['b', 'n'],
    hint: 'Reach down with your pointer fingers to tap b and n.',
    bank: ['bn', 'nb', 'ban', 'nap', 'nine', 'bird', 'brand', 'grin', 'begin', 'brown'],
  },
  {
    id: 'l12-bottom-c-comma',
    title: 'Bottom row: c ,',
    kind: 'keys',
    focusKeys: ['c', ','],
    hint: 'Reach down with your middle fingers to tap c and comma.',
    bank: ['c,', ',c', 'cats,', 'race,', 'nice,', 'cut', 'dice', 'cake', 'city', 'circle'],
  },
  {
    id: 'l13-bottom-x-period',
    title: 'Bottom row: x .',
    kind: 'keys',
    focusKeys: ['x', '.'],
    hint: 'Reach down with your ring fingers to tap x and period.',
    bank: ['x.', '.x', 'fox.', 'wax.', 'mix.', 'exit', 'taxi', 'sixty', 'next', 'exam'],
  },
  {
    id: 'l14-bottom-z-slash',
    title: 'Bottom row: z /',
    kind: 'keys',
    focusKeys: ['z', '/'],
    hint: 'Reach down with your pinky fingers to tap z and slash.',
    bank: ['z/', '/z', 'zig', 'zoo', 'lazy', 'buzz', 'size', 'zip', 'zebra', 'amaze'],
  },

  // --- 4. Shift, capitals, and basic punctuation -------------------------------
  {
    id: 'l15-shift-caps',
    title: 'Shift and capitals',
    kind: 'keys',
    focusKeys: ['a', 's', 'j', 'k', 'm'],
    hint: 'Hold shift with your pinky, then tap the letter with your other hand.',
    bank: ['Sam', 'Jack', 'Kai', 'Ada', 'Dora', 'Milo', 'Story', 'Uri', 'Wyatt', 'Grace'],
  },
  {
    id: 'l16-shift-punct',
    title: 'Punctuation: . , ? !',
    kind: 'keys',
    focusKeys: ['.', ',', '?', '!'],
    hint: 'Hold shift for ? and !; commas and periods need no shift.',
    bank: [
      'Hi!',
      'Wow!',
      'Okay.',
      'Really?',
      'Yes, sir.',
      'No way!',
      'Sure, why not?',
      'Great job!',
      'Is it true?',
      'Wait, what?',
    ],
  },

  // --- 5. Common short words ----------------------------------------------------
  {
    id: 'l17-words-short',
    title: 'Short words',
    kind: 'words',
    focusKeys: [],
    hint: 'Keep your fingers on the home row and reach out for each letter.',
    bank: [
      'add',
      'sad',
      'fall',
      'ask',
      'gas',
      'half',
      'salad',
      'flask',
      'glass',
      'dash',
      'dad',
      'flag',
      'nap',
      'bird',
      'grin',
    ],
  },
  {
    id: 'l18-words-medium',
    title: 'Building words',
    kind: 'words',
    focusKeys: [],
    hint: 'Slow down and let each finger find its own key.',
    bank: [
      'ride',
      'kite',
      'side',
      'tidy',
      'story',
      'quirky',
      'happy',
      'quiet',
      'word',
      'grow',
      'sure',
      'party',
      'today',
      'yard',
      'brave',
      'brand',
      'circle',
    ],
  },
  {
    id: 'l19-words-longer',
    title: 'Trickier words',
    kind: 'words',
    focusKeys: [],
    hint: 'Try to keep a steady rhythm instead of rushing.',
    bank: [
      'jumps',
      'happy',
      'garden',
      'friendly',
      'sunshine',
      'giggle',
      'wiggle',
      'wonder',
      'sparkle',
      'muddy',
      'puddle',
      'cozy',
      'breezy',
      'daydream',
      'moonlit',
      'zesty',
    ],
  },

  // --- 6. Short sentences --------------------------------------------------------
  {
    id: 'l20-sentences-short',
    title: 'Short sentences',
    kind: 'sentences',
    focusKeys: [],
    hint: 'Type each sentence smoothly, ending with the right punctuation.',
    bank: [
      'The cat is fast.',
      'I like my dog.',
      'She likes to jump.',
      'We had a fun day.',
      'Is it sunny today?',
      'The garden is quiet.',
      'He can ride a bike.',
      'Wow, that was fast!',
      'The kids play tag.',
      'My friend is happy.',
    ],
  },
  {
    id: 'l21-sentences-longer',
    title: 'Longer sentences',
    kind: 'sentences',
    focusKeys: [],
    hint: 'Keep your eyes on the words, not your hands.',
    bank: [
      'The happy puppy jumps in the garden.',
      'We rode our bikes to the park today.',
      'Did you see the bright morning sunshine?',
      'My best friend likes to tell funny stories.',
      'The quiet cat curled up on the rug.',
      'We packed a picnic and went outside.',
      'Is your sister coming to the party?',
      'The kids giggled at the silly joke.',
      'A gentle breeze moved through the trees.',
      'Grandma baked cookies for the whole family.',
    ],
  },
  {
    id: 'l22-sentences-mixed',
    title: 'Mixed practice',
    kind: 'sentences',
    focusKeys: [],
    hint: 'You know every key now, so just relax and type.',
    bank: [
      'What a wonderful day for a walk!',
      'The team worked hard and won the game.',
      'She quietly read her favorite book.',
      'Our class is going on a field trip.',
      'The stars sparkle above the quiet lake.',
      'He carefully drew a picture of a dragon.',
      'Please close the door before it gets cold.',
      'The market sells fresh fruit every Saturday.',
      'They laughed together during the whole movie.',
      'Can you help me carry these boxes?',
    ],
  },
]
