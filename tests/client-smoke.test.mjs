/**
 * Client-half smoke: load the built browser bundle through the module-table
 * registration contract (window.__ModuleLoader__ + factory(require)), then run
 * its apply against the styled service plan with minimal stubs. Catches
 * registration-id mistakes, broken exports, and service-name drift without a
 * browser — and pins the two Plugins-page generations the card serves: the
 * 0.1.6-alpha.2 `plugins.bundle.config` slot and the pre-0.1.6
 * `settings.plugin.item` one.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { writeFileSync, rmSync, readFileSync } from 'node:fs'
import { byClass, buttonByText, elementsOf, textOf } from './client-tree.mjs'

const PACKAGE_NAME = '@wenqi_bian/dsh-web-search-anysearch'

/** Distinct bundle filenames so each load re-executes it instead of hitting the require cache. */
let loadSequence = 0

/** Materialize the built bundle through the module-table contract. */
function loadBundle() {
  let registration
  globalThis.window = {
    __ModuleLoader__: {
      load(entry) {
        registration = entry
      },
    },
  }
  // Injected styles touch the document.
  globalThis.document = {
    head: { querySelector: () => null, appendChild: () => {} },
    createElement: () => ({ setAttribute: () => {}, remove: () => {}, textContent: '' }),
  }

  loadSequence += 1
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const tempFile = new URL(`./.tmp-client-${loadSequence}.cjs`, import.meta.url)
  writeFileSync(tempFile, source)
  try {
    // The bundle is a classic module-table script, not an ESM module.
    const require = createRequire(import.meta.url)
    require(fileURLToPath(tempFile))
  } finally {
    rmSync(tempFile, { force: true })
  }

  assert.ok(registration, 'window.__ModuleLoader__.load must be called')
  assert.equal(registration.id, PACKAGE_NAME)
  return registration.factory((specifier) => {
    // The only runtime module-table request the card bundle makes.
    assert.equal(specifier, 'react')
    // The bundle's components are invoked directly rather than through a
    // reconciler, so this stub supplies only what the branches under test read:
    // `createElement` for the trees, `useRef`/`useEffect` for the mount-time
    // discard the card installs on every generation, and a `useState` that
    // always reports its INITIAL value — enough to render a branch whose first
    // state is the one under test, but not to carry an edit across renders.
    // Drafting therefore still needs a real renderer; a branch that depends on
    // it fails loudly here rather than asserting something untrue.
    return {
      createElement: (type, props, ...children) => ({
        type,
        props: { ...props, children: children.length === 1 ? children[0] : children },
      }),
      useRef: value => ({ current: value }),
      useState: initial => [initial, () => {}],
      useEffect: (effect) => { effect(); return () => {} },
    }
  })
}

/**
 * Run one apply against a slot registry that only materializes the slots the
 * deployment declares — the same contract `slots.inject` enforces, so an
 * undeclared slot must leave its callback unrun rather than fail the load.
 * @param declared - slot names this deployment's page declares.
 * @param options - which configuration seams the deployment composes.
 * @returns the registrations the apply produced, keyed by slot name, plus what
 *   the doubles recorded.
 */
