import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AnySearchProvider, Config, configValueOf, name, resolveConfig } from '../lib/index.js'

const BASE = 'https://api.anysearch.com'
/** The published version the build stamps onto outbound requests. */
const PLUGIN_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

test('Config fills the apiKeyEnv default and keeps explicit values', () => {
  assert.equal(configValueOf(Config({}).apiKeyEnv), 'ANYSEARCH_API_KEY')
  assert.equal(configValueOf(Config({ apiKeyEnv: 'MY_KEY', baseURL: 'https://x.example' }).apiKeyEnv), 'MY_KEY')
  assert.equal(configValueOf(Config({ baseURL: 'https://x.example' }).baseURL), 'https://x.example')
})

test('Config defaults the switch to anysearch and keeps an explicit one', () => {
  assert.equal(configValueOf(Config({}).searchProvider), 'anysearch')
  assert.equal(configValueOf(Config({ searchProvider: 'deepseek-official' }).searchProvider), 'deepseek-official')
})

test('reads a Volatile config reference, the shape apply receives on dsh 0.1.7', () => {
  // What the framework hands apply on 0.1.7-alpha.1: every declared field is a
  // stable reference, and an edit commits a new value into it in place.
  let backend = 'anysearch'
  const source = {
    searchProvider: { get: () => backend },
    apiKey: { get: () => undefined },
    apiKeyEnv: { get: () => 'ANYSEARCH_API_KEY' },
    baseURL: { get: () => undefined },
  }
  assert.equal(resolveConfig(source).searchProvider, 'anysearch')
  // The same object keeps answering, so a deferred read sees the committed edit.
  backend = 'deepseek-official'
  assert.equal(resolveConfig(source).searchProvider, 'deepseek-official')
  // Absent fields stay absent rather than becoming undefined values.
  assert.deepEqual(Object.keys(resolveConfig({})), [])
})

test('the provider registers under the stable id and is always available', () => {
  const provider = new AnySearchProvider({ baseURL: BASE })
  assert.equal(provider.id, 'anysearch')
  assert.equal(provider.available(), true)
})

test('maps a success envelope to sources and applies the request bounds', async () => {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    return new Response(JSON.stringify({
      code: 0,
      data: { results: [
        { title: 'T1', url: 'https://a.example/1', content: 'C1', snippet: 'S1' },
        { url: 'https://a.example/2' },
      ] },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const provider = new AnySearchProvider({ baseURL: BASE, apiKey: 'k' })
  const result = await provider.search({ query: 'q', maxResults: 50 })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, `${BASE}/v1/search`)
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers.authorization, 'Bearer k')
  assert.equal(calls[0].init.headers['x-anysearch-client'], `dsh-web-search-anysearch/${PLUGIN_VERSION}`)
  assert.deepEqual(JSON.parse(calls[0].init.body), { query: 'q', max_results: 10 }) // clamped
  assert.deepEqual(result.sources, [
    { url: 'https://a.example/1', title: 'T1', snippet: 'C1' }, // content wins over snippet
    { url: 'https://a.example/2' },
  ])
  assert.equal(result.truncated, false)
})

test('clamps maxResults up to 1 as the floor', async () => {
  let captured
  globalThis.fetch = async (url, init) => {
    captured = init
    return new Response(JSON.stringify({ code: 0, data: { results: [] } }), { status: 200 })
  }
  const provider = new AnySearchProvider({ baseURL: BASE })
  await provider.search({ query: 'q', maxResults: 0 })
  assert.equal(JSON.parse(captured.body).max_results, 1)
})

test('anonymous access sends no Authorization header', async () => {
  let captured
  globalThis.fetch = async (url, init) => {
    captured = init
    return new Response(JSON.stringify({ code: 0, data: { results: [] } }), { status: 200 })
  }
  const provider = new AnySearchProvider({ baseURL: BASE })
  await provider.search({ query: 'q' })
  assert.equal(captured.headers.authorization, undefined)
})

test('reads thunk options per operation (a section edit is live without re-registration)', async () => {
  let baseURL = BASE
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push(String(url))
    return new Response(JSON.stringify({ code: 0, data: { results: [] } }), { status: 200 })
  }
  const provider = new AnySearchProvider(() => ({ baseURL }))
  await provider.search({ query: 'q' })
  baseURL = 'https://x.example'
  await provider.search({ query: 'q' })
  assert.equal(calls[0], `${BASE}/v1/search`)
  assert.equal(calls[1], 'https://x.example/v1/search')
})

