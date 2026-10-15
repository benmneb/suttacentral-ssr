import { t } from '~/i18n'

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