function applyWithDeclaredSlots(declared, options = {}) {
  const { configForms = false, settingsScope = true } = options
  const exports = loadBundle()
  const registered = new Map()
  const injected = []
  /** Writes the card made through the configuration seam. */
  const writes = []
  /** Namespaces the `configForms` seam was asked for. */
  const lookups = []
  /** Namespaces the legacy `settingsScope` seam was asked to bind. */
  const bound = []
  const snapshot = {
    status: 'ready',
    writable: true,
    revision: 3,
    value: { searchProvider: 'anysearch', baseURL: 'https://api.anysearch.com' },
    user: {},
    base: {},
  }
  // The settings scope the 0.1.6 and earlier page generations reach through the
  // service registry. A 0.1.7 deployment has none: its page hands the card the
  // entry's form as owner props instead.
  const scope = {
    bind: ({ namespace }) => {
      bound.push(namespace)
      return {
        getSnapshot: () => snapshot,
        subscribe: () => () => {},
        set: async (field, value) => { writes.push({ op: 'set', field, value }); return true },
        unset: async (field) => { writes.push({ op: 'unset', field }); return true },
      }
    },
  }
  // `0.1.7-alpha.1` and later: the namespace's own form, addressed by name.
  const form = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set: async (field, value) => { writes.push({ op: 'set', field, value }); return true },
    unset: async (field) => { writes.push({ op: 'unset', field }); return true },
  }
  const ctx = {
    // The card reaches a configuration seam through the service registry, not as
    // a bare property: a bare read of a service outside `inject` throws.
    get: (name) => {
      if (name === 'configForms' && configForms) {
        return { get: (namespace) => { lookups.push(namespace); return form } }
      }
      if (name === 'settingsScope' && settingsScope) return scope
      return undefined
    },
    locale: {
      register: () => {},
      bind: () => key => key,
    },
    remote: {
      credentials: {
        describe: async refs => ({ ok: true, value: Object.fromEntries(refs.map(ref => [ref, { configured: false, writable: true }])) }),
        set: async () => ({ ok: true }),
      },
      $on: () => () => {},
    },
    slots: {
      inject: (name, callback) => {
        injected.push(name)
        if (!declared.includes(name)) return () => {}
        const dispose = callback()
        if (typeof dispose === 'function') dispose()
        return () => {}
      },
      register: (options, component) => {
        registered.set(options.name, { options, component })
        return () => {}
      },
    },
    effect: () => () => {},
  }
  exports.apply(ctx)
  return { exports, registered, injected, writes, lookups, bound }
}

test('client bundle registers and mounts the card without throwing', () => {
  const { exports, registered, injected } = applyWithDeclaredSlots([
    'settings.plugin.item',
    'plugins.bundle.config',
    'plugins.row.config',
  ])
  assert.equal(exports.name, 'web-search-anysearch')
  // No version-specific settings service is required: a page that owns the form
  // hands it down as owner props, and the pages that do not are reached through
  // the scope the plugin probes for itself. Declaring a service that 0.1.7
  // removed would leave the whole browser half pending.
  assert.deepEqual(exports.inject, ['slots', 'locale', 'remote', 'remote.credentials'])
  // Every page generation is attempted; the ones a deployment does not declare
  // are what its page skips.
  assert.deepEqual(injected, ['plugins.row.config', 'plugins.bundle.config', 'settings.plugin.item'])

  // 0.1.7-alpha.1: one row's configuration, keyed <package>#<row id>.
  const row = registered.get('plugins.row.config')
  assert.equal(row.options.key, `${PACKAGE_NAME}#web-search-anysearch`)
  assert.equal(row.options.locale, 'web-search-anysearch')
  assert.equal(typeof row.options.inject, 'function')

  // 0.1.6-alpha.2: the bundle's own configuration, keyed by package name.
  const modern = registered.get('plugins.bundle.config')
  assert.equal(modern.options.key, PACKAGE_NAME)
  assert.equal(typeof modern.component, 'function')
  assert.equal(modern.options.locale, 'web-search-anysearch')
  assert.equal(typeof modern.options.inject, 'function')

  // Pre-0.1.6: the card paired with its settings namespace.
  const legacy = registered.get('settings.plugin.item')
  assert.equal(legacy.options.key, 'web-search-anysearch')
  assert.equal(legacy.options.locale, 'web-search-anysearch')
  assert.equal(typeof legacy.options.inject, 'function')
})

