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

/**
 * A translation's author or a root text's edition. The API names the Taishō
 * edition "Taisho Tipitaka" on one text and nothing on the rest
 */
export function authorName(text: { author?: string; author_uid?: string }) {
  if (text.author_uid === 'sct') return 'SuttaCentral Taishō'
  return (text.author || text.author_uid)?.trim()
}

/** The site's spelling of a language name, as the API has "Pali" in places */
export function languageName(name: string): string {
  return name === 'Pali' ? 'Pāli' : name
}

/**
 * A segment's text with bilara's own tags as HTML: <supplied> and <unclear> as
 * the classes legacy texts use, and <j>, which starts a verse's next
 * half-line, as a span closed at the segment's end. Drops the <reference> and
 * empty <root> left in sf36:70.27, whose reference is in its references too
 */
export function bilaraMarkup(text: string): string {
  if (!text?.includes('<')) return text
  let joins = 0
  const html = text
    .replace(/<reference>[^<]*<\/reference>|<root><\/root>/g, '')
    .replace(/<j>/g, () => {
      joins++
      return '<span class="j">'
    })
    .replace(/<(\/?)(supplied|unclear)>/g, (_, close, tag) =>
      close ? '</span>' : `<span class="${tag}">`
    )
  return html + '</span>'.repeat(joins)
}

type BilaraData = {
  html_text?: Record<string, string>
  keys_order?: string[]
}

// Slips in bilara html, as a text's segments joined by \0 so one can span two
const HTML_SLIPS: [RegExp, string][] = [
  // vb16's, where every other text has data-counter
  [/<p counter=/g, '<p data-counter='],
  // sa1's header list, which its title would be in
  [/(<header><ul>(?:(?!<\/ul>)[^])*?)(?=<h1)/g, '$1</ul>'],
  // pli-tv-bu-vb-np10's rule between two items, which a list can't have
  [/<\/dd>(\0)<hr>/g, '<hr></dd>$1'],
  // t765's byline, a list item after the header, as the header's last line
  [
    /<\/header>(\0)<li class='subheading'>\{\}<\/li>/g,
    "$1<p class='subheading'>{}</p></header>",
  ],
]

const TAGS = /<(\/?)([a-z][a-z0-9]*)\b[^>]*>/g
const VOID_TAGS = /^(?:area|br|col|embed|hr|img|input|link|meta|source|wbr)$/

/**
 * A segmented text's html, in place, with `HTML_SLIPS` mended and any end tag
 * with nothing open to end dropped, as a browser would, eg t765.63's verses,
 * which end `</span></p></blockquote>` but open only the <p>. Its articles and
 * sections with no heading of their own become divs, eg dhp4 in dhp1-20, under
 * dhp3's title, every text of an1.378-393 and the Vinaya's marked passages, eg
 * <section class='kamma'>, and it closes the article Taishō texts leave open
 */
export function tidySegmentedHtml(bilaraData: BilaraData) {
  const html = bilaraData.html_text
  const keys = bilaraData.keys_order
  if (!html || !keys?.length) return
  const joined = keys.map(key => html[key] ?? '').join('\0')
  let tidied = joined
  for (const [slip, mend] of HTML_SLIPS) tidied = tidied.replace(slip, mend)

  type Element = { name: string; at: number; titled: boolean }
  const open: Element[] = []
  // Each change as where it starts, where it ends and what goes there
  const edits: [number, number, string][] = []
  const isSectioning = (name: string) =>
    name === 'article' || name === 'section'
  const unsection = ({ name, at }: Element) =>
    edits.push([at, at + name.length + 1, '<div'])
  for (const match of tidied.matchAll(TAGS)) {
    const [tag, close, name] = match
    if (VOID_TAGS.test(name)) continue
    if (!close) {
      open.push({ name, at: match.index, titled: false })
      // As the validator counts them, a heading in a nested section isn't the outer one's
      if (name[0] === 'h' && /^h[1-6]$/.test(name)) {
        const section = open.findLast(element => isSectioning(element.name))
        if (section) section.titled = true
      }
      continue
    }
    const i = open.findLastIndex(element => element.name === name)
    if (i === -1) {
      edits.push([match.index, match.index + tag.length, ''])
      continue
    }
    const element = open[i]
    open.length = i
    if (isSectioning(name) && !element.titled) {
      unsection(element)
      edits.push([match.index, match.index + name.length + 2, '</div'])
    }
  }
  let end = ''
  for (const element of open.reverse()) {
    if (!isSectioning(element.name)) continue
    if (!element.titled) unsection(element)
    end += `</${element.titled ? element.name : 'div'}>`
  }
  if (edits.length) {
    let from = 0
    let rebuilt = ''
    for (const [start, stop, text] of edits.sort(([a], [b]) => a - b)) {
      rebuilt += tidied.slice(from, start) + text
      from = stop
    }
    tidied = rebuilt + tidied.slice(from)
  }
  tidied += end
  if (tidied === joined) return
  tidied.split('\0').forEach((text, i) => {
    if (text !== (html[keys[i]] ?? '')) html[keys[i]] = text
  })
}

