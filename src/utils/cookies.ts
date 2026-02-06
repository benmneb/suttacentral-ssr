import type { AstroCookies } from 'astro'

const SEARCH_LANGUAGES_KEY = 'searchLanguages'

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
