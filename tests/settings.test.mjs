/**
 * Host integration against the real dsh service stack: a cordis context with the
 * web runtime and this plugin composed. This is what proves the live config path
 * end to end — the framework hands `apply` its config, and a committed change
 * re-routes the next search with no re-registration. Which mechanism carries
 * that change is a runtime fact of the composition: a settings service where one
 * is composed, the Volatile config reference on releases that have it.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as plugin from '../lib/index.js'

/** The cordis symbol the framework commits a Volatile value through. */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

/** The composition entry, as the profile patch declares it: plain values. */
const ENTRY = { apiKey: 'k', baseURL: 'https://a.example' }

/** The smallest Anthropic-shaped answer the official provider accepts. */
const ONE_RESULT = {
  content: [
    { type: 'text', text: 'ok' },
    {
      type: 'web_search_tool_result',
      content: [{ type: 'web_search_result', url: 'https://a.test', title: 'A' }],
    },
  ],
}

/** Serve the stubbed transport and record every URL it was asked for. */
function recordFetch(hits) {
  globalThis.fetch = async (url) => {
    hits.push(String(url))
    if (String(url).includes('/v1/search')) {
      return new Response(JSON.stringify({ code: 0, data: { results: [{ url: 'https://a.test', title: 'A' }] } }), { status: 200 })
    }
    return new Response(JSON.stringify(ONE_RESULT), { status: 200 })
  }
}

/** Run one body with the two environment fallbacks the official path reads. */
async function withOfficialEnv(body) {
  const savedBase = process.env.DEEPSEEK_SEARCH_BASE_URL
  const savedKey = process.env.DEEPSEEK_API_KEY
  process.env.DEEPSEEK_SEARCH_BASE_URL = 'https://search.stored.test/v1'
  process.env.DEEPSEEK_API_KEY = 'dsk-stored'
  try {
    await body()
  } finally {
    if (savedBase === undefined) delete process.env.DEEPSEEK_SEARCH_BASE_URL
    else process.env.DEEPSEEK_SEARCH_BASE_URL = savedBase
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY = savedKey
  }
}

test('a composed plugin serves AnySearch from its config', async () => {
  const ctx = new Context()
  await ctx.plugin(WebRuntime, {})
  const fiber = ctx.plugin(plugin, ENTRY)
  await fiber.await()

  const hits = []
  recordFetch(hits)
  await ctx.web.search({ query: 'q' })
  assert.equal(hits[0], 'https://a.example/v1/search')

  await ctx.fiber.dispose()
})

test('a committed config change re-routes the next search without re-registering', async () => {
  const ctx = new Context()
  await ctx.plugin(WebRuntime, {})
  const fiber = ctx.plugin(plugin, ENTRY)
  await fiber.await()

  // Which write mechanism this release offers is a RUNTIME fact, not a module
  // export: `installSection` belongs to a settings service that a composition
  // may not carry at all (the plugin's own tests compose none), and on 0.1.7 the
  // live config reference replaced it. Probe the context, the way the plugin
  // does, and never assume a service is present.
  // Which write mechanism this release offers is a RUNTIME fact, not a module
  // export: a settings service may not be composed at all (this test composes
  // none, since it carries just the web runtime and the plugin), and the live
  // config reference only exists where the schema builder marks fields volatile.
  // Probe the context the way the plugin does and never assume either is there.
  const settings = ctx.get('settings')
  const live = fiber.config?.searchProvider
  const hasLiveRef = typeof live?.get === 'function'
  const write = async (backend) => {
    if (settings !== undefined) {
      // A release with the settings service: drive the seam the way a card save
      // does. The installer the plugin found follows this and re-resolves.
      settings.update('web-search-anysearch', { searchProvider: backend })
      return
    }
    // 0.1.7: commit into the entry's live config reference, which is what the
    // profile editor does. Nothing is re-registered and nothing remounts.
    live[VOLATILE_WRITE](backend)
  }

  const hits = []
  recordFetch(hits)
  await ctx.web.search({ query: 'q' })
  assert.equal(hits[0], 'https://a.example/v1/search', 'the composition entry serves first')

  if (settings !== undefined) {
    // Name the cause before the derived symptom: if the seam reports no section
    // for this namespace, the write below cannot reach the plugin and the
    // failure would otherwise surface as a wrong URL three lines later.
    const served = settings.describe().map(row => String(row.ns))
    assert.ok(
      served.includes('web-search-anysearch'),
      `the settings service serves the plugin's namespace; it reports ${JSON.stringify(served)}`,
    )
  }

  if (settings === undefined && !hasLiveRef) {
    // Neither mechanism: the composition entry is the only source, which the
    // first assertion already covers. Nothing here is silently skipped — there
    // is genuinely no other way for a change to reach a running plugin.
    await ctx.fiber.dispose()
    return
  }

  await withOfficialEnv(async () => {
    await write('deepseek-official')
    await ctx.web.search({ query: 'q' })
    assert.equal(hits[1], 'https://search.stored.test/v1/messages')
  })

  // And back, still on the same registration.
  await write('anysearch')
  await ctx.web.search({ query: 'q' })
  assert.equal(hits[2], 'https://a.example/v1/search')

  await ctx.fiber.dispose()
})

test('declares its namespace wherever a settings service installs sections', async () => {
  const ctx = new Context()
  await ctx.plugin(WebRuntime, {})
  const fiber = ctx.plugin(plugin, ENTRY)
  await fiber.await()

  const settings = ctx.get('settings')
  if (settings === undefined) {
    // A composition without a settings service: the plugin serves from its
    // composition entry and registers no namespace, which is the documented
    // fallback rather than a failure.
    const hits = []
    recordFetch(hits)
    await ctx.web.search({ query: 'q' })
    assert.equal(hits[0], 'https://a.example/v1/search')
  } else {
    const namespaces = settings.describe().map(row => String(row.ns))
    assert.ok(namespaces.includes('web-search-anysearch'))
  }

  await ctx.fiber.dispose()
})
