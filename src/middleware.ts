// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'
import { ISO_CODES, PITAKA_BASKETS } from '~/constants/iso-codes'
import { loadLocale } from '~/i18n'
import { getPreferredLanguage } from '~/utils/language'

// Paths .net moved, so old links and bookmarks still land somewhere
const MOVED: Record<string, string> = {
  '/downloads': '/editions',
  '/edition': '/editions',
}

const LANGS = ISO_CODES.join('|')
// The old URLs gave the language a segment of its own, either side of the uid.
// A current /dn1/en/sujato reads the same as an old /dn1/en up to the author,
// so the author on the end is what tells the two apart
const LANG_THEN_UID = new RegExp(`/(${LANGS})/.*[0-9]`)
const UID_THEN_LANG = new RegExp(`/.*[0-9]/(${LANGS})`)
const UID_LANG_AUTHOR = new RegExp(`/.*[0-9]/(${LANGS})/[a-z\\d]+`)

/**
 * Where a path should go instead, or null to serve it as it is.
 */
function redirectTarget(path: string): string | null {
  if (MOVED[path]) return MOVED[path]

  // A whole segment, so /sutta/linked/sn comes along but /sutta-central is a
  // different word and stays put - .net substring-matches the href, so it
  // rewrites that one to /pitaka/sutta-central. And /pitaka/sutta cant match a
  // second time, its first segment being pitaka
  const segments = path.split('/').filter(Boolean)
  if (PITAKA_BASKETS.includes(segments[0])) return `/pitaka${path}`

  // Nothing is keyed pi- or skt- any more, they are pli- and san-, so this is
  // safe wherever it turns up. .net renames only when it strips a language too,
  // which leaves its own /pi-tv-bu-vb-pj1/pli/ms dead
  const renamed = segments.map(s =>
    s.replace(/^pi-/, 'pli-').replace(/^skt-/, 'san-')
  )

  const isLegacyLang =
    (LANG_THEN_UID.test(path) || UID_THEN_LANG.test(path)) &&
    !UID_LANG_AUTHOR.test(path)

  const kept = isLegacyLang
    ? renamed.filter(s => !ISO_CODES.includes(s))
    : renamed

  const target = '/' + kept.join('/')
  return target === path ? null : target
}

export const onRequest = defineMiddleware(async (context, next) => {
  const startTime = performance.now()

  // Astro ignores trailing slashes, so the matching below does too
  const path = context.url.pathname.replace(/(.)\/$/, '$1')
  const target = redirectTarget(path)
  if (target) {
    return context.redirect(target + context.url.search, 301)
  }

  if (!Object.hasOwn(context.locals, 'renderTime')) {
    Object.defineProperty(context.locals, 'renderTime', {
      get() {
        return ((performance.now() - startTime) / 1000).toFixed(2)
      },
    })
  }

  // Pages translate as they render, so have the strings ready. English is
  // what `t` falls back to. The API has nothing to translate
  if (!path.startsWith('/api/')) {
    const acceptLanguage = context.request.headers.get('accept-language')
    await Promise.all([
      loadLocale('en'),
      loadLocale(getPreferredLanguage(acceptLanguage)),
    ])
  }

  const response = await next()

  return response
})
