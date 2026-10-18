import { collectionURL } from '~/constants/edition'

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