test('a deployment declaring only one page generation registers only that one', () => {
  const modernOnly = applyWithDeclaredSlots(['plugins.bundle.config'])
  assert.deepEqual([...modernOnly.registered.keys()], ['plugins.bundle.config'])

  const rowOnly = applyWithDeclaredSlots(['plugins.row.config'])
  assert.deepEqual([...rowOnly.registered.keys()], ['plugins.row.config'])

  const legacyOnly = applyWithDeclaredSlots(['settings.plugin.item'])
  assert.deepEqual([...legacyOnly.registered.keys()], ['settings.plugin.item'])
})

test('the card renders the summary and page views the 0.1.6 page asks for', () => {
  const { registered } = applyWithDeclaredSlots(['plugins.bundle.config'])
  const face = registered.get('plugins.bundle.config').options.inject()
  assert.equal(typeof face.hooks.anysearchCard.getSnapshot, 'function')

  const state = face.hooks.anysearchCard.getSnapshot()
  const actions = { edit: 0, resetField: 0, save: 0, discard: 0 }
  const props = {
    t: key => key,
    useAnysearchCard: selector => selector(state),
    edit: () => { actions.edit += 1 },
    resetField: () => { actions.resetField += 1 },
    save: () => { actions.save += 1 },
    discard: () => { actions.discard += 1 },
  }
  const component = registered.get('plugins.bundle.config').component

  // The summary view is the one-liner the page places under the title.
  const summary = component({ ...props, view: 'summary' })
  assert.equal(summary.props.children, 'description')

  // The page view renders the configuration and OWNS its save control: the
  // 0.1.6 page mounts an entry as a bare section, and the official form chrome
  // is internal to ui-settings-plugins (not a module-table seed), so an entry
  // without its own save would stage edits that can never be written.
  const served = { ...state, available: true, dirty: true }
  const servedProps = { ...props, useAnysearchCard: selector => selector(served) }
  const page = component({ ...servedProps, view: 'page' })
  assert.ok(byClass(page, 'dswa-save'), 'the page view owns a save control')
  const save = buttonByText(page, 'save')
  assert.equal(save.props.disabled, false, 'a dirty form is saveable')
  save.props.onClick()
  assert.equal(actions.save, 1, 'the save control is wired to the save action')
  // The page view renders no discard: leaving the page drops staged edits, and
  // the card's unmount effect is what performs that drop.
  assert.equal(buttonByText(page, 'discard'), undefined)

  // A clean form blocks the save; an unserved namespace renders nothing at all,
  // and a failed save keeps its line and its drafts.
  const clean = component({ ...props, useAnysearchCard: selector => selector({ ...served, dirty: false }), view: 'page' })
  assert.equal(buttonByText(clean, 'save').props.disabled, true)
  const failed = component({ ...props, useAnysearchCard: selector => selector({ ...served, failed: true }), view: 'page' })
  assert.equal(textOf(byClass(failed, 'dswa-failed')), 'saveFailed')
  const unserved = { ...state, available: false }
  assert.equal(
    component({ ...props, useAnysearchCard: selector => selector(unserved), view: 'page' }),
    null,
    'an unserved namespace renders nothing',
  )

  // The pre-0.1.6 card renders its own chrome: a collapsed disclosure inside
  // the page's list. Its body — the same CardBody, plus its own read-only
  // notice, save and discard — sits behind the disclosure's open state, which
  // React owns; the source pins that markup, and un-flattening the disclosure
  // to reach it here would only restate the implementation. The card's
  // discard-on-unmount effect needs a real renderer, so this test does not
  // cover it — the smoke test's React stub has no commit lifecycle.
  const legacy = component({ ...servedProps, view: undefined })
  assert.equal(typeof legacy.type, 'function', 'the legacy view is its own component')
  assert.equal(elementsOf(legacy)[0].type, 'li', 'the legacy card is a list item in the page list')
  assert.equal(byClass(legacy, 'dswa-header').props['aria-expanded'], false)
  assert.equal(textOf(byClass(legacy, 'dswa-description')), 'description')
})

