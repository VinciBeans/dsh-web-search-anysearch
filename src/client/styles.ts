/**
 * Card chrome styles, mirroring the shipped plugin cards' CSS variables. The
 * browser half cannot ship a separately served stylesheet, so the card's rules
 * are injected as one idempotent `<style>` element on load; every class is
 * prefixed `dswa-` so nothing collides with the shell's modules.
 * @module @wenqi_bian/dsh-web-search-anysearch/client/styles
 */

/** All card class names, for the component's className strings. */
export const classes = {
  card: 'dswa-card',
  cardOpen: 'dswa-card-open',
  header: 'dswa-header',
  headText: 'dswa-head-text',
  name: 'dswa-name',
  description: 'dswa-description',
  pending: 'dswa-pending',
  chevron: 'dswa-chevron',
  chevronOpen: 'dswa-chevron-open',
  body: 'dswa-body',
  readOnly: 'dswa-read-only',
  footer: 'dswa-footer',
  failed: 'dswa-failed',
  discard: 'dswa-discard',
  save: 'dswa-save',
  field: 'dswa-field',
  head: 'dswa-field-head',
  label: 'dswa-label',
  badges: 'dswa-badges',
  badge: 'dswa-badge',
  badgeMuted: 'dswa-badge-muted',
  reset: 'dswa-reset',
  input: 'dswa-input',
  hint: 'dswa-hint',
  backend: 'dswa-backend',
  backendOption: 'dswa-backend-option',
  backendInput: 'dswa-backend-input',
} as const

/** Rule text injected once. */
const CHROME_CSS = `
.${classes.card} {
  list-style: none;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-3);
  transition: border-color .16s, background .16s;
}
.${classes.card}:hover { border-color: var(--dsw-alias-label-dimmed); }
.${classes.cardOpen} {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-label-dimmed);
}
.${classes.header} {
  width: 100%;
  appearance: none;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
}
.${classes.header}:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.${classes.headText} {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.${classes.name} {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary);
}
.${classes.description} {
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}
.${classes.chevron} {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  transition: transform .16s;
}
.${classes.chevronOpen} { transform: rotate(180deg); }
.${classes.body} {
  border-top: 0.5px solid var(--dsw-alias-border-l2);
  margin: 0 16px;
  padding-bottom: 8px;
}
.${classes.readOnly} {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}
.${classes.pending} {
  flex: none;
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 17px;
  font-weight: 500;
  white-space: nowrap;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
}
.${classes.footer} {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 4px;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
}
.${classes.failed} {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-error);
}
.${classes.discard}, .${classes.save} {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 5px 14px;
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}
.${classes.discard} {
  border-color: var(--dsw-alias-border-l2);
  background: none;
  color: var(--dsw-alias-label-secondary);
}
.${classes.discard}:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-label-dimmed);
}
.${classes.save} {
  background: var(--dsw-alias-label-primary);
  color: var(--dsw-alias-bg-layer-3);
}
.${classes.discard}:disabled, .${classes.save}:disabled { opacity: 0.4; cursor: default; }
.${classes.discard}:focus-visible, .${classes.save}:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.${classes.field} {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0;
}
.${classes.field} + .${classes.field} {
  border-top: 0.5px solid var(--dsw-alias-border-l2);
}
.${classes.head} {
  display: flex;
  align-items: center;
  gap: 8px;
}
.${classes.label} {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--dsw-alias-label-primary);
}
.${classes.badges} {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.${classes.badge} {
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 17px;
  white-space: nowrap;
  font-weight: 500;
  background: var(--dsw-alias-bg-module-platform);
  color: var(--dsw-alias-label-secondary);
}
.${classes.badgeMuted} {
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  line-height: 17px;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
}
.${classes.reset} {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.${classes.reset}:hover:not(:disabled) { color: var(--dsw-alias-label-primary); }
.${classes.reset}:disabled { cursor: default; }
.${classes.input} {
  height: 34px;
  padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-3);
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-primary);
}
.${classes.input}:focus-visible { outline: none; border-color: var(--dsw-alias-brand-primary); }
.${classes.input}:disabled { color: var(--dsw-alias-label-tertiary); cursor: default; }
.${classes.hint} {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}
.${classes.backend} {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.${classes.backendOption} {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-layer-2);
  cursor: pointer;
}
.${classes.backendOption}:has(.${classes.backendInput}:checked) {
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-label-primary);
}
.${classes.backendInput} { accent-color: var(--dsw-alias-brand-primary); }
`

/**
 * Inject the card chrome styles; a second call is a no-op.
 * @returns disposer removing the style element.
 */
export function injectCardStyles(): () => void {
  const host = document.head ?? document.documentElement
  if (host.querySelector(`style[data-dsw-anysearch-chrome]`) !== null) return () => {}
  const style = document.createElement('style')
  style.setAttribute('data-dsw-anysearch-chrome', '')
  style.textContent = CHROME_CSS
  host.appendChild(style)
  return () => { style.remove() }
}
