/**
 * Converts a string to sentence case.
 *
 * Sentence case means the first letter of the string and the first letter
 * after sentence-ending punctuation (., !, ?) are capitalized, while all
 * other letters are lowercase.
 *
 * @param str - The string to convert to sentence case
 * @returns The sentence-cased string
 */
export function toSentenceCase(str: string): string {
  if (!str) return str

  return str
    .toLowerCase()
    .replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, match => match.toUpperCase())
}

export function uidToAcronym(uidInput: string) {
  if (!uidInput) return ''
  // I think it's only AN and Dhp that have range suttas, but anyway...
  return String(uidInput).replace(
    /^([a-zA-Z]+)(.*)$/,
    (_, l, n) => l.toUpperCase().replace('DHP', 'Dhp') + ' ' + n
  ) // eg "AN 1.1", "Dhp 1"...
}

export function uidToTitle(uidInput: string) {
  if (uidInput.includes('.')) return uidInput.split('.')[1] // "AN 1.1" -> "1" as per .net
  return uidToAcronym(uidInput).split('Dhp ')[1] // just the number too (.net just leaves the chapter title...)
}
