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
