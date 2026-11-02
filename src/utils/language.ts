function normalizeLanguageCode(code: string): string {
  // * means any language, which is what a request that names none arrives as
  if (!code || code === '*') return 'en'
  // Handle SC data not matching ISO Accept-Language headers
  if (code === 'nb' || code === 'nn') return 'no' // generic Norsk codes
  if (code === 'ja') return 'jpn'
  if (code === 'kn') return 'kan'
  return code
}

export function getPreferredLanguage(
  acceptLanguageHeader: string | null
): string {
  if (!acceptLanguageHeader) return 'en'

  const languages = acceptLanguageHeader.split(',')
  const primary = languages[0].split(';')[0].trim()
  const code = primary.split('-')[0]

  return normalizeLanguageCode(code)
}

export function getAllPreferredLanguages(
  acceptLanguageHeader: string | null
): string[] {
  if (!acceptLanguageHeader) return ['en']

  const codes = acceptLanguageHeader.split(',').map(lang => {
    const code = lang.split(';')[0].trim().split('-')[0]
    return normalizeLanguageCode(code)
  })

  // Remove duplicates while preserving order
  return [...new Set(codes)]
}

export function getPreferredLocale(
  acceptLanguageHeader: string | null
): string {
  if (!acceptLanguageHeader) return 'en-US'

  const locale = acceptLanguageHeader.split(',')[0].split(';')[0].trim()
  return !locale || locale === '*' ? 'en-US' : locale
}

export function getLanguageName(
  locale: string,
  displayIn: string = locale
): string {
  try {
    const languageCode = locale.split('-')[0]
    const displayNames = new Intl.DisplayNames([displayIn], {
      type: 'language',
    })
    return displayNames.of(languageCode) || locale
  } catch {
    return locale
  }
}

// Not .net's own codes, as BCP 47 takes the two-letter one where there is one
const LANG_TAGS: Record<string, string> = {
  pli: 'pi',
  san: 'sa',
  jpn: 'ja',
  kan: 'kn',
  uig: 'ug',
  // `sld` is Sissala, and Saarländisch has no subtag of its own
  sld: 'de',
}

/** A SuttaCentral language code as a BCP 47 tag, eg "pli" as "pi" */
export function langTag(code: string): string {
  return LANG_TAGS[code] ?? code
}

/** The `lang` and `hreflang` attributes in the API's own HTML as BCP 47 tags */
export function langTagsIn(html: string): string {
  return html.replace(/(?<=\s(?:href)?lang=['"])[a-z]{3}(?=['"])/g, langTag)
}
