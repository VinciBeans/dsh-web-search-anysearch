/**
 * Dictionary for the AnySearch card on the Plugins page. The namespace is this
 * plugin's own (`web-search-anysearch`), registered by the browser half so the
 * slot renderer synthesizes the card's `t` seat.
 * @module @wenqi_bian/dsh-web-search-anysearch/client/locales
 */

/** Dictionary keys of the AnySearch card. */
export type AnySearchLocaleKey =
  | 'title'
  | 'description'
  | 'backendLabel'
  | 'backendAnysearch'
  | 'backendDeepseek'
  | 'backendHint'
  | 'apiKey'
  | 'apiKeyHint'
  | 'apiKeySet'
  | 'apiKeyUnset'
  | 'endpoint'
  | 'endpointHint'
  | 'invalidNumber'
  | 'overridden'
  | 'reset'
  | 'readOnly'
  | 'save'
  | 'saving'
  | 'saveFailed'
  | 'discard'
  | 'unsaved'
  | 'collapse'
  | 'expand'

/** English copy. */
export const en: Record<AnySearchLocaleKey, string> = {
  title: 'AnySearch search service',
  description: 'Switch web_search between AnySearch and the official DeepSeek search endpoint.',
  backendLabel: 'Search service',
  backendAnysearch: 'AnySearch',
  backendDeepseek: 'Official DeepSeek search',
  backendHint: 'The selected backend serves the next web_search; any unsaved fields below apply to AnySearch only.',
  apiKey: 'API key',
  apiKeyHint: 'Stored outside the settings file. Leave blank to keep the current key.',
  apiKeySet: 'A key is configured.',
  apiKeyUnset: 'No key is configured; anonymous AnySearch access still works, a key raises the rate limit.',
  endpoint: 'Endpoint',
  endpointHint: 'Leave blank to use the provider default.',
  invalidNumber: 'Not a number',
  overridden: 'Overridden',
  reset: 'Reset',
  readOnly: 'This settings document is read-only.',
  save: 'Save',
  saving: 'Saving…',
  saveFailed: 'The save did not land; your draft is kept for correction.',
  discard: 'Discard',
  unsaved: 'Unsaved',
  collapse: 'Collapse',
  expand: 'Expand',
}

/** Chinese copy. */
export const zh: Record<AnySearchLocaleKey, string> = {
  title: 'AnySearch 搜索服务',
  description: '在 AnySearch 与官方 DeepSeek 搜索之间切换 web_search 后端。',
  backendLabel: '搜索服务',
  backendAnysearch: 'AnySearch',
  backendDeepseek: '官方 DeepSeek 搜索',
  backendHint: '选中的后端服务下一次 web_search；下方尚未保存的字段仅作用于 AnySearch。',
  apiKey: 'API Key',
  apiKeyHint: '不写入设置文件。留空表示保持当前密钥。',
  apiKeySet: '已配置密钥。',
  apiKeyUnset: '未配置密钥；AnySearch 支持匿名访问，配置密钥可提高限额。',
  endpoint: '接口地址',
  endpointHint: '留空则使用提供方默认地址。',
  invalidNumber: '不是数字',
  overridden: '已覆盖',
  reset: '重置',
  readOnly: '此设置文档为只读。',
  save: '保存',
  saving: '保存中…',
  saveFailed: '保存未生效；草稿已保留，可直接修改后重试。',
  discard: '放弃',
  unsaved: '未保存',
  collapse: '收起',
  expand: '展开',
}

/** The locale namespace this card registers under. */
export const LOCALE_NS = 'web-search-anysearch'
