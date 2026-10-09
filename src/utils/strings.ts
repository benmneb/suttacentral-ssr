/**
 * Converts a string to sentence case.
 *
 * Sentence case means the first letter of the string and the first letter
 * after sentence-ending punctuation (., !, ?) are capitalized, while all
 * other letters are lowercase.
 *
 * @param str - The string to convert to sentence case
 * @returns The sentence-cased string
 */
export function toSentenceCase(str: string): string {
  if (!str) return str

  return str
    .toLowerCase()
    .replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, match => match.toUpperCase())
}

export function normalise(str: string): string {
  if (!str) return ''
  return str.trim().toLowerCase()
}

export function uidToAcronym(uidInput: string) {
  if (!uidInput) return ''
  // I think it's only AN and Dhp that have range suttas, but anyway...
  return String(uidInput).replace(
    /^([a-zA-Z]+)(.*)$/,
    (_, l, n) => l.toUpperCase().replace('DHP', 'Dhp') + ' ' + n
  ) // eg "AN 1.1", "Dhp 1"...
}

/**
 * Split the trailing number(s) off a uid. Handles both a plain uid and a range:
 * "sn45.1" -> { prefix: "sn45.", start: 1, end: 1 }
 * "an1.1-10" -> { prefix: "an1.", start: 1, end: 10 }
 * "dhp383-423" -> { prefix: "dhp", start: 383, end: 423 }
 */
export function parseUidNumbers(uid: string) {
  const match = String(uid ?? '').match(/^(.+?)(\d+)(?:-(\d+))?$/)
  if (!match) return null
  const start = parseInt(match[2], 10)
  return {
    prefix: match[1],
    start,
    end: match[3] ? parseInt(match[3], 10) : start,
  }
}

/** Is `uid` covered by `rangeUid`? eg "sn45.52" is in "sn45.50-54" */
export function uidIsInRange(uid: string, rangeUid: string): boolean {
  const range = parseUidNumbers(rangeUid)
  if (!range || !uid.startsWith(range.prefix)) return false
  const rest = uid.slice(range.prefix.length)
  if (!/^\d+$/.test(rest)) return false
  const no = parseInt(rest, 10)
  return no >= range.start && no <= range.end
}

/**
 * The `title` of a range suttaplex is sometimes a real expanded name
 * ("Dhammapada 5") and sometimes just the uid that was asked for ("sn45.50"),
 * so fall back to the acronym when it's the latter
 */
export function rangeSuttaTitle(title: string | null, uid: string) {
  if (title && normalise(title) !== normalise(uid)) return title
  return uidToAcronym(uid)
}

/** Like `uidToAcronym`, but with the en dash .net uses for ranges */
export function rangeUidToAcronym(uid: string) {
  return uidToAcronym(uid).replace(/(\d)-(\d)/, '$1–$2') // eg "AN 1.175–186"
}

export function uidToTitle(uidInput: string) {
  if (uidInput.includes('.')) return uidInput.split('.')[1] // "AN 1.1" -> "1" as per .net
  return uidToAcronym(uidInput).split('Dhp ')[1] // just the number too (.net just leaves the chapter title...)
}

/**
 * Expand a hyphenated UID like 'pli-tv-bi-vb-pc4' into 'Pli Tv Bi Vb Pc 4'
 * using the expansion data from /api/expansion
 */
export function expandUid(
  uid: string,
  expansions: Record<string, [string, string]>
): string {
  if (!uid) return ''
  const parts = uid.split('-')
  let result = ''
  let tail = ''

  for (let part of parts) {
    if (expansions[part]) {
      result += `${expansions[part][0]} ${tail}`
      tail = ''
    } else {
      const tailMatch = part.match(/\d+.*/)
      if (tailMatch) {
        tail = `${tailMatch[0]}–`
        part = part.replace(/\d+.*/, '')
      }
      if (part && expansions[part]) {
        result += `${expansions[part][0]} ${tail}`
        tail = ''
      } else if (tail) {
        result += tail
      }
    }
  }

  return result.replace(/–\s*$/, '').trim()
}