test('the card binds to the form the 0.1.7 page supplies', () => {
  const { registered } = applyWithDeclaredSlots(['plugins.row.config'])
  const row = registered.get('plugins.row.config')
  const form = {
    state: {
      status: 'ready',
      writable: true,
      revision: 7,
      value: { searchProvider: 'anysearch', baseURL: 'https://api.anysearch.com' },
    },
    mutate: async () => true,
  }
  const formProps = {
    t: key => key,
    // `AnySearchCard` calls this hook unconditionally (hooks have no conditional
    // form), so this page generation's card necessarily touches the injected
    // face — it just must draw nothing from what the hook returns.
    useAnysearchCard: () => ({}),
    // The injected actions, by contrast, must never be reached on a page that
    // supplies its own form, so each throws. That they are not reached is what
    // the renders below prove.
    edit: () => { throw new Error('the form-backed card stages its own drafts') },
    resetField: () => { throw new Error('the form-backed card stages its own drafts') },
    save: () => { throw new Error('the form-backed card saves through the form') },
    discard: () => { throw new Error('the form-backed card stages its own drafts') },
  }

  // The summary view is settled before any hook, so the stub can check it.
  assert.equal(row.component({ ...formProps, view: 'summary', form }).props.children, 'description')

  // An entry the Host does not serve renders nothing rather than a form nothing
  // backs; that check too happens before the draft state is claimed. The
  // rendered form itself stages its drafts in `useState`, so exercising it needs
  // a real React runtime, which this smoke test deliberately does not ship — the
  // host integration test in `settings.test.mjs` covers the write path.
  for (const status of ['loading', 'unavailable']) {
    assert.equal(
      row.component({ ...formProps, view: 'page', form: { ...form, state: { ...form.state, status } } }),
      null,
    )
  }

  // The contribution is keyed the way the 0.1.7 page dispatches a row's
  // configuration.
  assert.equal(row.options.key, `${PACKAGE_NAME}#web-search-anysearch`)
})

test('a cleared form field unsets its override instead of writing an empty value', () => {
  const { formPlanOps } = loadBundle()
  assert.deepEqual(formPlanOps(new Map()), [])
  // Typing a value is a set; emptying the control, or pressing its reset, is the
  // clear. Writing "" would leave a user-layer override that beats the
  // composition value and the default, which is what broke the endpoint field.
  assert.deepEqual(formPlanOps(new Map([['searchProvider', 'deepseek-official']])), [
    { op: 'set', path: ['searchProvider'], value: 'deepseek-official' },
  ])
  assert.deepEqual(formPlanOps(new Map([['baseURL', '']])), [{ op: 'unset', path: ['baseURL'] }])
})

test('the card addresses the credential by the section reference and reports a refusal', async () => {
  const { AnySearchCardController, apiKeyRefOf } = loadBundle()

  assert.equal(apiKeyRefOf({ apiKeyEnv: 'MY_KEY' }), 'MY_KEY')
  assert.equal(apiKeyRefOf({ apiKeyEnv: '' }), 'ANYSEARCH_API_KEY')
  assert.equal(apiKeyRefOf(undefined), 'ANYSEARCH_API_KEY')

  const written = []
  const credentials = {
    describe: async (refs) => ({
      ok: true,
      value: Object.fromEntries(refs.map(ref => [ref, { configured: ref === 'ANYSEARCH_API_KEY', writable: ref !== 'READ_ONLY' }])),
    }),
    set: async (ref, value) => {
      written.push([ref, value])
      return { ok: ref !== 'READ_ONLY' }
    },
  }
  // No settings scope: this is the generation whose page owns the entry's form,
  // and whose key therefore reaches the domain through this face alone.
  const face = new AnySearchCardController(undefined, credentials).inject()
  assert.deepEqual(await face.credentials.describe('ANYSEARCH_API_KEY'), { configured: true, writable: true })
  assert.deepEqual(await face.credentials.describe('READ_ONLY'), { configured: false, writable: false })
  assert.deepEqual(await face.credentials.save('ANYSEARCH_API_KEY', 'sekret'), { configured: true, writable: true })
  assert.deepEqual(written, [['ANYSEARCH_API_KEY', 'sekret']])
  // A refused write and a domain that does not answer both report "no answer",
  // which is what keeps the card's draft and shows the failure.
  assert.equal(await face.credentials.save('READ_ONLY', 'sekret'), undefined)
  const silent = new AnySearchCardController(undefined, {
    describe: async () => ({ ok: false }),
    set: async () => ({ ok: false }),
  }).inject()
  assert.equal(await silent.credentials.describe('ANYSEARCH_API_KEY'), undefined)
  assert.equal(await silent.credentials.save('ANYSEARCH_API_KEY', 'sekret'), undefined)
})

