export type KanaKind = 'basic' | 'dakuten' | 'handakuten'

export interface HiraganaCharacter {
  id: string
  kana: string
  romaji: string
  groupId: string
  kind: KanaKind
}

export interface HiraganaGroup {
  id: string
  label: string
  characters: HiraganaCharacter[]
}

const group = (
  id: string,
  label: string,
  pairs: ReadonlyArray<readonly [string, string]>,
  kind: KanaKind = 'basic',
): HiraganaGroup => ({
  id,
  label,
  characters: pairs.map(([kana, romaji]) => ({ id: `${id}-${romaji}-${kana}`, kana, romaji, groupId: id, kind })),
})

/**
 * Standard gojuon learning order, followed by the full voiced and semi-voiced
 * basic sets. The first eleven groups contain exactly the 46 basic hiragana.
 */
export const HIRAGANA_GROUPS: HiraganaGroup[] = [
  group('vowels', 'Vowels', [['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o']]),
  group('k', 'K row', [['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko']]),
  group('s', 'S row', [['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so']]),
  group('t', 'T row', [['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to']]),
  group('n', 'N row', [['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no']]),
  group('h', 'H row', [['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho']]),
  group('m', 'M row', [['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo']]),
  group('y', 'Y row', [['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo']]),
  group('r', 'R row', [['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro']]),
  group('w', 'W row', [['わ', 'wa'], ['を', 'wo']]),
  group('final-n', 'Final N', [['ん', 'n']]),
  group('g', 'G row (dakuten)', [['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go']], 'dakuten'),
  group('z', 'Z row (dakuten)', [['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo']], 'dakuten'),
  group('d', 'D row (dakuten)', [['だ', 'da'], ['ぢ', 'ji'], ['づ', 'zu'], ['で', 'de'], ['ど', 'do']], 'dakuten'),
  group('b', 'B row (dakuten)', [['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo']], 'dakuten'),
  group('p', 'P row (handakuten)', [['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po']], 'handakuten'),
]

export const BASIC_HIRAGANA = HIRAGANA_GROUPS.slice(0, 11).flatMap((g) => g.characters)
export const MARKED_HIRAGANA = HIRAGANA_GROUPS.slice(11).flatMap((g) => g.characters)
export const ALL_HIRAGANA = HIRAGANA_GROUPS.flatMap((g) => g.characters)

export interface JapaneseVocab {
  id: string
  kana: string
  romaji: string
  meaning: string
  emoji: string
  focusId: string
}

const idForKana = (kana: string): string => {
  const found = ALL_HIRAGANA.find((c) => c.kana === kana)
  if (!found) throw new Error(`Unknown flashcard focus kana: ${kana}`)
  return found.id
}

export const JAPANESE_VOCAB: JapaneseVocab[] = [
  { id: 'ai', kana: 'あい', romaji: 'ai', meaning: 'love', emoji: '❤️', focusId: idForKana('あ') },
  { id: 'ie', kana: 'いえ', romaji: 'ie', meaning: 'house', emoji: '🏠', focusId: idForKana('い') },
  { id: 'ue', kana: 'うえ', romaji: 'ue', meaning: 'above', emoji: '⬆️', focusId: idForKana('う') },
  { id: 'ao', kana: 'あお', romaji: 'ao', meaning: 'blue', emoji: '🔵', focusId: idForKana('お') },
  { id: 'kasa', kana: 'かさ', romaji: 'kasa', meaning: 'umbrella', emoji: '☂️', focusId: idForKana('か') },
  { id: 'sushi', kana: 'すし', romaji: 'sushi', meaning: 'sushi', emoji: '🍣', focusId: idForKana('す') },
  { id: 'neko', kana: 'ねこ', romaji: 'neko', meaning: 'cat', emoji: '🐈', focusId: idForKana('ね') },
  { id: 'inu', kana: 'いぬ', romaji: 'inu', meaning: 'dog', emoji: '🐕', focusId: idForKana('ぬ') },
  { id: 'hana', kana: 'はな', romaji: 'hana', meaning: 'flower', emoji: '🌸', focusId: idForKana('は') },
  { id: 'yama', kana: 'やま', romaji: 'yama', meaning: 'mountain', emoji: '⛰️', focusId: idForKana('や') },
  { id: 'sora', kana: 'そら', romaji: 'sora', meaning: 'sky', emoji: '☁️', focusId: idForKana('ら') },
  { id: 'mizu', kana: 'みず', romaji: 'mizu', meaning: 'water', emoji: '💧', focusId: idForKana('ず') },
  { id: 'gohan', kana: 'ごはん', romaji: 'gohan', meaning: 'rice / meal', emoji: '🍚', focusId: idForKana('ご') },
  { id: 'pan', kana: 'ぱん', romaji: 'pan', meaning: 'bread', emoji: '🍞', focusId: idForKana('ぱ') },
]
