export function getPreferredLanguage(
  acceptLanguageHeader: string | null
): string {
  if (!acceptLanguageHeader) return 'en'

  const languages = acceptLanguageHeader.split(',')
  const primary = languages[0].split(';')[0].trim()

  return primary.split('-')[0]
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