/** One macrotask turn, so the controller's settled reads have landed. */
const settle = async () => { await new Promise((resolve) => { setTimeout(resolve, 0) }) }

/**
 * The bundle's own page renders `plugins.bundle.config` with a view and the
 * package key and NOTHING else — no owner form, unlike the row page. The card
 * therefore supplies its own data plane, exactly as the shipped bundles do: it
 * binds the namespace's configuration form and reads and writes that.
 */
test('the bundle page configures through the namespace form the 0.2.0 seam serves', async () => {
  const { registered, lookups, bound, writes } = applyWithDeclaredSlots(
    ['plugins.bundle.config'],
    { configForms: true, settingsScope: false },
  )
  assert.deepEqual(lookups, ['web-search-anysearch'], 'the seam is addressed by the bundle/row namespace')
  assert.deepEqual(bound, [], 'the removed settingsScope seam is not consulted where configForms is composed')

  const registration = registered.get('plugins.bundle.config')
  const face = registration.options.inject()
  await settle()
  const snapshot = face.hooks.anysearchCard.getSnapshot()
  assert.equal(snapshot.available, true, 'a served namespace makes the card available without a page-owned form')

  // The page view renders the real controls and its own save control: the bundle
  // page passes no form, so the card is the whole configuration surface there.
  const props = { ...face, t: key => key, useAnysearchCard: selector => selector(snapshot), view: 'page' }
  const page = registration.component(props)
  assert.notEqual(page, null, 'the bundle page renders the card')
  assert.ok(byClass(page, 'dswa-backend'), 'the backend switch renders')
  assert.ok(byClass(page, 'dswa-input'), 'the endpoint and key controls render')
  assert.ok(buttonByText(page, 'save'), 'the card owns a save control there')

  // A staged edit writes through the namespace form — the same document the row
  // page's form mutates, so both pages configure one configuration.
  face.edit('searchProvider', 'deepseek-official')
  face.save()
  await settle()
  assert.deepEqual(writes, [{ op: 'set', field: 'searchProvider', value: 'deepseek-official' }])
})

test('a deployment composing no configuration seam leaves the card dormant', async () => {
  const { registered, lookups, bound } = applyWithDeclaredSlots(
    ['plugins.bundle.config'],
    { configForms: false, settingsScope: false },
  )
  assert.deepEqual(lookups, [])
  assert.deepEqual(bound, [])
  const registration = registered.get('plugins.bundle.config')
  const face = registration.options.inject()
  await settle()
  const snapshot = face.hooks.anysearchCard.getSnapshot()
  assert.equal(snapshot.available, false)
  assert.equal(
    registration.component({ ...face, t: key => key, useAnysearchCard: selector => selector(snapshot), view: 'page' }),
    null,
  )
})

test('the namespace form is the seam a release carrying both would use', async () => {
  const { lookups, bound } = applyWithDeclaredSlots(
    ['plugins.bundle.config'],
    { configForms: true, settingsScope: true },
  )
  await settle()
  assert.deepEqual(lookups, ['web-search-anysearch'], 'the current seam answers first')
  assert.deepEqual(bound, [], 'the legacy seam stays untouched while the current one answers')
})
