/**
 * Every sample page renders, as each one is rendered from SuttaCentral's API
 * as it's requested, and a page whose data is missing fails
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fetchPages, listSome, MISSING_PAGE } from './lib/site.ts'

describe('Every sample page', () => {
  it('renders, and a missing one is a 404', async () => {
    const bad = (await fetchPages())
      .filter(
        ({ url, status }) => status !== (url === MISSING_PAGE ? 404 : 200)
      )
      .map(({ url, status }) => `${url}: ${status}`)
    assert.equal(bad.length, 0, `Pages that didn't render:\n${listSome(bad)}`)
  })
})
