// Slips in the full dictionaries' html
const HTML_SLIPS: [RegExp, string][] = [
  // Dhammika's medical uses, each with the plant's name in a td
  [/<\/?td>/g, ''],
  // DPPN's thūlū, whose second name opens with </dt>
  [/<\/dt><\/dt>/g, '</dt><dt>'],
  // DPPN's ubbirī and upasamā
  [/(<\/dt>)&gt;/g, '$1'],
  // DPPN's vejayanta, whose third entry opens a dl it never closes
  [/(<\/dd>)<dl>/g, '$1'],
  // PTS's itthatta, koṭṭita and ayyira
  [/<p span /g, '<p '],
  [/'grammar's>/g, "'grammar'>"],
  // PTS's Greek where it starts with an accent, which sits on the space before it, so that goes in too
  [/ (<[a-z][^>]*>)(?=\p{M})/gu, '$1 '],
]

/**
 * A full dictionary entry's html with its slips mended (`HTML_SLIPS`), and no
 * term named twice in one dl, as HTML has it: one again in its own group goes,
 * and one again in a later group starts a new dl there, eg PTS's two Bahulas
 */
export function tidyDictionaryHtml(html: string): string {
  return HTML_SLIPS.reduce(
    (text, [slip, mend]) => text.replace(slip, mend),
    html
  ).replace(/<dl\b([^>]*)>([^]*?)<\/dl>/g, (_, attributes, body) => {
    const again = `</dl><dl${attributes.match(/ class=(['"]).*?\1/)?.[0] ?? ''}>`
    const out: string[] = []
    let names = new Set<string>()
    let group = new Set<string>()
    let groupStart = -1
    for (const [part, tag, content] of body.matchAll(
      /<(dt|dd)\b[^>]*>([^]*?)<\/\1>|[^<]+|</g
    )) {
      if (tag === 'dd') groupStart = -1
      if (tag !== 'dt') {
        out.push(part)
        continue
      }
      if (groupStart === -1) {
        groupStart = out.length
        group = new Set()
      }
      const name = content
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (group.has(name)) continue
      if (names.has(name)) {
        out.splice(groupStart, 0, again)
        names = new Set(group)
      }
      names.add(name)
      group.add(name)
      out.push(part)
    }
    return `<dl${attributes}>${out.join('')}</dl>`
  })
}

/**
 * An NCPED entry with its grammar whole where it was split at the ";" of an
 * "&amp;", the rest of it taken for a cross-reference, eg iriyā's
 * "feminine (&amp" and "~a neuter)"
 */
export function mendNcped<T extends { grammar?: string; xr?: unknown }>(
  entry: T
): T {
  if (!entry.grammar?.endsWith('&amp')) return entry
  const { xr, ...rest } = entry
  return {
    ...rest,
    grammar: [entry.grammar.slice(0, -3), xr].filter(Boolean).join(' '),
  } as T
}