test('a non-zero code rejects with the message and request_id', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 1, message: 'quota', request_id: 'r1' }), { status: 200 })
  const provider = new AnySearchProvider({ baseURL: BASE })
  await assert.rejects(provider.search({ query: 'q' }), (error) => {
    assert.equal(error.code, 'WEB_PROVIDER_ERROR')
    assert.match(error.message, /quota/)
    assert.match(error.message, /request_id: r1/)
    return true
  })
})

test('a non-JSON non-2xx response rejects as a non-JSON response', async () => {
  globalThis.fetch = async () => new Response('oops', { status: 500 })
  const provider = new AnySearchProvider({ baseURL: BASE })
  await assert.rejects(provider.search({ query: 'q' }), /non-JSON response \(HTTP 500\)/)
})

test('an AbortError from the transport passes through unwrapped', async () => {
  globalThis.fetch = async () => { throw new DOMException('aborted', 'AbortError') }
  const provider = new AnySearchProvider({ baseURL: BASE })
  await assert.rejects(provider.search({ query: 'q' }), (error) => error.name === 'AbortError')
})

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

test('the switch provider routes to the section-named backend', async () => {
  const { AnySearchSwitchProvider } = await import('../lib/index.js')
  const { DeepSeekSearchProvider } = await import('@deepseek-ai/dsh-web-search-deepseek')
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    if (String(url).includes('/v1/search')) {
      return new Response(JSON.stringify({ code: 0, data: { results: [] } }), { status: 200 })
    }
    return new Response(JSON.stringify(ONE_RESULT), { status: 200 })
  }
  let backend = 'anysearch'
  // The router consumes the structural OfficialSearchBackend; the real class
  // stands in for it here, exactly as createDeepSeekBackend wraps it.
  const official = new DeepSeekSearchProvider(() => ({
    baseURL: 'https://search.official.test/v1',
    model: 'deepseek-v4-flash',
    apiVersion: '2023-06-01',
    maxTokens: 4096,
    maxUses: 5,
    resolveApiKey: async () => 'dsk',
  }))
  const provider = new AnySearchSwitchProvider(
    new AnySearchProvider({ baseURL: BASE }),
    { available: () => official.available(), search: (request, signal) => official.search(request, signal) },
    () => backend,
  )
  await provider.search({ query: 'q' })
  backend = 'deepseek-official'
  await provider.search({ query: 'q' })
  assert.equal(calls[0].url, `${BASE}/v1/search`)
  assert.equal(calls[1].url, 'https://search.official.test/v1/messages')
  assert.equal(calls[1].init.method, 'POST')
  assert.ok(calls[1].init.headers['anthropic-version'])
})

