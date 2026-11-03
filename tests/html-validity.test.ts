/**
 * Every sample page is valid HTML, with no errors or warnings from the Nu
 * validator, the checker validator.w3.org/nu runs.
 *
 * It's a Java program, so it uses Java 11+ from the PATH, or else downloads a Java
 * runtime into `node_modules` once. `JAVA` or `JAVA_HOME` point at another.
 */

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { describe, it } from 'node:test'
import vnuJar from 'vnu-jar'
import javaDownloader from 'vnu-jar/vnu-java-downloader.js'
import { fetchPages, listSome } from './lib/site.ts'

// SuttaCentral's data has some, ie Bengali names, and normalising every response would cost CPU time
const NOT_NFC = /^Text run is not in Unicode Normalization Form C/

type Message = {
  type: string
  subType?: string
  message: string
  url?: string
  lastLine?: number
  extract?: string
}

/** Runs a command, resolving to its exit code and stdout */
function run(command: string, args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      const out: Buffer[] = []
      const err: Buffer[] = []
      child.stdout.on('data', chunk => out.push(chunk))
      child.stderr.on('data', chunk => err.push(chunk))
      child.on('error', reject)
      child.on('close', code =>
        resolve({
          code,
          stdout: Buffer.concat(out).toString(),
          stderr: Buffer.concat(err).toString(),
        })
      )
    }
  )
}

/** `JAVA` or `JAVA_HOME`'s Java if it runs, else a Java 11+ on the PATH or one vnu-jar downloads */
async function findJava(): Promise<string> {
  const candidates = [
    process.env.JAVA,
    process.env.JAVA_HOME && join(process.env.JAVA_HOME, 'bin', 'java'),
  ].filter(Boolean) as string[]
  for (const java of candidates) {
    const { code } = await run(java, ['-version']).catch(() => ({ code: 1 }))
    if (code === 0) return java
  }
  return javaDownloader.resolveJava()
}

/** The validator's messages for some files */
async function validate(java: string, files: string[]): Promise<Message[]> {
  const { stdout, stderr } = await run(java, [
    // Not the 512k the validator suggests, which overflows on newer Javas
    '-Xss4m',
    '-Xmx1g',
    '-jar',
    String(vnuJar),
    // Not its guess at the language, as the interface's and a text's can differ
    '--no-langdetect',
    '--format',
    'json',
    '--stdout',
    ...files,
  ])
  try {
    return JSON.parse(stdout).messages
  } catch {
    throw new Error(`The validator didn't give JSON:\n${stderr || stdout}`)
  }
}

describe('Every sample page’s HTML', () => {
  it('passes the Nu validator', { timeout: 10 * 60 * 1000 }, async () => {
    const java = await findJava().catch(error => {
      throw new Error(
        `Couldn't download Java for the Nu validator, so install Java 11+ or set JAVA: ${error.message}`
      )
    })

    const pages = await fetchPages()
    const dir = await mkdtemp(join(tmpdir(), 'scx-vnu-'))
    const urlOf = new Map<string, string>()
    try {
      const files = await Promise.all(
        pages.map(async ({ url, html }, i) => {
          const file = join(dir, `${i}.html`)
          urlOf.set(`${i}.html`, url)
          await writeFile(file, html)
          return file
        })
      )

      // Problems by message, with how many there are and where the first few are
      const byMessage = new Map<string, { count: number; places: string[] }>()
      for (const message of await validate(java, files)) {
        if (message.type !== 'error' && message.subType !== 'warning') continue
        if (NOT_NFC.test(message.message)) continue
        const key = `${message.subType ?? message.type}: ${message.message}`
        if (!byMessage.has(key)) byMessage.set(key, { count: 0, places: [] })
        const problem = byMessage.get(key)!
        problem.count++
        if (problem.places.length >= 5) continue
        const url = message.url && urlOf.get(basename(message.url))
        const extract = message.extract?.replace(/\s+/g, ' ').trim() ?? ''
        problem.places.push(
          `${url ?? '?'}:${message.lastLine ?? '?'} ${extract}`
        )
      }

      const report = [...byMessage]
        .sort(([, a], [, b]) => b.count - a.count)
        .map(
          ([key, { count, places }]) =>
            `${key} (${count})\n${places.map(place => `    ${place}`).join('\n')}`
        )
      assert.equal(
        byMessage.size,
        0,
        `${byMessage.size} kinds of HTML problem in ${pages.length} pages:\n${listSome(report, 30)}`
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
