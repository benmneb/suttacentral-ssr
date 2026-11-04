/**
 * The scripts Pali root text can be shown in, as .net's `scriptIdentifiers`
 * in sc-aksharamukha-converter.js has them, but only the ones devices ship a
 * font for. Latin, the text as stored, is the default and isn't listed.
 *
 * `id` and `options` go to the API's `transliterated_sutta`, `tag` is the
 * ISO 15924 subtag for the text's `lang`
 */
export const PALI_SCRIPTS: {
  id: string
  label: string
  tag: string
  options?: string
}[] = [
  { id: 'Bengali', label: 'Bengali (Bangla)', tag: 'Beng' },
  { id: 'Burmese', label: 'Burmese (Myanmar)', tag: 'Mymr' },
  { id: 'RussianCyrillic', label: 'Cyrillic (Russian)', tag: 'Cyrl' },
  { id: 'Devanagari', label: 'Devanagari', tag: 'Deva' },
  { id: 'Gujarati', label: 'Gujarati', tag: 'Gujr' },
  { id: 'Hiragana', label: 'Japanese (Hiragana)', tag: 'Hira' },
  { id: 'Katakana', label: 'Japanese (Katakana)', tag: 'Kana' },
  { id: 'Kannada', label: 'Kannada', tag: 'Knda' },
  { id: 'Khmer', label: 'Khmer (Cambodian)', tag: 'Khmr' },
  { id: 'Lao', label: 'Lao', tag: 'Laoo' },
  { id: 'Malayalam', label: 'Malayalam', tag: 'Mlym' },
  { id: 'Oriya', label: 'Oriya', tag: 'Orya' },
  { id: 'Gurmukhi', label: 'Punjabi (Gurmukhi)', tag: 'Guru' },
  {
    id: 'Sinhala',
    label: 'Sinhala (modern)',
    tag: 'Sinh',
    options: 'SinhalaPali, SinhalaConjuncts',
  },
  { id: 'Tamil', label: 'Tamil', tag: 'Taml' },
  { id: 'Telugu', label: 'Telugu', tag: 'Telu' },
  { id: 'Thai', label: 'Thai', tag: 'Thai' },
  { id: 'Tibetan', label: 'Tibetan', tag: 'Tibt' },
]

/** The listed script a name is, in any case, or undefined for Latin or none */
export function paliScriptOf(name: unknown) {
  if (typeof name !== 'string') return undefined
  const lower = name.toLowerCase()
  return PALI_SCRIPTS.find(script => script.id.toLowerCase() === lower)
}