const LEGACY_TOKENS = /<(\/?)([a-z][a-z0-9]*)\b[^>]*>|<![^>]*>|[^<]+|</g
const BLOCK_TAGS =
  /^(?:address|article|aside|blockquote|div|dl|figure|footer|h[1-6]|header|hr|nav|p|pre|section|table)$/
// Anything but another item or the list's end after an item's end
const AFTER_ITEM = /<\/li>\s*(?:[^\s<]|<(?!\/?(?:li|ol|ul)\b))/

/** Might `tidyLists` change it? Far quicker to answer than running it */
function hasListSlips(html: string): boolean {
  const count = (pattern: RegExp) => html.match(pattern)?.length ?? 0
  return AFTER_ITEM.test(html) || count(/<[ou]l\b/g) !== count(/<\/[ou]l>/g)
}

/**
 * A legacy text with its slips mended: a list with what only an item can hold
 * (`tidyLists`), a stray comma among a tag's attributes, eg patthana1.23's
 * `<ol type="1", start="5">`, a URL with %7C for every /, eg sf81's, and an
 * empty link, eg kv1.1's `<a class='pc' id='pc8' href='#pc8'></a>`, which .net
 * fills only with paragraph numbers on, made an anchor
 */
export function tidyLegacyHtml(html: string): string {
  let tidied = hasListSlips(html) ? tidyLists(html) : html
  tidied = tidied
    .replace(/(<[a-z][^<>]*?['"])\s*,(?=\s)/g, '$1')
    .replace(/(<a\b[^>]*?)\s+href=(['"])[^'"]*\2([^>]*>\s*<\/a>)/g, '$1$3')
  if (!tidied.includes('%7C')) return tidied
  return tidied.replace(
    /\bhref=(['"])http:%7C%7C([^'"]*)/g,
    (_, quote, rest) => `href=${quote}http://${rest.replaceAll('%7C', '/')}`
  )
}

/**
 * Lists with only items in them. What follows an item's end tag that isn't
 * another item goes back into it, as a nested list or a sentence after a stray
 * </li> was meant to, and a heading or paragraph ends a list left open, eg in
 * patthana1.8/en/narada. An end tag with nothing open to end goes
 */
function tidyLists(html: string): string {
  const open: string[] = []
  const out: string[] = []
  const inList = () => /^[ou]l$/.test(open.at(-1) ?? '')
  let itemEnd = -1
  for (const [token, close, name] of html.matchAll(LEGACY_TOKENS)) {
    if (!name && (!token.trim() || token.startsWith('<!'))) {
      out.push(token)
      continue
    }
    if (inList() && !close && name !== 'li') {
      if (BLOCK_TAGS.test(name)) {
        while (inList()) out.push(`</${open.pop()}>`)
      } else if (itemEnd !== -1) {
        out[itemEnd] = ''
        open.push('li')
      }
    }
    itemEnd = close && name === 'li' && open.at(-1) === 'li' ? out.length : -1
    out.push(token)
    if (!name || VOID_TAGS.test(name)) continue
    if (close) {
      const i = open.lastIndexOf(name)
      if (i === -1) out[out.length - 1] = ''
      else open.length = i
    } else {
      // An item, or a paragraph, ends the one before it
      if (/^(?:li|p)$/.test(name) && open.at(-1) === name) open.pop()
      open.push(name)
    }
  }
  return out.join('')
}

const BRACKETED_LINK =
  /<a href=(['"])([^'"#]*)#([^'"]*[[\]][^'"]*)\1>([^<]*)<\/a>/g

/**
 * A note with each link that has square brackets in it split into the
 * Markdown links run together in it, eg SN 45.33's "[SN 47.33:1.1],
 * [SN 51.2:1.1]" as one link to #1.1], [sn51.2:1.1. The first goes to its own
 * text, the others to the "<uid>:<segment>" each names
 */
export function splitBracketedLinks(html: string): string {
  if (!html.includes('[') && !html.includes(']')) return html
  return html.replace(
    BRACKETED_LINK,
    (
      match: string,
      quote: string,
      url: string,
      anchor: string,
      text: string
    ) => {
      const anchors = anchor.split(/\]([^[]*)\[/)
      const texts = text.split(/\][^[]*\[/)
      if (anchors.length !== texts.length * 2 - 1) return match
      const unbracket = (part: string) => part.replace(/[[\]]/g, '')
      return anchors
        .map((part, i) => {
          if (i % 2) return part
          const target = unbracket(part)
          const [uid, segment] = i ? target.split(':') : [null, target]
          const href = uid ? url.replace(/[^/]+(?=\/[a-z]+\/[^/]+$)/, uid) : url
          return `<a href=${quote}${href}#${segment}${quote}>${unbracket(texts[i / 2])}</a>`
        })
        .join('')
    }
  )
}

// The Private Use Area characters in the API's texts, which no font the site uses has
const PRIVATE_USE: Record<string, string> = {
  // Word's Symbol font angle brackets, in sa107/en/analayo
  '': '⟨',
  '': '⟩',
  // pdhp414's ṛ
  '': 'ṛ',
  // CBETA's gaiji CB00595, CB00596 and CB02213 in Taishō texts, as CBETA normalises them
  '\u{F0253}': '麨',
  '\u{F0254}': '䴵',
  '\u{F08A5}': '爆',
}
const PRIVATE_USE_PATTERN = new RegExp(
  `[${Object.keys(PRIVATE_USE).join('')}]`,
  'gu'
)

/** A text with the Private Use Area characters the API has swapped for real ones */
export function swapPrivateUse(text: string): string {
  if (!text) return text
  return text.replace(PRIVATE_USE_PATTERN, char => PRIVATE_USE[char])
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

const SECTIONS_AND_HEADINGS =
  /<(\/?)(section|article)\b|<(h[1-6])\b[^>]*>((?:(?!<\/h[1-6]>)[\s\S])*)<\/\3>/g

/**
 * Headings with no text unwrapped, and a section left with none of its own
 * made a div, as is one that never had one, eg a legacy text's. On a root
 * text's page these are headings only translations fill, eg /ma1/lzh/sct,
 * /pli-tv-bu-vb-pj1/pli/ms and /pli-tv-bi-vb-np10/pli/ms
 */
export function dropEmptyHeadings(html: string): string {
  type Section = { name: string; tag: number; titled: boolean }
  const open: Section[] = []
  const emptied = new Set<number>()
  const unsectioned = new Set<number>()
  let tag = 0
  for (const [match, close, name, heading] of html.matchAll(
    SECTIONS_AND_HEADINGS
  )) {
    const n = tag++
    // As the validator counts them, a heading in a nested section isn't the outer one's
    if (heading) {
      if (isEmptyHeading(match)) emptied.add(n)
      else if (open.length) open.at(-1)!.titled = true
    } else if (!close) {
      open.push({ name, tag: n, titled: false })
    } else if (open.at(-1)?.name === name) {
      const section = open.pop()!
      if (name === 'section' && !section.titled) {
        unsectioned.add(section.tag).add(n)
      }
    }
  }
  if (!emptied.size && !unsectioned.size) return html
  tag = 0
  return html.replace(
    SECTIONS_AND_HEADINGS,
    (match, close, _name, heading, inner) => {
      const n = tag++
      if (heading) return emptied.has(n) ? inner : match
      return unsectioned.has(n) ? `<${close}div` : match
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

/** A word's /define page, with its spaces encoded, eg /define/udena%20cetiya */
export function defineHref(word: string): string {
  return `/define/${word.replaceAll(' ', '%20')}`
}
