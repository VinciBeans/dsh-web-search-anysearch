/**
 * Client-half smoke: load the built browser bundle through the module-table
 * registration contract (window.__ModuleLoader__ + factory(require)), then
 * run its apply against the styled service plan with minimal stubs. Catches
 * registration-id mistakes, broken exports, and service-name drift without a
 * browser.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { writeFileSync, rmSync, readFileSync } from 'node:fs'

test('client bundle registers and mounts the card without throwing', async () => {
  // The module table contract: a `load(id, factory)` call, then the factory is
  // materialized once with a require answering module-table specifiers.
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

  const tempFile = new URL('./.tmp-client.cjs', import.meta.url)
  writeFileSync(tempFile, readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
  try {
    // The bundle is a classic module-table script, not an ESM module.
    const require = createRequire(import.meta.url)
    require(fileURLToPath(tempFile))
  } finally {
    rmSync(tempFile, { force: true })
  }

  assert.ok(registration, 'window.__ModuleLoader__.load must be called')
  assert.equal(registration.id, '@wenqi_bian/dsh-web-search-anysearch')

  const exports = registration.factory((specifier) => {
    // The only runtime module-table request the card bundle makes.
    assert.equal(specifier, 'react')
    return { createElement: () => ({}) }
  })
  assert.equal(exports.name, 'web-search-anysearch')
  assert.deepEqual(exports.inject, ['slots', 'locale', 'remote', 'remote.credentials', 'settingsScope'])

  // The service plan with stubs; the card registers into the slot the host
  // declares (settings.plugin.item), keyed by this plugin's namespace.
  let registered
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
        assert.equal(name, 'settings.plugin.item')
        const dispose = callback()
        if (typeof dispose === 'function') dispose()
        return () => {}
      },
      register: (options, component) => {
        registered = { options, component }
        return () => {}
      },
    },
    effect: () => () => {},
  }
  exports.apply(ctx)
  assert.equal(registered.options.name, 'settings.plugin.item')
  assert.equal(registered.options.key, 'web-search-anysearch')
  assert.equal(typeof registered.component, 'function')
  assert.equal(registered.options.locale, 'web-search-anysearch')
  assert.equal(typeof registered.options.inject, 'function')
})
