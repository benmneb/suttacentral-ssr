import { HANZI_VARIANTS, PALI_ENDINGS } from '~/constants/lookup'

export type LookupEntry = {
  d: string | string[]
  g?: string
  x?: string | string[]
  p?: string
}

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

function exactMatch(
  word: string,
  dict: Record<string, LookupEntry>
): PaliMatch | null {
  if (dict[word]) return { base: word, entry: dict[word] }
  return null
}

function fuzzyMatch(
  word: string,
  dict: Record<string, LookupEntry>
): PaliMatch | null {
  for (const [ending, keepChars, minLen, replacement] of PALI_ENDINGS) {
    if (
      word.length > minLen &&
      word.substring(word.length - ending.length) === ending
    ) {
      const stem =
        word.substring(0, word.length - ending.length + keepChars) + replacement
      if (dict[stem]) return { base: stem, entry: dict[stem] }
    }
  }
  return null
}

function matchComplete(
  word: string,
  dict: Record<string, LookupEntry>,
  isTi: boolean
): PaliMatch[] | null {
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
        const match = exactMatch(w, dict) || fuzzyMatch(w, dict)
        if (match) {
          matches.push(match)
          if (pi) matches.push({ base: 'pi', meaning: 'too' })
          return matches
        }
      }
  return null
}

function matchPartial(
  word: string,
  dict: Record<string, LookupEntry>,
  maxLength = 4
): (PaliMatch & { leftover: string }) | null {
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
      if (dict[part]) {
        return {
          base: part,
          entry: dict[part],
          leftover: w.substring(w.length - i),
        }
      }
    }
  }
  return null
}

/** DPD lookup — tries inflection-to-headword mapping first, then deconstructor */
function lookupDpd(
  word: string,
  dict: Record<string, LookupEntry>,
  dpdI2h: Record<string, string[]>,
  dpdDecon: Record<string, string>
): PaliMatch[] {
  const allMatches: PaliMatch[] = []
  const headwords: string[] = []

  if (word in dpdI2h) {
    // Extract unique root headwords (entries like "ta 1.1" → root "ta")
    for (const entry of dpdI2h[word]) {
      const root = entry.split(' ')[0]
      if (!headwords.includes(root)) headwords.push(root)
    }
  }

  if (word in dpdDecon) {
    const firstComponent = dpdDecon[word].split('+')[0].trim()
    if (!headwords.includes(firstComponent)) headwords.push(firstComponent)
    allMatches.push({ base: word, meaning: dpdDecon[word] })
  }

  for (const hw of headwords) {
    // DPD uses ṃ (dot below), SC dicts use ṁ (dot above) — same thing
    const hwNorm = hw.replace(/ṃ/g, 'ṁ')
    if (dict[hwNorm]) {
      allMatches.push({ base: hwNorm, entry: dict[hwNorm] })
    }
  }

  return allMatches
}

/** Compound decomposition with sandhi resolution (fallback when DPD has no entry) */
function lookupCompound(
  word: string,
  dict: Record<string, LookupEntry>
): PaliMatch[] {
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
    matchComplete(w, dict, isTi)

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
      matchResult = matchComplete(unword, dict, isTi)
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
    matchResult = matchPartial(w, dict)
    if (unword) {
      const matchPartialResult = matchPartial(unword, dict)
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
        const completeResult = matchComplete(start + leftover, dict, isTi)
        if (completeResult && completeResult.length > 0) {
          allMatches = allMatches.concat(completeResult)
          foundComplete = true
          found = true
          break
        }
        const partialResult = matchPartial(start + leftover, dict)
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

export function lookupPali(
  rawWord: string,
  dict: Record<string, LookupEntry>,
  dpdI2h: Record<string, string[]> | null,
  dpdDecon: Record<string, string> | null
): PaliMatch[] {
  const cleaned = cleanPaliWord(rawWord)
  if (!cleaned) return []

  // Try DPD first (uses ṃ normalization — DPD data uses dot-below)
  if (dpdI2h && dpdDecon) {
    const dpdWord = normalizeDpdWord(cleaned)
    const dpdMatches = lookupDpd(dpdWord, dict, dpdI2h, dpdDecon)
    if (dpdMatches.length > 0) return dpdMatches
  }

  // Fall back to compound decomposition (keeps ṁ — endings table uses dot-above)
  return lookupCompound(cleaned, dict)
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
