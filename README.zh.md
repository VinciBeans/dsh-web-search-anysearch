# 面向 DeepSeek Harness 的 AnySearch

在 dsh 的 Plugins 页面里，把 `web_search` 在 [AnySearch](https://www.anysearch.com) 与官方 DeepSeek 搜索端点之间切换。

[![npm version](https://img.shields.io/npm/v/@wenqi_bian/dsh-web-search-anysearch.svg)](https://www.npmjs.com/package/@wenqi_bian/dsh-web-search-anysearch)
[![license](https://img.shields.io/npm/l/@wenqi_bian/dsh-web-search-anysearch.svg)](./LICENSE)

dsh 对模型只暴露一个 `web_search` 工具，真正的后端由 `ctx.web` seam 选择。本 bundle 在 `anysearch` id 下注册一个提供方：选中 AnySearch 时调用 `POST https://api.anysearch.com/v1/search`，否则委托给官方 DeepSeek 搜索端点。AnySearch 支持匿名访问；配置 API key 可提高限流。

## 安装

```bash
dsh plugin --profile web add @wenqi_bian/dsh-web-search-anysearch@alpha
```

安装后需**重启 `dsh web`**：bundle 层与分发的浏览器半部都在启动时读取。只想检查组合结果可以不启动：

```bash
dsh --profile web --dump-config
```

每个插件版本精确采用它所适配的 dsh tag 的版本号，包内已附预构建的宿主与浏览器 bundle。`alpha` 跟随当前发布；需要精确固定时写 `@wenqi_bian/dsh-web-search-anysearch@0.2.0-rc.2`。低于支持下限的宿主请显式固定已冻结的 `0.1.2` 线：`dsh plugin --profile web add @wenqi_bian/dsh-web-search-anysearch@0.1.2-rc.1`。

从手写行升级：安装 bundle 前请先删掉 profile patch 里已有的 `web-search-anysearch` 行。bundle 会添加同一个行 id，重复 id 会导致加载失败。

## 快速开始

1. 打开 **设置 → 插件 → `@wenqi_bian/dsh-web-search-anysearch`**，进入 `web-search-anysearch` 行。
2. 开关保持在 **AnySearch**，或选择 **官方 DeepSeek 搜索**。
3. 保存。下一次 `web_search` 立即使用所选后端，无需重启。

AnySearch 无需凭据。若要提高限流，把 key 填进卡片的 **API Key** 字段（卡片会存进凭据域），或自行把它写到 `ANYSEARCH_API_KEY` 引用下（见[配置](#配置)）。

该行的页面是 dsh `0.1.7-alpha.1` 及之后（含 `0.2.0`）渲染本表单的位置。`0.1.6-alpha.2` 上是 bundle 自己的页面；`0.1.5` 线上是 **设置 → 插件 → 插件配置 → AnySearch 搜索服务**。

## 兼容性

支持范围自 dsh `v0.1.5-alpha.1` 起，CI 逐一验证区间内的**每个已发布版本**：`0.1.5` 线全部五个（`alpha.1`、`alpha.2`、`rc.1`、`rc.2`、`rc.3`）、`0.1.6-alpha.2`、`0.1.7` 线全部四个（`alpha.1`、`alpha.2`、`rc.1`、`rc.2`）与 `0.2.0-rc.2`。`0.2.0` 线内的下限就是 `v0.2.0-rc.2` 本身：`v0.2.0-rc.1` 被拒。`0.1.2` 线与 `v0.1.3-alpha.2` 不在支持范围内：宿主更早时请固定 `0.1.3-alpha.2` 或 `0.1.2-rc.1`；注意 `v0.1.6-alpha.1` 在范围下限之前。dsh 从未发布 `0.1.4`。

**准入闸门。** 自 `v0.1.7-rc.1` 起，dsh 在 import 插件之前先读取其 `@deepseek-ai/dsh-*` peer 范围，范围不接受正在运行的版本时拒绝整个 bundle 或拦下组合行。声明出来的范围就是全部兼容性主张，因此本包逐条列出已验证的版本线：`^0.1.5-alpha.1 || ^0.1.6-alpha.2 || ^0.1.7-alpha.1 || ^0.2.0-rc.2`。`0.2.0` 线正是这些范围开始不再覆盖运行时的版本，所以在本版之前 `v0.2.0-rc.1` 与 `v0.2.0-rc.2` 都会被拒。范围之外的运行时是被刻意拒绝的，dsh 会打印不兼容的 peer，并给出 `dsh plugin allow-version` 作为精确版本豁免。

该区间之下有两个契约各有两种形状，本构建探测实际安装的是哪一种，而不是按版本号分支：

- **设置 seam。** 直到 `0.1.6-alpha.2`，插件通过 `ctx.settings.installSection(...)` 注册配置节。`0.1.7-alpha.1` 起该调用被删除：schema 上标记 `.volatile()` 的字段以稳定引用的形式交给 `apply`，`get()` 返回当前值，因此提交的改动会让下一次搜索直接改道，而不必重挂插件。
- **Plugins 页面。** `0.1.6-alpha.2` 渲染 bundle 自己的配置，`0.1.7-alpha.1` 渲染「每一行的页面」并把该行实时取值作为 owner props 传入。浏览器半部对该区间已知的三个槽位都注册，部署没声明的槽位保持休眠。

## 配置

| 配置键 | 控件 | 默认值 | 含义 |
| --- | --- | --- | --- |
| `searchProvider` | 后端开关 | `anysearch` | 下一次 `web_search` 由谁服务：`anysearch` 或 `deepseek-official`。 |
| `apiKeyEnv` | API Key 字段 | `ANYSEARCH_API_KEY` | 卡片把输入的 key 写进凭据域时使用的引用；每次搜索按该引用解析凭据。 |
| `apiKey` | | 未设置 | 手工写进 profile 的字面 key。优先于上面的引用，线上由其 `secret` role 脱敏。 |
| `baseURL` | 接口地址字段 | `https://api.anysearch.com` | AnySearch 基址，追加 `/v1/search`。可被 `ANYSEARCH_API_BASE_URL` 覆盖。 |

凭据域按此顺序解析引用：`$DSH_HOME/.credentials.yaml`、`$DSH_HOME/.env`、继承环境。两个 key 字段都留空即匿名搜索。

开关还有三种不经 GUI 的等价写法，且后应用的层优先于 bundle 自己固定的 `web.searchProvider: anysearch`：

```yaml
# $DSH_HOME/profiles/web/cordis.patch.yml
- id: web
  config:
    searchProvider: anysearch          # 或 deepseek-official
    fetchProvider: http                # patch 整行替换 config，须一并写回
```

```bash
dsh web --patch examples/use-deepseek-official.cordis.yml
DSH_WEB_SEARCH_PROVIDER=anysearch dsh web
```

无论由哪一层固定，只要固定的是其它提供方（例如 `exa`），本卡片就完全不参与服务路径。

## 已知限制

- **仅通用搜索。** seam 请求只携带 `query` 与 `maxResults`；AnySearch 的垂直领域（`finance.quote` 等）、其必填 params、`zone`/`language` 以及 `/v1/extract` 端点无法经 `web_search` 触达。
- 配置表单只在 web GUI 组合了本插件浏览器半部**且** bundle 被列入 profile 的 `dsh.profile.bundles` 时出现。headless profile 走配置文件开关，功能完整。
- 官方后端跟随内置 DeepSeek 搜索设置：需要凭据（`DEEPSEEK_API_KEY`，或 `0.2.0` 及之后的 DeepSeek 账户登录）与合法端点。内置插件 `@deepseek-ai/dsh-web-search-deepseek` 是可选 peer，首次使用时才导入；未组合它的部署仍能提供 AnySearch。
- **API Key** 字段是只写的：输入的 key 会存进凭据域（引用由 `apiKeyEnv` 指定），已存的密钥不会回填到表单。目前没有「删除已存密钥」的控件；需要撤销请到凭据存储或其管理页面操作。
- 搜索词会发送到 `https://api.anysearch.com`，或你配置的其它端点。返回内容视为不可信外部数据。

## License

MIT

贡献者环境、CI 矩阵与发布约定见 [CONTRIBUTING.md](./CONTRIBUTING.md)。
