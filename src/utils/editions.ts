import { collectionURL } from '~/constants/edition'
import { langTagsIn } from '~/utils/language'
import { closeHeadingGaps } from '~/utils/strings'

/** A collection's SuttaCentral Edition, as its menus link to it */
export interface EditionLink {
  href: string
  title: string
  creator: string
}

/** The SuttaCentral Editions of these collections in the reader's language */
export async function fetchEditions(
  uids: (string | undefined)[],
  language: string
): Promise<Map<string, EditionLink>> {
  const editions = new Map<string, EditionLink>()
  const collections = uids.filter(uid => !!uid && collectionURL.has(uid))
  if (!collections.length) return editions

  try {
    const response = await fetch(
      'https://suttacentral.net/api/publication/editions'
    )
    const all: { edition_id: string }[] = await response.json()

    await Promise.all(
      collections.map(async uid => {
        const web = all.find(
          ({ edition_id }) =>
            edition_id.startsWith(`${uid}-${language}-`) &&
            edition_id.includes('-web_')
        )
        if (!web) return
        const r = await fetch(
          `https://suttacentral.net/api/publication/edition/${web.edition_id}`
        )
        const { publication } = await r.json()
        if (!publication) return
        editions.set(uid!, {
          href: `/edition/${publication.text_uid}/${publication.translation_lang_iso}/${publication.creator_uid}`,
          title: publication.translation_title,
          creator: publication.creator_name,
        })
      })
    )
  } catch {
    // Whatever was found before it failed, if anything
  }

  return editions
}

/** An edition's front or back matter as valid HTML, as the editions' EPUB markup isn't */
export function tidyMatter(html: string): string {
  const ids = new Set<string>()
  return langTagsIn(
    closeHeadingGaps(html)
      .normalize('NFC')
      .replace(/\s+epub:type=(['"])[^'"]*\1/g, '')
      .replace(/<[a-z][^>]*\sclass=[^>]*\sclass=[^>]*>/g, tag => {
        const classes: string[] = []
        const rest = tag.replace(
          /\s+class=(['"])([^'"]*)\1/g,
          (_, __, value) => {
            classes.push(value)
            return ''
          }
        )
        return rest.replace(
          /^<[a-z\d]+/,
          name => `${name} class="${classes.join(' ')}"`
        )
      })
      .replace(/\sid=(['"])([^'"]*)\1/g, (match, _, id) => {
        if (ids.has(id)) return ''
        ids.add(id)
        return match
      })
      .replace(
        /(<dt\b[^>]*>((?:(?!<\/dt>)[\s\S])*)<\/dt>(?:\s*<dd\b(?:(?!<\/?d[dlt]\b)[\s\S])*<\/dd>)+)\s*<dt\b[^>]*>\2<\/dt>/g,
        '$1'
      )
      .replace(/<\/dt>(?=\s*(?:<dt\b|<\/dl>))/g, '</dt><dd></dd>')
      .replace(/(?<=href=['"]https:\/\/suttacentral\.net\/)\s+/g, '')
      // A markdown link the editions left in an href, which ends at its first ")"
      .replace(
        /href=(['"])(https:\/\/suttacentral\.net\/[^)'"\s]+)\)(?:(?!\1)[\s\S])*\1/g,
        'href=$1$2$1'
      )
  )
}