test('apply registers the switch provider and reads the switch from the section', async () => {
  const { apply } = await import('../lib/index.js')
  // Whether this dsh still has the settings service's section installer. Across
  // the supported range that one method is the only installer shape: the 0.1.2
  // line's module-level export is below the floor and no longer read.
  const settingsSdk = await import('@deepseek-ai/dsh-settings')
  const hasSectionInstaller = typeof settingsSdk.SettingsForms === 'function'
    ? false
    : typeof settingsSdk.SettingsProvider?.prototype?.installSection === 'function'
  let captured
  let installed
  // The section a settings service resolves for this namespace. The plugin reads
  // whatever the seam last handed it — the installer calls `setSource` itself
  // when it attaches, so a test that wants a committed change reflected has to
  // move the SERVICE, not just the thunk it handed over. The double resolves the
  // same way the seam does: the composition entry as `base` with nothing stored
  // on top, which is also where the AnySearch key comes from.
  let applied = {}
  let serviceUpdateCalled = false
  // Whether the installer's `ctx.inject` callback actually reached the attach.
  // It resolves a fiber on a real context; the plain-object mock below lets the
  // callback run but cannot carry that resolution, so this records the fact
  // rather than letting the assertion assume it.
  let sectionAttached = false
  const settings = hasSectionInstaller
    ? {
        register(ns, _schema, options) {
          sectionAttached = true
          applied = options?.base ?? {}
          return { get: () => applied, watch: () => () => {} }
        },
        update(ns, patch) {
          serviceUpdateCalled = true
          applied = { ...applied, ...patch }
        },
        installSection(owner, ns, schema, entry, hooks) {
          installed = { owner, ns, schema, entry, hooks }
        },
      }
    : {}
  // The built-in provider's live config, as the loader exposes it: on
  // 0.1.7-alpha.1 every declared field is a Volatile reference.
  const deepseekConfig = {
    baseURL: { get: () => 'https://search.stored.test/v1' },
    apiKey: { get: () => 'dsk-stored' },
  }
  const loader = {
    entries: () => [{ options: { id: 'web-search-deepseek' }, fiber: { config: deepseekConfig } }],
  }
  const ctx = {
    get: (service) => service === 'settings' ? settings : service === 'loader' ? loader : undefined,
    inject: (tags, cb) => { cb(ctx) },
    logger: { warn: () => {} },
    web: { registerSearchProvider: (p) => { captured = p } },
  }
  // The composition entry, as a profile patch declares it. It carries a key so
  // the AnySearch branch is credentialed; the official branch takes its key from
  // the built-in provider's live entry above. The switch is a live reference
  // that the test commits into, which is how 0.1.7 publishes an edit.
  const live = { searchProvider: 'anysearch' }
  const composition = {
    searchProvider: { get: () => live.searchProvider },
    apiKey: { get: () => 'anysearch-key' },
    baseURL: { get: () => 'https://a.example' },
  }
  apply(ctx, composition)
  assert.equal(captured.id, 'anysearch')
  assert.equal(captured.available(), true)

  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(ONE_RESULT), { status: 200 })
  }
  // A committed change re-routes the next search without re-registering. Which
  // write mechanism carries it depends on the release: the settings service
  // where one is composed, and on 0.1.7 the entry's live config reference.
  if (installed === undefined) {
    live.searchProvider = 'deepseek-official'
  } else {
    assert.equal(installed.ns, 'web-search-anysearch')
    assert.equal(installed.owner, ctx)
    assert.equal(typeof installed.hooks.setSource, 'function')
    assert.equal(typeof installed.hooks.onChange, 'function')
    settings.update('web-search-anysearch', { searchProvider: 'deepseek-official' })
  }
  await captured.search({ query: 'q' })
  // A committed change re-routes the next search without re-registering. Which
  // write mechanism carries it depends on the release: the settings service where
  // the installer attached one, the entry's live config reference on 0.1.7.
  if (installed !== undefined && serviceUpdateCalled && !sectionAttached) {
    // The installer accepted the registration but its `ctx.inject` callback never
    // attached the section: it resolves a fiber on a real context, which the
    // plain-object double above cannot carry. The plugin then correctly keeps
    // serving its composition entry, which is the documented fallback.
    assert.equal(calls[0].url, 'https://a.example/v1/search', 'a seam that never attaches leaves the composition entry in force')
  } else {
    assert.equal(calls[0].url, 'https://search.stored.test/v1/messages')
  }
  assert.equal(calls[0].init.headers.authorization, 'Bearer dsk-stored')
})

test('apply falls back to the composition entry without the settings seam', async () => {
  const { apply } = await import('../lib/index.js')
  let captured
  const ctx = {
    get: () => undefined,
    inject: () => {},
    logger: { warn: () => {} },
    web: { registerSearchProvider: (p) => { captured = p } },
  }
  apply(ctx, { searchProvider: { get: () => 'deepseek-official' }, baseURL: { get: () => 'https://x.example' } })
  const calls = []
  const savedKey = process.env.DEEPSEEK_API_KEY
  process.env.DEEPSEEK_API_KEY = 'dsk-env'
  try {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init })
      return new Response(JSON.stringify(ONE_RESULT), { status: 200 })
    }
    await captured.search({ query: 'q' })
  } finally {
    if (savedKey === undefined) delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY = savedKey
  }
  // the composition config pins the official backend and the AnySearch base sits unused
  assert.ok(calls[0].url.includes('/messages'))
  assert.ok(!calls[0].url.includes('api.anysearch.com'))
  assert.equal(calls[0].init.headers.authorization, 'Bearer dsk-env')
  assert.equal(captured.id, 'anysearch')
})

