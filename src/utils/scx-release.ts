import { waitUntil } from 'cloudflare:workers'
import { marked } from 'marked'
import { siteMetaData } from '~/constants/meta-data'

export type AssetKind = 'archive' | 'app' | 'kiwix' | 'other'

export interface ScxAsset {
  name: string
  url: string
  /** The platform it's for, or undefined if it's for any */
  platform?: string
  format: string
  size: number
}

export interface ScxRelease {
  version: string
  /** When the newest of its files was uploaded */
  date: Date
  assets: Record<AssetKind, ScxAsset[]>
  /** The release notes' <details>, as HTML, by the downloads they're about.
   * The checksum files go in the one that mentions them */
  details: Record<AssetKind, string[]>
}

interface CodebergAsset {
  name: string
  size: number
  created_at: string
  browser_download_url: string
}

interface CodebergRelease {
  tag_name: string
  published_at: string
  body: string
  assets: CodebergAsset[]
}

const MAX_AGE = 60 * 60

const OS_NAMES: Record<string, string> = {
  android: 'Android',
  ios: 'iOS',
  linux: 'Linux',
  macos: 'macOS',
  windows: 'Windows',
}

const ARCH_NAMES: Record<string, string> = {
  aarch64: 'ARM',
  amd64: 'Intel/AMD',
  arm64: 'ARM',
  x64: 'Intel/AMD',
  x86_64: 'Intel/AMD',
}

const MAC_ARCH_NAMES: Record<string, string> = {
  aarch64: 'Apple silicon',
  arm64: 'Apple silicon',
  x64: 'Intel',
  x86_64: 'Intel',
}

/** A file's kind, platform and format, from a name like scx_app-1.8.1-macos_aarch64.dmg */
function parseAsset(asset: CodebergAsset): ScxAsset & { kind: AssetKind } {
  const { name } = asset
  const format = name.match(/(\.tar\.\w+|\.\w+)$/)?.[1] ?? ''
  const stem = name.slice(0, name.length - format.length)

  const kind: AssetKind = name.startsWith('scx_archive')
    ? 'archive'
    : name.startsWith('scx_app')
      ? 'app'
      : format === '.zim'
        ? 'kiwix'
        : 'other'

  let platform: string | undefined
  const [, os, arch] = stem.match(/-([a-z]+)(?:_(\w+))?$/i) ?? []
  const osName = os && OS_NAMES[os.toLowerCase()]
  if (osName) {
    const archNames = osName === 'macOS' ? MAC_ARCH_NAMES : ARCH_NAMES
    const archName = arch && archNames[arch.toLowerCase()]
    platform = arch ? `${osName} (${archName ?? arch})` : osName
  } else if (kind === 'other') {
    platform = name
  }

  return {
    kind,
    name,
    url: asset.browser_download_url,
    platform,
    format,
    size: asset.size,
  }
}

/** Which downloads a <details> from the release notes is about, by its summary */
function detailsKind(summary: string): AssetKind | undefined {
  if (/build info/i.test(summary)) return
  if (/archive/i.test(summary)) return 'archive'
  if (/kiwix|zim/i.test(summary)) return 'kiwix'
  if (/\bapps?\b/i.test(summary)) return 'app'
  return 'other'
}

function parseRelease(release: CodebergRelease): ScxRelease {
  const assets: ScxRelease['assets'] = {
    archive: [],
    app: [],
    kiwix: [],
    other: [],
  }
  const checksums: ScxAsset[] = []
  for (const asset of release.assets) {
    const { kind, ...parsed } = parseAsset(asset)
    if (asset.name.startsWith('SHA256SUMS')) checksums.push(parsed)
    else assets[kind].push(parsed)
  }

  const details: ScxRelease['details'] = {
    archive: [],
    app: [],
    kiwix: [],
    other: [],
  }
  const html = marked.parse(release.body ?? '', { async: false })
  const links = checksums
    .map(({ name, url }) => `<a href="${url}" download>${name}</a>`)
    .join(' · ')
  for (let [block] of html.matchAll(/<details>[\s\S]*?<\/details>/g)) {
    const summary = block.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? ''
    const kind = detailsKind(summary.replace(/<[^>]*>/g, ''))
    if (!kind) continue
    if (checksums.length && block.includes('SHA256SUMS')) {
      block = block.replace(/<\/details>$/, `<p>${links}</p></details>`)
      checksums.length = 0
    }
    details[kind].push(block.replace('<details>', '<details lang="en">'))
  }
  assets.other.push(...checksums)

  const dates = release.assets.map(({ created_at }) => Date.parse(created_at))
  return {
    version: release.tag_name.match(/^v?([\d.]+)/)?.[1] ?? release.tag_name,
    date: new Date(Math.max(Date.parse(release.published_at), ...dates)),
    assets,
    details,
  }
}

async function fetchRelease(releaseUrl: string): Promise<ScxRelease> {
  // Not there in every dev setup, where it just goes uncached
  const cache = (globalThis.caches as { default?: Cache } | undefined)?.default
  const cached = await cache?.match(releaseUrl)
  if (cached) return parseRelease(await cached.json())

  const response = await fetch(releaseUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error(`${response.status} for ${releaseUrl}`)
  const data: CodebergRelease = await response.json()
  const release = parseRelease(data)
  if (cache) {
    const copy = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${MAX_AGE}`,
      },
    })
    waitUntil(cache.put(releaseUrl, copy))
  }
  return release
}

let release: Promise<ScxRelease> | undefined
let lastGood: ScxRelease | undefined
let fetchedAt = 0

/**
 * The latest SuttaCentral Express release on Codeberg, or the last one fetched
 * if Codeberg is down. Kept for an hour per worker instance and per data centre
 */
export async function getScxRelease(): Promise<ScxRelease | undefined> {
  if (!siteMetaData.offline) return
  const releaseUrl = `${siteMetaData.offline.api}/releases/latest`

  if (!release || Date.now() - fetchedAt > MAX_AGE * 1000) {
    fetchedAt = Date.now()
    release = fetchRelease(releaseUrl)
    release.catch(() => (release = undefined))
  }
  try {
    lastGood = await release
  } catch {
    // Whatever was fetched before, if anything
  }
  return lastGood
}
