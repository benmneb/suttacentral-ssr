/**
 * Translation system for internationalization.
 *
 * Automatically discovers and loads all translation files from the locales directory.
 * Translation files should be organized as: ./locales/{language_code}/{filename}.json
 *
 * Translation file names are the same as `suttacentral` repo,
 * even when the files have come from `sc-data` repo,
 * I've renamed them for consistency and minimalism
 *
 * Translation files specific to this project are prefixed with `_scx_`.
 * Translations not translated by humans are prefixed with `_machine_`.
 *
 * If there is ever a conflict between translations in the future, so long as this
 * naming convention and file structure remain, human translations will be given preference.
 */

/**
 * Store for all translation strings, organized by locale.
 * Automatically populated from JSON files in the locales directory.
 *
 * @type {Record<string, Record<string, string>>}
 */
const translations: Record<string, Record<string, string>> = {}

// Dynamically import all translation files
const modules = import.meta.glob('./locales/*/*.json', { eager: true })

// Sort paths to ensure _machine_ files are processed first
// This way official translations overwrite machine translations if keys conflict
const sortedPaths = Object.keys(modules).sort((a, b) => {
  const aIsMachine = a.includes('/_machine_')
  const bIsMachine = b.includes('/_machine_')
  if (aIsMachine && !bIsMachine) return -1 // machine files first
  if (!aIsMachine && bIsMachine) return 1 // official files last
  return a.localeCompare(b) // alphabetical within each group
})

for (const path of sortedPaths) {
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/)
  if (match) {
    const [, locale, filename] = match

    // Auto-create locale object if it doesn't exist
    if (!translations[locale]) {
      translations[locale] = {}
    }

    translations[locale] = {
      ...translations[locale],
      ...(modules[path] as any).default,
    }
  }
}

/**
 * Translates a key into the specified locale.
 *
 * @param {string} locale - The language code (e.g., 'en', 'fr', 'ja'). Falls back to 'en' if not found.
 * @param {string} key - The translation key to look up (e.g., 'home:1').
 * @param {object} variables - Variables to replace with data (e.g., { count: 1 }).
 * @returns {string} The translated string, or the key itself if translation is not found.
 *
 * @example
 * const userLanguage = getPreferredLanguage(Astro.request.headers.get('accept-language'));
 * t(userLanguage, 'home:1');
 *
 *  * @example
 * // JSON: "suttaplex:countParallel": "{count} parallel"
 * const text = t(userLanguage, 'suttaplex:countParallel', { count: 2 });
 */
export function t(
  locale: string,
  key: string,
  variables?: Record<string, any>
): string {
  let translated =
    translations[locale]?.[key] || translations['en']?.[key] || key

  if (variables) {
    translated = translated.replace(/\{(\w+)\}/g, (match, varName) => {
      const value = variables[varName]
      if (!value) return ''
      return String(value)
    })
  }

  return translated?.trim()
}
