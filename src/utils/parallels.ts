import { t } from '~/i18n'
import { parseUidNumbers, uidIsInRange } from '~/utils/strings'

/**
 * "dn1#1.9.1" -> "#1.9.1", "dn1" -> ""
 */
export function getHashFragment(key: string): string {
  if (key.includes('#')) {
    return '#' + key.split('#')[1]
  }
  return ''
}

/**
 * A key of /api/parallels, split into the text it names and the part of it
 *
 * "dn1" -> { base: "dn1" }
 * "dn1#1.9.1" -> { base: "dn1", start: "1.9.1", end: "1.9.1" }
 * "dn16#3.1.1-#4.23.1" -> { base: "dn16", start: "3.1.1", end: "4.23.1" }
 * "snp1.1#vns6" -> { base: "snp1.1", start: "vns6", end: "vns6" }, a reference
 */
export function parseParallelKey(key: string): {
  base: string
  start?: string
  end?: string
} {
  const [base, ...rest] = key.split('#')
  if (!rest.length) return { base }
  // References can have hyphens of their own (pts-vp-pli1)
  const part = rest.join('#')
  const [start, end = start] = part.includes('-#')
    ? part.split('-#')
    : /^[\d.]+-[\d.]+$/.test(part)
      ? part.split('-')
      : [part]
  return { base, start, end }
}

/** Strongest first, which is the one a passage with several is shown as */
export const PARALLEL_TYPES = ['full', 'retelling', 'mention'] as const

export function parallelTypeTitle(locale: string, type: string): string {
  switch (type) {
    case 'full':
      return t(locale, 'suttaplex:fullParallel')
    case 'mention':
      return t(locale, 'suttaplex:mention')
    case 'retelling':
      return t(locale, 'suttaplex:retellingParallel')
    case 'resembling': // ¿¿what texts have this??
      return t(locale, 'suttaplex:resemblingParallel')
    default:
      return ''
  }
}

// The API returns parallels in no particular order (sn1.20#20.1 before
// sn1.20#2.1-#3.1, dhp10 before dhp2), so keys are compared as numbers:
// the whole sutta, then #2.1, #20.1, #21.1...
const parallelsCollator = new Intl.Collator('en', { numeric: true })

/**
 * The keys of an /api/parallels response in order, each with its parallels.
 * Given the uid of a sutta inside a range, keeps only the keys touching it
 */
export function parallelSegments(
  parallelsData: any,
  rangeSuttaUid?: string
): [string, any[]][] {
  // Filter out metadata entries
  const segments = Object.entries(parallelsData ?? {})
    .filter(([key]) => !key.startsWith('_scx_'))
    .sort(([a], [b]) => parallelsCollator.compare(a, b)) as [string, any[]][]

  if (!rangeSuttaUid) return segments

  return segments.filter(([k]) => {
    // Direct matches, and start of range
    if (
      k === rangeSuttaUid ||
      k.startsWith(`${rangeSuttaUid}-`) ||
      k.startsWith(`${rangeSuttaUid}#`)
    ) {
      return true
    }

    // Check if uid is at the END of a range
    // So if uid is dhp20, will match dhp*-20, and if uid is an1.197, will match an1.*-197, and both with # links
    const uidPrefix = rangeSuttaUid.split(/(\d+)/)[0]
    const uidEndNum = rangeSuttaUid.match(/\d+$/)?.[0]
    if (
      uidEndNum &&
      new RegExp(`^${uidPrefix}(\\d+)(\\.\\d+)?-${uidEndNum}(#.*)?$`).test(k)
    ) {
      return true
    }

    // Check if uid is WITHIN a range (an1.1 matches an1.1-5, dhp2 matches dhp1-3)
    if (uidIsInRange(rangeSuttaUid, k.split('#')[0])) return true

    return false
  })
}

/**
 * Where a key of /api/parallels points, in the root text.
 *
 * The key says which span of this text the parallel covers. That span can run
 * across two suttas - sn36.31 is keyed sn36.30-31, because the parallel covers
 * the pair - and such a span is no uid at all, so it gets swapped for the text
 * on screen, as on .net. A key naming one sutta is kept, so the rows of a range
 * page like /an1.170-187 still point at an1.173, an1.174 and so on, one each
 */
export function parallelHref(
  segmentKey: string,
  onScreenUid: string,
  rootTrans: { lang: string; author_uid: string }
): string {
  const base = segmentKey.split('#')[0]
  const span = parseUidNumbers(base)
  const uid = span && span.start !== span.end ? onScreenUid : base
  return `/${uid}/${rootTrans.lang}/${rootTrans.author_uid}${getHashFragment(segmentKey)}`
}
