import test from 'node:test'
import assert from 'node:assert/strict'
import { AnySearchProvider, Config, name } from '../lib/index.js'

const BASE = 'https://api.anysearch.com'

test('Config fills the apiKeyEnv default and keeps explicit values', () => {
  assert.equal(Config({}).apiKeyEnv, 'ANYSEARCH_API_KEY')
  assert.equal(Config({ apiKeyEnv: 'MY_KEY', baseURL: 'https://x.example' }).apiKeyEnv, 'MY_KEY')
  assert.equal(Config({ baseURL: 'https://x.example' }).baseURL, 'https://x.example')
})

test('Config defaults the switch to anysearch and keeps an explicit one', () => {
  assert.equal(Config({}).searchProvider, 'anysearch')
  assert.equal(Config({ searchProvider: 'deepseek-official' }).searchProvider, 'deepseek-official')
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
  assert.equal(calls[0].init.headers['x-anysearch-client'], 'dsh-web-search-anysearch/0.1.2-rc.1')
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
  const provider = new AnySearchSwitchProvider(
    new AnySearchProvider({ baseURL: BASE }),
    new DeepSeekSearchProvider(() => ({
      baseURL: 'https://search.official.test/v1',
      model: 'deepseek-v4-flash',
      apiVersion: '2023-06-01',
      maxTokens: 4096,
      maxUses: 5,
      resolveApiKey: async () => 'dsk',
    })),
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
  let captured
  let installed
  const settings = {
    installSection(owner, ns, schema, entry, hooks) {
      installed = { owner, ns, schema, entry, hooks }
    },
    get(ns) {
      if (ns === 'web-search-deepseek') return { baseURL: 'https://search.stored.test/v1', apiKey: 'dsk-stored' }
      return undefined
    },
  }
  const ctx = {
    get: (service) => service === 'settings' ? settings : undefined,
    inject: (tags, cb) => { cb(ctx) },
    logger: { warn: () => {} },
    web: { registerSearchProvider: (p) => { captured = p } },
  }
  apply(ctx, Config({ searchProvider: 'anysearch' }))
  assert.equal(captured.id, 'anysearch')
  assert.equal(captured.available(), true)
  assert.equal(installed.ns, 'web-search-anysearch')
  assert.equal(installed.owner, ctx)
  assert.equal(typeof installed.hooks.setSource, 'function')
  assert.equal(typeof installed.hooks.onChange, 'function')

  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(ONE_RESULT), { status: 200 })
  }
  // A committed section change (the card's save) re-routes the next search.
  installed.hooks.setSource(() => ({ searchProvider: 'deepseek-official', apiKeyEnv: 'ANYSEARCH_API_KEY' }))
  await captured.search({ query: 'q' })
  assert.equal(calls[0].url, 'https://search.stored.test/v1/messages')
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
  apply(ctx, Config({ searchProvider: 'deepseek-official', baseURL: 'https://x.example' }))
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

test('installs through whichever section installer the dsh build provides', async () => {
  const { apply } = await import('../lib/index.js')
  const settingsSdk = await import('@deepseek-ai/dsh-settings')
  let captured
  let warned = false
  let registeredNs
  // The alpha shape hands the section to the module-level installer, which
  // consumes a service exposing register()/watch(); the rc.1 shape rides a
  // service method, and with neither present the plugin warns and keeps the
  // composition entry. Either outcome keeps the provider registered.
  const settings = {
    register(ns) {
      registeredNs = ns
      return { get: () => ({}), watch: () => () => {} }
    },
  }
  const ctx = {
    get: (service) => service === 'settings' ? settings : undefined,
    // The alpha-era installer reads `sctx.settings` as a property (cordis
    // scoped contexts expose services directly), not through get().
    settings,
    inject: (tags, cb) => { cb(ctx) },
    effect: () => () => {},
    logger: { warn: () => { warned = true } },
    web: { registerSearchProvider: (p) => { captured = p } },
  }
  apply(ctx, Config({}))
  assert.equal(captured.id, 'anysearch')
  if (settingsSdk.installSettingsSection === undefined) {
    // rc.1: the service has no method and the module has no free function.
    assert.equal(warned, true)
  } else {
    assert.equal(registeredNs, 'web-search-anysearch')
  }
})