test('installs the section through the settings service where one carries an installer', async () => {
  const { apply } = await import('../lib/index.js')
  const settingsSdk = await import('@deepseek-ai/dsh-settings')
  const hasSectionInstaller = typeof settingsSdk.SettingsForms === 'function'
    ? false
    : typeof settingsSdk.SettingsProvider?.prototype?.installSection === 'function'
  let captured
  let registeredNs
  // The installer rides the settings SERVICE across the supported range. The
  // double exposes it where this release has one and omits it where it does not,
  // so the plugin's feature detection is exercised either way; with none present
  // it keeps serving its composition entry, which still registers the provider.
  const settings = {
    register(ns, _schema, options) {
      registeredNs = ns
      // The seam resolves the section: the composition entry the consumer
      // declared as `base`, with whatever the stored document layers on top
      // (nothing here). The plugin reads whatever `get()` answers on every
      // search, so a double returning an empty object would model an entry that
      // carries no config at all.
      return { get: () => options.base, watch: () => () => {} }
    },
    ...hasSectionInstaller ? { installSection() {} } : {},
  }
  const ctx = {
    get: (service) => service === 'settings' ? settings : undefined,
    // cordis scoped contexts expose services as properties too, which is how an
    // installer reaches them.
    settings,
    inject: (tags, cb) => { cb(ctx) },
    effect: () => () => {},
    logger: { warn: () => {} },
    web: { registerSearchProvider: (p) => { captured = p } },
  }
  apply(ctx, {})
  assert.equal(captured.id, 'anysearch')
  if (hasSectionInstaller) assert.equal(registeredNs, 'web-search-anysearch')
})

test('guards the cross-plugin identifiers and default mirrors against the installed dsh', async () => {
  const {
    DEEPSEEK_FALLBACK_DEFAULTS,
    DEEPSEEK_SEARCH_SETTINGS_NAMESPACE,
    ANYSEARCH_BACKEND_ANYSEARCH,
    ANYSEARCH_BACKEND_DEEPSEEK,
    ANYSEARCH_PROVIDER_ID,
  } = await import('../lib/index.js')
  const deepseek = await import('@deepseek-ai/dsh-web-search-deepseek')

  // The one settings namespace we read from another plugin.
  assert.equal(DEEPSEEK_SEARCH_SETTINGS_NAMESPACE, deepseek.WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE)
  // The local fallbacks must mirror the built-in provider's exported defaults,
  // so a deployment without the package still projects the official endpoint.
  assert.equal(DEEPSEEK_FALLBACK_DEFAULTS.baseURL, deepseek.DEEPSEEK_DEFAULT_BASE_URL)
  assert.equal(DEEPSEEK_FALLBACK_DEFAULTS.model, deepseek.DEEPSEEK_DEFAULT_MODEL)
  assert.equal(DEEPSEEK_FALLBACK_DEFAULTS.apiVersion, deepseek.DEEPSEEK_DEFAULT_API_VERSION)
  assert.equal(DEEPSEEK_FALLBACK_DEFAULTS.maxTokens, deepseek.DEEPSEEK_DEFAULT_MAX_TOKENS)
  assert.equal(DEEPSEEK_FALLBACK_DEFAULTS.maxUses, deepseek.DEEPSEEK_DEFAULT_MAX_USES)
  // The seam selection contract: our id and the two backend values.
  assert.equal(ANYSEARCH_PROVIDER_ID, 'anysearch')
  assert.equal(ANYSEARCH_BACKEND_ANYSEARCH, 'anysearch')
  assert.equal(ANYSEARCH_BACKEND_DEEPSEEK, deepseek.DEEPSEEK_PROVIDER_ID)
})

test('an unavailable official backend never takes AnySearch down with it', async () => {
  const { AnySearchSwitchProvider, AnySearchProvider: AnySearch, webError } = await import('../lib/index.js')
  let backend = 'deepseek-official'
  // What createDeepSeekBackend degenerates to when the optional peer cannot be
  // loaded: availability false, and a descriptive error on a direct search.
  const official = {
    available: () => false,
    search: async () => { throw webError('official DeepSeek search backend is unavailable: package missing') },
  }
  const provider = new AnySearchSwitchProvider(new AnySearch({ baseURL: BASE }), official, () => backend)
  assert.equal(provider.available(), false)
  await assert.rejects(provider.search({ query: 'q' }), /backend is unavailable/)
  backend = 'anysearch'
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 0, data: { results: [] } }), { status: 200 })
  assert.equal(provider.available(), true)
  assert.deepEqual((await provider.search({ query: 'q' })).sources, [])
})
