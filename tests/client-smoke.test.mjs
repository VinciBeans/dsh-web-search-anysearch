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
    // Enough of React's shape to render an element and to drive the card's
    // mount-time effects: the returned tree is read back by the caller.
    return {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.length === 1 ? children[0] : children } }),
      useRef: value => ({ current: value }),
      useState: initial => [initial, () => {}],
      useEffect: effect => { effect() },
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
  const ctx = {
    locale: {
      register: () => {},
      bind: () => key => key,
    },
    settingsScope: {
      bind: ({ namespace }) => ({
        getSnapshot: () => ({ status: 'ready', writable: true, value: { searchProvider: 'anysearch' } }),
        subscribe: () => () => {},
        set: async () => {},
        unset: async () => {},
      }),
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
  ])
  assert.equal(exports.name, 'web-search-anysearch')
  assert.deepEqual(exports.inject, ['slots', 'locale', 'remote', 'remote.credentials', 'settingsScope'])
  // Both page generations are attempted; the undeclared one is what a given
  // deployment skips.
  assert.deepEqual(injected, ['plugins.bundle.config', 'settings.plugin.item'])

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
