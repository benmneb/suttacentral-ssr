import { icon } from '~/constants/heroicons'
import type { LookupEntry } from '~/utils/lookup'

export type PaliMatch = { base: string; entry?: LookupEntry; meaning?: string }
export type LzhMatch = { term: string; start: number; entry: LookupEntry }

/** The book link's label and a cross-reference's text, each with `{word}` */
export type LookupLabels = { full: string; see: string }

export const PALI_WORD = /[\p{L}\p{M}­‧]+(?:[’'”][\p{L}\p{M}­‧]+)*/gu

/** A Pāli word as the dictionary has it */
export function cleanWord(word: string) {
  return word.replace(/[­‧]/g, '').toLowerCase()
}

export const escape = (text: string) =>
  text.replace(/[&<>"]/g, char => `&#${char.charCodeAt(0)};`)

export const definePath = (word: string) =>
  `/define/${encodeURIComponent(word)}`

export function defineLink(word: string, labels: LookupLabels) {
  const label = labels.full.replace('{word}', word)
  return `<a href="${definePath(word)}" aria-label="${escape(label)}">${icon('bookOpen')}</a>`
}

export function paliHtml(
  word: string,
  found: PaliMatch[],
  lang: string,
  labels: LookupLabels
) {
  const matches = found.length ? found : [{ base: word, meaning: '?' }]
  // The word already heads the sheet, so one match of it alone needs no
  // heading of its own
  const headed = !(matches.length === 1 && matches[0].base === word)
  return matches
    .map((match: PaliMatch) => {
      const dt = headed
        ? `<dt><dfn lang="${lang}" translate="no">${escape(match.base)} ${defineLink(match.base, labels)}</dfn></dt>`
        : ''
      let dd = ''
      if (match.entry) {
        const { d, g, x } = match.entry
        if (g) dd += `<span class="grammar">${g}</span>`
        dd += `<ol class="definition">${[d]
          .flat()
          .map(d => `<li>${d}</li>`)
          .join('')}</ol>`
        if (x) {
          dd += `<ul class="xr">${[x]
            .flat()
            .map(
              x =>
                `<li><a href="${definePath(x)}">${escape(labels.see.replace('{word}', x))}</a></li>`
            )
            .join('')}</ul>`
        }
      } else {
        dd = escape(match.meaning ?? '?')
      }
      return `<dl>${dt}<dd>${dd}</dd></dl>`
    })
    .join('')
}

export function lzhHtml(
  terms: LzhMatch[],
  hans: boolean,
  labels: LookupLabels
) {
  if (!terms.length) return '<ol><li>?</li></ol>'
  return `<ol>${terms
    .map(({ term, entry }) => {
      const defs = [entry.d].flat().join('; ')
      return `<li><b lang="${hans ? 'lzh-Hans' : 'lzh'}">${escape(term)}</b>${entry.p ? ` (${escape(entry.p)})` : ''} ${defs} ${defineLink(entry.t ?? term, labels)}</li>`
    })
    .join('')}</ol>`
}

/** Where the answers come from, for the languages whose dictionaries say */
export function lookupSource(from: string, to: string) {
  if (from === 'lzh')
    return '<a href="http://www.buddhism-dict.net/ddb/" rel="external">Digital Dictionary of Buddhism</a>'
  if (to === 'en')
    return '<a href="https://digitalpalidictionary.github.io/" rel="external">Digital Pāḷi Dictionary</a>'
  return null
}

/** Tags and character references, which are left as they are */
const MARKUP = /(<[^>]*>|&#?\w+;)/
const HAN_RUN = /\p{Script=Han}+/gu

/**
 * A root text's HTML with each word, or Chinese character, a link into the
 * lookup frame. A character's carries the ones around it, as `contextOf` sends
 */
export function linkRootWords(
  html: string,
  { from, to, hans }: { from: string; to: string; hans: boolean }
) {
  const link = (href: string, text: string) =>
    `<a class="word" href="${href}" target="lookup">${text}</a>`
  const linkText =
    from === 'lzh'
      ? (text: string) =>
          text.replace(HAN_RUN, run => {
            const chars = [...run]
            return chars
              .map((char, i) => {
                const start = Math.max(0, i - 3)
                const context = chars.slice(start, i + 8).join('')
                return link(
                  `/lookup/lzh/${to}/${context}?at=${i - start}${hans ? '&amp;hans' : ''}`,
                  char
                )
              })
              .join('')
          })
      : (text: string) =>
          text.replace(PALI_WORD, word =>
            link(`/lookup/${from}/${to}/${cleanWord(word)}`, word)
          )
  return html
    .split(MARKUP)
    .map((part, i) => (i % 2 ? part : linkText(part)))
    .join('')
}
