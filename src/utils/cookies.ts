import type { AstroCookies } from 'astro'

const SEARCH_LANGUAGES_KEY = 'searchLanguages'
const VIEW_PREFS_KEY = 'viewPrefs'

export function getSearchLanguages(cookies: AstroCookies): string[] | null {
  const cookieValue = cookies.get(SEARCH_LANGUAGES_KEY)?.json() as
    | string[]
    | undefined
  return cookieValue?.length ? cookieValue : null
}

export function setSearchLanguages(
  cookies: AstroCookies,
  languages: string[]
): void {
  cookies.set(SEARCH_LANGUAGES_KEY, JSON.stringify(languages), {
    path: '/',
    // No maxAge = session cookie (expires when browser closes)
  })
}

export function getViewPrefs(
  cookies: AstroCookies
): Record<string, boolean | string> {
  const cookieValue = cookies.get(VIEW_PREFS_KEY)?.json() as
    | Record<string, boolean | string>
    | undefined
  return cookieValue ?? {}
}

/** Same lifetime and scope as the text page script gives the cookie */
export function setViewPref(
  cookies: AstroCookies,
  key: string,
  value: boolean | string
): void {
  cookies.set(
    VIEW_PREFS_KEY,
    JSON.stringify({ ...getViewPrefs(cookies), [key]: value }),
    { path: '/', maxAge: 60 * 60 * 24 * 365 * 2, sameSite: 'lax' }
  )
}
