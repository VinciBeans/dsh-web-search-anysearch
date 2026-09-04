/**
 * Host integration against the real dsh service stack: a cordis context with
 * WebRuntime and a memory SettingsProvider, exactly the shape the built-in
 * web-search-deepseek settings tests use. Exercises the version-adaptive
 * section install, the per-search switch read, and live re-routing after a
 * section write.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as plugin from '../lib/index.js'

/** The smallest real provider: one in-memory document, always writable. */
class MemorySettings extends SettingsProvider {
  doc = {}

  get writable() {
    return true
  }

  load() {
    return Promise.resolve(structuredClone(this.doc))
  }

  persist(ns, section) {
    this.doc = { ...this.doc, [ns]: structuredClone(section) }
    return Promise.resolve()
  }
}

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

test('registers the namespace and re-routes the next search after a section write', async () => {
  const ctx = new Context()
  await ctx.plugin(WebRuntime, {})
  const settingsFiber = ctx.plugin(MemorySettings)
  await settingsFiber.await()
  const pluginFiber = ctx.plugin(plugin, plugin.Config({ apiKey: 'k', baseURL: 'https://a.example' }))
  await pluginFiber.await()

  const namespaces = ctx.settings.describe().map(row => String(row.ns))
  assert.ok(namespaces.includes('web-search-anysearch'))

  const calls = []
  const savedBase = process.env.DEEPSEEK_SEARCH_BASE_URL
  const savedKey = process.env.DEEPSEEK_API_KEY
  process.env.DEEPSEEK_SEARCH_BASE_URL = 'https://search.stored.test/v1'
  process.env.DEEPSEEK_API_KEY = 'dsk-stored'
  try {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init })
      if (String(url).includes('/v1/search')) {
        return new Response(JSON.stringify({ code: 0, data: { results: [{ url: 'https://a.test', title: 'A' }] } }), { status: 200 })
      }
      return new Response(JSON.stringify(ONE_RESULT), { status: 200 })
    }

    // Switch in force by composition: AnySearch.
    await ctx.web.search({ query: 'q' })
    assert.equal(calls[0].url, 'https://a.example/v1/search')
    assert.equal(calls[0].init.headers.authorization, 'Bearer k')

    // A card save writes the switch; the very next search uses the official
    // path (environment supplies the official endpoint and key here — with the
    // built-in DeepSeek plugin composed, its settings section does the same).
    await ctx.settings.update('web-search-anysearch', {
      searchProvider: 'deepseek-official',
    })
    await ctx.web.search({ query: 'q' })
    assert.equal(calls[1].url, 'https://search.stored.test/v1/messages')
    assert.equal(calls[1].init.headers.authorization, 'Bearer dsk-stored')

    // Switching back returns to AnySearch without re-registering the provider.
    await ctx.settings.update('web-search-anysearch', {
      searchProvider: 'anysearch',
    })
    await ctx.web.search({ query: 'q' })
    assert.equal(calls[2].url, 'https://a.example/v1/search')
  } finally {
    if (savedBase === undefined) delete process.env.DEEPSEEK_SEARCH_BASE_URL
    else process.env.DEEPSEEK_SEARCH_BASE_URL = savedBase
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY = savedKey
  }

  await ctx.fiber.dispose()
})

test('keeps running from the composition entry when the settings provider detaches', async () => {
  const ctx = new Context()
  await ctx.plugin(WebRuntime, {})
  const settingsFiber = ctx.plugin(MemorySettings)
  await settingsFiber.await()
  const pluginFiber = ctx.plugin(plugin, plugin.Config({ apiKey: 'k', baseURL: 'https://a.example' }))
  await pluginFiber.await()

  await ctx.settings.update('web-search-anysearch', { searchProvider: 'deepseek-official' })

  await settingsFiber.dispose()

  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return new Response(JSON.stringify({ code: 0, data: { results: [] } }), { status: 200 })
  }
  // The composition entry pins anysearch again after detach.
  await ctx.web.search({ query: 'q' })
  assert.equal(calls[0], 'https://a.example/v1/search')

  await pluginFiber.dispose()
  await ctx.fiber.dispose()
})
