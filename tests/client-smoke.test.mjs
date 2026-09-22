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
 * @returns the registrations the apply produced, keyed by slot name.
 */
function applyWithDeclaredSlots(declared) {
  const exports = loadBundle()
  const registered = new Map()
  const injected = []
  // The settings scope the 0.1.6 and earlier page generations reach through the
  // service registry. A 0.1.7 deployment has none: its page hands the card the
  // entry's form as owner props instead.
  const scope = {
    bind: ({ namespace }) => ({
      getSnapshot: () => ({ status: 'ready', writable: true, value: { searchProvider: 'anysearch' } }),
      subscribe: () => () => {},
      set: async () => true,
      unset: async () => true,
    }),
  }
  const ctx = {
    // The card reaches the settings scope through the service registry, not as
    // a bare property: a bare read of a service outside `inject` throws.
    get: (name) => name === 'settingsScope' ? scope : undefined,
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
  return { exports, registered, injected }
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
  assert.equal(component({ ...props, view: 'page' }), null)

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
