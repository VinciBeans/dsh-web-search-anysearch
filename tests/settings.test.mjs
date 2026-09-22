/**
 * Host integration against the real dsh service stack: a cordis context with the
 * web runtime and this plugin composed. On `0.1.7-alpha.1` and later this is
 * what proves the live config path end to end — the framework hands `apply`
 * Volatile references, and committing a new value into one re-routes the next
 * search with no re-registration. On releases that still carry the section
 * installer (`<= 0.1.6-alpha.2`) the same test asserts the installed namespace.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import * as settingsSdk from '@deepseek-ai/dsh-settings'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as plugin from '../lib/index.js'

/** The cordis symbol the framework commits a Volatile value through. */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write')

/** Whether the installed dsh still carries a section-installer seam. */
const HAS_SECTION_INSTALLER = typeof settingsSdk.SettingsProvider === 'function'
  || typeof settingsSdk.SettingsForms?.prototype?.installSection === 'function'

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

  const hits = []
  recordFetch(hits)
  await ctx.web.search({ query: 'q' })
  assert.equal(hits[0], 'https://a.example/v1/search', 'the composition entry serves first')

  await withOfficialEnv(async () => {
    // What the profile editor does: commit a new value into the entry's live
    // config reference. Nothing is re-registered and the plugin is not remounted.
    const live = fiber.config.searchProvider
    if (typeof live?.get === 'function') {
      live[VOLATILE_WRITE]('deepseek-official')
    } else {
      // A release without Volatile config resolves the section through the
      // settings service instead; the refactor that removed it also removed
      // `HAS_SECTION_INSTALLER`, so this branch is the legacy installer path.
      assert.equal(HAS_SECTION_INSTALLER, true, 'no live config reference and no installer')
      await ctx.settings.update('web-search-anysearch', { searchProvider: 'deepseek-official' })
    }
    await ctx.web.search({ query: 'q' })
    assert.equal(hits[1], 'https://search.stored.test/v1/messages')
  })

  // And back, still on the same registration.
  const live = fiber.config.searchProvider
  if (typeof live?.get === 'function') live[VOLATILE_WRITE]('anysearch')
  else await ctx.settings.update('web-search-anysearch', { searchProvider: 'anysearch' })
  await ctx.web.search({ query: 'q' })
  assert.equal(hits[2], 'https://a.example/v1/search')

  await ctx.fiber.dispose()
})

test('declares its namespace where the settings seam still installs sections', async () => {
  if (!HAS_SECTION_INSTALLER) {
    // 0.1.7-alpha.1 removed the seam; the live config reference is the source,
    // and the derived form comes from the schema's volatile fields instead.
    assert.equal(typeof settingsSdk.SettingsForms, 'function')
    return
  }
  const ctx = new Context()
  await ctx.plugin(WebRuntime, {})
  const fiber = ctx.plugin(plugin, ENTRY)
  await fiber.await()
  const namespaces = ctx.settings.describe().map(row => String(row.ns))
  assert.ok(namespaces.includes('web-search-anysearch'))
  await ctx.fiber.dispose()
})
