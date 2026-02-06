function normalizeLanguageCode(code: string): string {
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

  return acceptLanguageHeader.split(',')[0].split(';')[0].trim()
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
