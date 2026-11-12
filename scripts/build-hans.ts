/**
 * Writes the simplified form of each traditional Chinese character, and the
 * phrases OpenCC simplifies otherwise, for the text page's "Simplified"
 * setting and word lookup on it.
 *
 * Run: pnpm build-hans
 */

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = join(__dirname, '..', 'src', 'constants', 'hans.json')
// A release, so the output only changes along with this
const OPENCC =
  'https://raw.githubusercontent.com/BYVoid/OpenCC/ver.1.4.2/data/dictionary'

/** Each entry's first simplified form, as OpenCC converts to */
async function fetchDictionary(name: string): Promise<[string, string][]> {
  const response = await fetch(`${OPENCC}/${name}.txt`)
  if (!response.ok) {
    throw new Error(`${name}: ${response.status} ${response.statusText}`)
  }
  return (await response.text())
    .split('\n')
    .filter(line => line.includes('\t'))
    .map(line => {
      const [traditional, simplified] = line.split('\t')
      return [traditional, simplified.split(' ')[0]]
    })
}

const chars: Record<string, string> = {}
for (const [char, simplified] of await fetchDictionary('TSCharacters')) {
  // Not one that changes length, so the page's text offsets stay the same, ie 絺 as 𫄨
  if (simplified !== char && simplified.length === char.length) {
    chars[char] = simplified
  }
}

const byChar = (text: string) =>
  text.replace(/\p{Script=Han}/gu, char => chars[char] ?? char)

// Only those that differ from their characters, ie 尼乾子 keeps the 乾 that's 干 on its own
const phrases: Record<string, string> = {}
for (const [phrase, simplified] of await fetchDictionary('TSPhrases')) {
  if (simplified.length === phrase.length && simplified !== byChar(phrase)) {
    phrases[phrase] = simplified
  }
}

await writeFile(OUTPUT, `${JSON.stringify({ chars, phrases }, null, 2)}\n`)
console.log(
  `Wrote ${Object.keys(chars).length} characters and ${Object.keys(phrases).length} phrases to src/constants/hans.json`
)
