/**
 * Every sample page has no accessibility problems axe-core can find, by WCAG
 * 2.2 A and AA and axe's best practices, and by AAA with more contrast.
 *
 * Each runs in a headless browser, at a phone's width, then in light and dark
 * mode, and with `prefers-contrast: more`. Uses Brave or Chrome, whichever is
 * installed, or `BROWSER_PATH`, or else downloads Chrome Headless Shell into
 * `node_modules/.cache` once.
 */

import { Browser, install } from '@puppeteer/browsers'
import axe from 'axe-core'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import puppeteer, { type HTTPRequest, type Page } from 'puppeteer-core'
import { PUPPETEER_REVISIONS } from 'puppeteer-core/internal/revisions.js'
import { listSome, origin, samplePages } from './lib/site.ts'

const TABS = 4

const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
]
// Only AAA where there's more contrast, as the other runs cover the rest
const MORE_CONTRAST_TAGS = ['wcag2aaa']

const VARIANTS = [
  { name: 'phone', width: 375, height: 812, scheme: 'light', tags: AXE_TAGS },
  { name: 'light', scheme: 'light', open: true, tags: AXE_TAGS },
  { name: 'dark', scheme: 'dark', tags: AXE_TAGS },
  {
    name: 'light, more contrast',
    scheme: 'light',
    contrast: 'more',
    tags: MORE_CONTRAST_TAGS,
  },
  {
    name: 'dark, more contrast',
    scheme: 'dark',
    contrast: 'more',
    tags: MORE_CONTRAST_TAGS,
  },
].map(variant => ({ width: 1280, height: 800, ...variant }))

const BROWSERS = [
  process.env.BROWSER_PATH,
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

type Problem = { rule: string; place: string }

/** The Chrome Headless Shell puppeteer-core is made for, downloaded the first time */
async function downloadBrowser() {
  const { executablePath } = await install({
    browser: Browser.CHROMEHEADLESSSHELL,
    buildId: PUPPETEER_REVISIONS['chrome-headless-shell'],
    cacheDir: join('node_modules', '.cache', 'puppeteer'),
  })
  return executablePath
}

/** Each axe violation on a page, as one string per element, or why it didn't load */
async function violationsOn(
  page: Page,
  url: string,
  pending: Set<HTTPRequest>
): Promise<Problem[]> {
  const found: Problem[] = []
  let width = 0
  for (const variant of VARIANTS) {
    // Loaded again, as resizing a long text lays it out slower than that
    if (variant.width !== width) {
      width = variant.width
      await page.goto('about:blank')
      await page.setViewport({ width, height: variant.height })
      pending.clear()
      try {
        await page.goto(`${origin()}${url}`, { waitUntil: 'domcontentloaded' })
        await page.waitForNetworkIdle({ idleTime: 250 })
      } catch (error) {
        const waiting = [...pending].map(request => request.url()).join(' ')
        found.push({
          rule: `Didn't load: ${(error as Error).message}`,
          place: `${url} [${variant.name}] waiting on ${waiting || 'nothing'}`,
        })
        return found
      }
      await page.addScriptTag({ content: axe.source })
    }
    await page.emulateMediaFeatures([
      { name: 'prefers-color-scheme', value: variant.scheme },
      { name: 'prefers-contrast', value: variant.contrast ?? 'no-preference' },
    ])
    if (variant.open) {
      await page.evaluate(() => {
        for (const details of document.querySelectorAll('details')) {
          details.open = true
        }
      })
    }
    const { violations } = await page.evaluate(
      tags => axe.run(document, { runOnly: { type: 'tag', values: tags } }),
      variant.tags
    )
    for (const { id, impact, help, helpUrl, nodes } of violations) {
      for (const node of nodes) {
        found.push({
          rule: `${id} (${impact}): ${help} ${helpUrl}`,
          place: `${url} [${variant.name}] ${node.target.join(' ')}`,
        })
      }
    }
  }
  return found
}

describe('Accessibility', () => {
  const urls = samplePages()
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined
  let profile: string | undefined

  before(async () => {
    profile = await mkdtemp(join(tmpdir(), 'scx-axe-'))
    const executablePath =
      BROWSERS.find(file => file && existsSync(file)) ??
      (await downloadBrowser())
    const server = new URL(origin()).hostname
    browser = await puppeteer.launch({
      executablePath,
      userDataDir: profile,
      headless: true,
      args: [
        // Nothing off the site, ie the analytics, so tests never count as visits
        `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${server}`,
        '--no-proxy-server',
      ],
    })
  })

  after(async () => {
    await browser?.close()
    if (profile) await rm(profile, { recursive: true, force: true })
  })

  it(
    `has no axe violations on ${urls.length} pages`,
    { timeout: 30 * 60 * 1000 },
    async () => {
      const queue = [...urls]
      const retried = new Set<string>()
      const found: Problem[] = []
      const openTab = async () => {
        const page = await browser!.newPage()
        const pending = new Set<HTTPRequest>()
        page.on('request', request => pending.add(request))
        page.on('requestfinished', request => pending.delete(request))
        page.on('requestfailed', request => pending.delete(request))
        return { page, pending }
      }
      const next = async () => {
        let tab = await openTab()
        for (let url; browser!.connected && (url = queue.shift()); ) {
          try {
            found.push(...(await violationsOn(tab.page, url, tab.pending)))
          } catch (error) {
            // Tabs die now and then under load, so one more go before it counts
            if (retried.has(url)) {
              found.push({
                rule: `Couldn't check: ${(error as Error).message}`,
                place: url,
              })
            } else {
              retried.add(url)
              queue.push(url)
            }
            // A crashed tab can't load the next page
            if (browser!.connected) {
              await tab.page.close().catch(() => {})
              tab = await openTab()
            }
          }
        }
        if (browser!.connected) await tab.page.close()
      }
      await Promise.all(Array.from({ length: TABS }, next))
      if (queue.length > 0) {
        found.push({
          rule: `The browser closed, so ${queue.length} pages weren't checked`,
          place: queue[0],
        })
      }

      const byRule = Map.groupBy(found, ({ rule }) => rule)
      const report = [...byRule]
        .sort(([, a], [, b]) => b.length - a.length)
        .map(
          ([rule, items]) =>
            `${rule} (${items.length})\n${items
              .slice(0, 5)
              .map(({ place }) => `    ${place}`)
              .join('\n')}`
        )
      assert.equal(
        byRule.size,
        0,
        `${byRule.size} kinds of accessibility problem:\n${listSome(report, 30)}`
      )
    }
  )
})
