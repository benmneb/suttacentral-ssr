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

/** The site's spelling of a language name, as the API has "Pali" in places */
export function languageName(name: string): string {
  return name === 'Pali' ? 'Pāli' : name
}

/**
 * A segment's text with bilara's own tags as HTML: <supplied> and <unclear> as
 * the classes legacy texts use, and <j>, which starts a verse's next
 * half-line, as a span closed at the segment's end
 */
export function bilaraMarkup(text: string): string {
  if (!text?.includes('<')) return text
  let joins = 0
  const html = text
    .replace(/<j>/g, () => {
      joins++
      return '<span class="j">'
    })
    .replace(/<(\/?)(supplied|unclear)>/g, (_, close, tag) =>
      close ? '</span>' : `<span class="${tag}">`
    )
  return html + '</span>'.repeat(joins)
}

/**
 * Gives each heading level in turn the one `closeHeadingGaps` makes it, eg h1,
 * h4, h6, h4 as 1, 2, 3, 2
 */
export function headingRenumberer() {
  // Each open section's level and new level, under one for anything before h1
  const sections = [{ level: 0, to: 1 }]
  return (level: number) => {
    while (sections.length > 1 && sections.at(-1)!.level >= level)
      sections.pop()
    const to = level === 1 ? 1 : sections.at(-1)!.to + 1
    sections.push({ level, to })
    return to
  }
}

/**
 * Headings renumbered so none is more than a level below the one it's under,
 * eg an h4 straight after the h1 as an h2, as .net's texts skip levels
 */
export function closeHeadingGaps(html: string): string {
  const renumber = headingRenumberer()
  const open: number[] = []
  return html.replace(/<(\/?)h([1-6])(?=[\s>])/g, (_, close, digit) => {
    if (close) return `</h${open.pop() ?? digit}`
    open.push(renumber(Number(digit)))
    return `<h${open.at(-1)}`
  })
}

/**
 * Headings with no text unwrapped, and a section one of them opens made a div.
 * On a root text's page these are headings only translations fill, eg
 * /ma1/lzh/sct and /pli-tv-bu-vb-pj1/pli/ms
 */
export function dropEmptyHeadings(html: string): string {
  const unsectioned = html.replace(
    /<section\b([^>]*)>(\s*<(h[1-6])\b[^>]*>((?:(?!<\/h[1-6]>)[\s\S])*)<\/\3>)/g,
    (match, attrs, heading) =>
      isEmptyHeading(heading)
        ? `<div${attrs} data-unsectioned>${heading}`
        : match
  )
  const open: string[] = []
  return unsectioned.replace(
    /<div([^>]*) data-unsectioned>|<section\b|<\/section>|<(h[1-6])\b[^>]*>((?:(?!<\/h[1-6]>)[\s\S])*)<\/\2>/g,
    (match, divAttrs, tag, inner) => {
      if (divAttrs !== undefined) {
        open.push('div')
        return `<div${divAttrs}>`
      }
      if (match === '<section') open.push('section')
      else if (match === '</section>') {
        return open.pop() === 'div' ? '</div>' : match
      } else if (tag && isEmptyHeading(match)) return inner
      return match
    }
  )
}

/** Has a heading nothing to read, leaving aside its hidden segment number? */
function isEmptyHeading(heading: string): boolean {
  const text = heading
    .replace(
      /<span class="reference"[^>]*>(?:(?!<\/span>)[\s\S])*<\/span>/g,
      ''
    )
    .replace(/<[^>]*>/g, '')
  return !text.trim() && !/<(?:img|svg)\b|aria-label/.test(heading)
}

/** Lets a long Pali compound title wrap before its suffix, eg "-sutta" */
export function softHyphenateTitle(title: string): string {
  return title.replace(
    /(?<=\p{L})(sutta|vagga|paṇṇāsa|saṁyutta|nipāta)(?=\s*$)/u,
    '\u00AD$1'
  )
}

/**
 * Make pretty PTS volpages, "PTS MN 1.1, PTS 1.2, PTS 1.3" to "PTS 1.1–1.3".
 * The book is left out, as the acronym is always beside it
 */
export function formatVolpages(volpages?: string | null): string {
  if (!volpages) return ''
  if (!volpages.includes('PTS')) return volpages.trim()

  // Some end in a comma
  const parts = volpages
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
  const firstParts = parts[0].split(' ')
  const lastParts = parts[parts.length - 1].split(' ')
  // Keeps the edition, as in "PTS (2nd ed) SN 1.1"
  const prefix = parts[0].match(/^PTS(?: \(\w+ ed\))?/)?.[0] ?? firstParts[0]
  const firstNum = firstParts[firstParts.length - 1]
  const lastNum = lastParts[lastParts.length - 1]

  return parts.length < 2
    ? `${prefix} ${firstNum}`
    : `${prefix} ${firstNum}–${lastNum}`
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
