import { HANZI_VARIANTS, PALI_ENDINGS } from '~/constants/lookup'

export type LookupEntry = {
  d: string | string[]
  g?: string
  x?: string | string[]
  p?: string
}

/** A dictionary that may need fetching before it can answer */
export type Dict<T> = { get(key: string): Promise<T | undefined> }

export type PaliMatch = {
  base: string
  entry?: LookupEntry
  meaning?: string
  leftover?: string
}

export function normalizeHanzi(text: string): string {
  return [...text].map(ch => HANZI_VARIANTS[ch] ?? ch).join('')
}

/** Base cleaning shared by both DPD and compound decomposition paths */
function cleanPaliWord(word: string): string {
  word = word.replace(
    /(~|`|!|@|#|\$|%|\^|&|\*|\(|\)|{|}|\[|\]|;|:|\"|'|<|,|\.|>|\?|\/|\\|\||-|_|\+|=|\u201C|\u201D|\u2018|\u2019|\u2014)/g,
    ''
  )
  word = word.toLowerCase().trim()
  word = word.replace(/\u00AD/g, '').replace(/\u2027/g, '') // optional hyphen, syllable-breaker
  word = word.replace(/ṁg/g, 'ṅg').replace(/ṁk/g, 'ṅk')
  return word
}

/**
 * DPD data uses ṃ (dot below); the endings table uses ṁ (dot above).
 * Only normalize for DPD lookups, not for compound decomposition.
 */
function normalizeDpdWord(word: string): string {
  return word.replace(/[''""]/g, '').replace(/ṁ/g, 'ṃ')
}

async function exactMatch(
  word: string,
  dict: Dict<LookupEntry>
): Promise<PaliMatch | null> {
  const entry = await dict.get(word)
  return entry ? { base: word, entry } : null
}

async function fuzzyMatch(
  word: string,
  dict: Dict<LookupEntry>
): Promise<PaliMatch | null> {
  for (const [ending, keepChars, minLen, replacement] of PALI_ENDINGS) {
    if (
      word.length > minLen &&
      word.substring(word.length - ending.length) === ending
    ) {
      const stem =
        word.substring(0, word.length - ending.length + keepChars) + replacement
      const entry = await dict.get(stem)
      if (entry) return { base: stem, entry }
    }
  }
  return null
}

async function matchComplete(
  word: string,
  dict: Dict<LookupEntry>,
  isTi: boolean
): Promise<PaliMatch[] | null> {
  const matches: PaliMatch[] = []
  // Try pi/vy/ti variants — handles Pali orthographic variations
  for (let pi = 0; pi < 2; pi++)
    for (let vy = 0; vy < 2; vy++)
      for (let ti = 0; ti < 2; ti++) {
        let w = word
        if (ti && isTi) {
          w = w
            .replace(/ī$/, 'i')
            .replace(/ā$/, 'i')
            .replace(/ū$/, 'i')
            .replace(/n$/, '')
            .replace(/n$/, 'ṁ')
        }
        if (pi) {
          if (!w.endsWith('pi')) continue
          w = w.replace(/pi$/, '')
        }
        if (vy) {
          if (w.includes('vy')) w = w.replace(/vy/g, 'by')
          else if (w.includes('by')) w = w.replace(/by/g, 'vy')
          else continue
        }
        const match = (await exactMatch(w, dict)) || (await fuzzyMatch(w, dict))
        if (match) {
          matches.push(match)
          if (pi) matches.push({ base: 'pi', meaning: 'too' })
          return matches
        }
      }
  return null
}

async function matchPartial(
  word: string,
  dict: Dict<LookupEntry>,
  maxLength = 4
): Promise<(PaliMatch & { leftover: string }) | null> {
  for (let vy = 0; vy < 2; vy++) {
    let w = word
    if (vy) {
      if (w.includes('vy')) w = w.replace(/vy/g, 'by')
      else if (w.includes('by')) w = w.replace(/by/g, 'vy')
      else continue
    }
    // Try progressively shorter prefixes (longest match first)
    for (let i = 0; i < w.length; i++) {
      const part = w.substring(0, w.length - i)
      if (part.length < maxLength) break
      const entry = await dict.get(part)
      if (entry) {
        return {
          base: part,
          entry,
          leftover: w.substring(w.length - i),
        }
      }
    }
  }
  return null
}

/** DPD lookup — tries inflection-to-headword mapping first, then deconstructor */
async function lookupDpd(
  word: string,
  dict: Dict<LookupEntry>,
  dpdI2h: Dict<string[]>,
  dpdDecon: Dict<string>
): Promise<PaliMatch[]> {
  const allMatches: PaliMatch[] = []
  const headwords: string[] = []

  const inflections = await dpdI2h.get(word)
  if (inflections) {
    // Extract unique root headwords (entries like "ta 1.1" → root "ta")
    for (const entry of inflections) {
      const root = entry.split(' ')[0]
      if (!headwords.includes(root)) headwords.push(root)
    }
  }

  const deconstruction = await dpdDecon.get(word)
  if (deconstruction !== undefined) {
    const firstComponent = deconstruction.split('+')[0].trim()
    if (!headwords.includes(firstComponent)) headwords.push(firstComponent)
    allMatches.push({ base: word, meaning: deconstruction })
  }

  for (const hw of headwords) {
    // DPD uses ṃ (dot below), SC dicts use ṁ (dot above) — same thing
    const hwNorm = hw.replace(/ṃ/g, 'ṁ')
    const entry = await dict.get(hwNorm)
    if (entry) {
      allMatches.push({ base: hwNorm, entry })
    }
  }

  return allMatches
}

/** Compound decomposition with sandhi resolution (fallback when DPD has no entry) */
async function lookupCompound(
  word: string,
  dict: Dict<LookupEntry>
): Promise<PaliMatch[]> {
  let allMatches: PaliMatch[] = []
  let isTi = false
  let w = word

  if (/[''\u2018\u2019]ti$/.test(w)) {
    isTi = true
    w = w.replace(/[''\u2018\u2019]ti$/, '')
  }
  w = w.replace(/[''""]/g, '')

  let unword: string | null = null

  let matchResult: PaliMatch[] | (PaliMatch & { leftover: string }) | null =
    await matchComplete(w, dict, isTi)

  if (
    !matchResult ||
    (Array.isArray(matchResult) && matchResult.length === 0)
  ) {
    // Try stripping negation prefix (an-/a- before doubled consonant)
    if (/^an|^a(.)\1/.test(w)) {
      unword = w.substring(2)
    } else if (/^a/.test(w)) {
      unword = w.substring(1)
    }
    if (unword) {
      matchResult = await matchComplete(unword, dict, isTi)
      if (matchResult && Array.isArray(matchResult) && matchResult.length > 0) {
        allMatches.push({ base: 'an', meaning: 'non/not' })
      }
    }
  }
  if (matchResult && Array.isArray(matchResult) && matchResult.length > 0) {
    allMatches = allMatches.concat(matchResult)
  }

  if (allMatches.length === 0) {
    // No complete match — try compound decomposition via longest prefix
    matchResult = await matchPartial(w, dict)
    if (unword) {
      const matchPartialResult = await matchPartial(unword, dict)
      if (
        (matchPartialResult && !matchResult) ||
        (matchPartialResult &&
          matchResult &&
          matchPartialResult.base.length >
            (matchResult as PaliMatch).base.length)
      ) {
        matchResult = matchPartialResult
        allMatches.push({ base: 'an', meaning: 'non/not' })
      }
    }

    let foundComplete = false
    while (matchResult && !foundComplete) {
      if (Array.isArray(matchResult) && matchResult.length === 1) {
        matchResult = matchResult[0] as PaliMatch & { leftover: string }
      }
      const current = Array.isArray(matchResult) ? matchResult[0] : matchResult
      if (Array.isArray(matchResult)) {
        allMatches = allMatches.concat(matchResult)
      } else {
        allMatches.push(current)
      }

      let leftover = (current as PaliMatch & { leftover?: string }).leftover
      let firstChar = ''
      const sandhi = current.base[current.base.length - 1]

      if (leftover) {
        firstChar = leftover[0]
        leftover = leftover.substring(1)
      } else {
        break
      }

      // Try sandhi resolutions — vowels that may have been elided at the join point
      const starts = [firstChar, '', sandhi + firstChar]
      let vowels = ['a', 'ā', 'i', 'ī', 'u', 'ū', 'o', 'e']
      // Sandhi doesn't lengthen short vowels
      if (sandhi === 'a' || sandhi === 'i' || sandhi === 'u') {
        vowels = ['a', 'i', 'u']
      }
      for (const v of vowels) {
        starts.push(v + firstChar)
      }

      let found = false
      for (const start of starts) {
        const completeResult = await matchComplete(start + leftover, dict, isTi)
        if (completeResult && completeResult.length > 0) {
          allMatches = allMatches.concat(completeResult)
          foundComplete = true
          found = true
          break
        }
        const partialResult = await matchPartial(start + leftover, dict)
        if (partialResult) {
          matchResult = partialResult
          found = true
          break
        }
      }

      if (!found) {
        const remainder = firstChar + leftover
        if (remainder !== 'ṁ') {
          allMatches.push({ base: remainder, meaning: '?' })
        }
        break
      }
    }
  }

  if (isTi && allMatches.length > 0) {
    allMatches.push({ base: 'iti', meaning: 'endquote' })
  }

  return allMatches
}

/**
 * The forms of a word that `lookupPali` starts its probing from, so the shards
 * they need can be fetched up front: as written (with ṁ) for the dictionary,
 * also without a negating a-/an- and with vy and by swapped, and as DPD spells
 * it (with ṃ) for the DPD tables
 */
export function paliLookupKeys(rawWord: string): {
  dict: string[]
  dpd: string[]
} {
  const word = cleanPaliWord(rawWord)
  if (!word) return { dict: [], dpd: [] }

  const dict = [word]
  if (word.startsWith('a')) dict.push(word.substring(1), word.substring(2))
  if (word.includes('vy')) dict.push(word.replace(/vy/g, 'by'))
  else if (word.includes('by')) dict.push(word.replace(/by/g, 'vy'))

  return { dict, dpd: [normalizeDpdWord(word)] }
}

export async function lookupPali(
  rawWord: string,
  dict: Dict<LookupEntry>,
  dpdI2h: Dict<string[]> | null,
  dpdDecon: Dict<string> | null
): Promise<PaliMatch[]> {
  const cleaned = cleanPaliWord(rawWord)
  if (!cleaned) return []

  // Try DPD first (uses ṃ normalization — DPD data uses dot-below)
  if (dpdI2h && dpdDecon) {
    const dpdWord = normalizeDpdWord(cleaned)
    const dpdMatches = await lookupDpd(dpdWord, dict, dpdI2h, dpdDecon)
    if (dpdMatches.length > 0) return dpdMatches
  }

  // Fall back to compound decomposition (keeps ṁ — endings table uses dot-above)
  return lookupCompound(cleaned, dict)
}

/**
 * Chinese: every dictionary entry that appears as a substring of the text,
 * after normalizing character variants. Longest first, as the longer terms
 * are the more specific
 */
export async function lookupLzh(
  rawText: string,
  dict: Dict<LookupEntry>
): Promise<Array<{ term: string; entry: LookupEntry }>> {
  const text = normalizeHanzi(rawText)
  const found = new Map<string, LookupEntry>()

  for (let i = 0; i < text.length; i++) {
    for (let len = 1; len <= Math.min(20, text.length - i); len++) {
      const term = text.substring(i, i + len)
      if (found.has(term)) continue
      const entry = await dict.get(term)
      if (entry) found.set(term, entry)
    }
  }

  return [...found]
    .map(([term, entry]) => ({ term, entry }))
    .sort((a, b) => b.term.length - a.term.length)
}

/** Strip internal fields (leftover) before sending response */
export function serializeMatch(m: PaliMatch): {
  base: string
  entry?: LookupEntry
  meaning?: string
} {
  if (m.entry) return { base: m.base, entry: m.entry }
  return { base: m.base, meaning: m.meaning ?? '?' }
}
