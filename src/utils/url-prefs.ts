import { paliScriptOf } from '~/constants/pali-scripts'
import { referenceEditions } from '~/constants/reference-editions'

/**
 * The view settings a .net link carries in its query, as viewPrefs keys.
 * Values are .net's own, from `_setTextViewState` in sc-text-bilara.js
 */
export function getUrlViewPrefs(params: URLSearchParams): {
  prefs: Record<string, boolean | string>
  // Which param set each, so changing one undoes the whole param
  sources: Record<string, string>
} {
  const prefs: Record<string, boolean | string> = {}
  const sources: Record<string, string> = {}
  const get = (name: string) => params.get(name)?.toLowerCase()
  const set = (param: string, values: Record<string, boolean | string>) => {
    Object.assign(prefs, values)
    for (const key in values) sources[key] = param
  }

  switch (get('layout')) {
    case 'plain':
      set('layout', { rooter: false })
      break
    case 'sidebyside':
      set('layout', { rooter: true, 'rooter-side': true })
      break
    case 'linebyline':
      set('layout', { rooter: true, 'rooter-side': false })
      break
  }

  switch (get('notes')) {
    case 'none':
      set('notes', { commenter: false })
      break
    case 'asterisk':
      set('notes', {
        commenter: true,
        'commenter-inline': false,
        'commenter-side': false,
      })
      break
    // Margin notes are a kind of inline note here
    case 'sidenotes':
      set('notes', {
        commenter: true,
        'commenter-inline': true,
        'commenter-side': true,
      })
      break
  }

  const script = get('script')
  if (script === 'latin' || paliScriptOf(script)) {
    set('script', { script: paliScriptOf(script)?.id ?? 'latin' })
  }

  const highlight = get('highlight')
  if (highlight === 'true' || highlight === 'false') {
    set('highlight', { highlighter: highlight === 'true' })
  }

  const refs = (get('reference') ?? '')
    .split('/')
    .filter(ref => ref === 'main' || ref === 'none' || ref in referenceEditions)
  const shown = refs.filter(ref => ref !== 'none')
  if (shown.length) {
    set('reference', {
      segmenter: true,
      'segmenter-main': shown.includes('main'),
      'segmenter-pts': shown.includes('pts'),
      'segmenter-others': shown.some(ref => ref !== 'main' && ref !== 'pts'),
    })
  } else if (refs.length) {
    set('reference', { segmenter: false })
  }

  return { prefs, sources }
}
