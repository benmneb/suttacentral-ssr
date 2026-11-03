/**
 * Starts `astro preview` of the last build on a free port for the tests, and
 * stops it after. `TEST_ORIGIN=https://…` tests that server instead.
 *
 * The server runs in a child process, run as `node tests/lib/setup.ts <port>`,
 * as the test runner only tears down once nothing in its own process is open.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const START_TIMEOUT = 60_000

let child: ChildProcess | undefined

async function freePort(): Promise<number> {
  const probe = createServer()
  await new Promise<void>(listening => probe.listen(0, '127.0.0.1', listening))
  const { port } = probe.address() as { port: number }
  await new Promise(closed => probe.close(closed))
  return port
}

async function serve(port: number) {
  process.env.ASTRO_TELEMETRY_DISABLED = '1'
  const { preview } = await import('astro')
  const server = await preview({
    root: ROOT,
    logLevel: 'warn',
    server: { host: '127.0.0.1', port },
  })
  process.on('SIGTERM', async () => {
    await server.stop()
    process.exit()
  })
}

export async function globalSetup() {
  if (process.env.TEST_ORIGIN) return
  const port = await freePort()
  const args = [fileURLToPath(import.meta.url), String(port)]
  child = spawn(process.execPath, args, {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  child.unref()
  const origin = `http://127.0.0.1:${port}`
  const started = Date.now()
  const isUp = () => fetch(origin).then(Boolean, () => false)
  while (!(await isUp())) {
    if (child.exitCode !== null || Date.now() - started > START_TIMEOUT) {
      throw new Error(
        `astro preview didn't start on ${origin}. Was there a pnpm build?`
      )
    }
    await new Promise(wait => setTimeout(wait, 250))
  }
  process.env.TEST_ORIGIN = origin
}

export async function globalTeardown() {
  child?.kill()
}

if (import.meta.main) await serve(Number(process.argv[2]))
