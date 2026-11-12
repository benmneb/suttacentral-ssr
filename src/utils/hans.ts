/**
 * Simplified Characters, for the text page's "Simplified" setting and word
 * lookup on it
 *
 * From the map `scripts/build-hans.ts` writes. Each character or phrase
 * becomes one of the same length, so a simplified text lines up with its
 * traditional one.
 */

import hans from '../constants/hans.json' with { type: 'json' }

const { chars, phrases } = hans as {
  chars: Record<string, string>
  phrases: Record<string, string>
}

let swaps: RegExp | undefined

/** The longest phrase at each place first, then the character, as OpenCC does */
export function simplified(text: string) {
  if (!swaps) {
    const terms = Object.keys(phrases).sort((a, b) => b.length - a.length)
    const starts = new Set(
      terms.map(term => String.fromCodePoint(term.codePointAt(0)!))
    )
    // A lookahead first, as trying every phrase at each place is 3 times slower
    swaps = new RegExp(
      `(?=[${[...starts].join('')}])(?:${terms.join('|')})|[${Object.keys(chars).join('')}]`,
      'gu'
    )
  }
  return text.replace(swaps, swap => phrases[swap] ?? chars[swap])
}

/** The text in some HTML, leaving its tags alone */
export function simplifiedHtml(html: string) {
  return html.replace(/<[^>]*>|[^<]+/g, part =>
    part.startsWith('<') ? part : simplified(part)
  )
}
