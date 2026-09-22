# dsh-web-search-anysearch

面向 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/DeepSeek-Harness) 的 [AnySearch](https://www.anysearch.com) 网页搜索提供方插件，并在官方 DeepSeek 搜索端点与 AnySearch 之间显式切换——切换可在 Web GUI 的设置页以卡片形式完成，与 dsh 内置插件卡片完全一致。

dsh 对模型只暴露一个固定的 `web_search` 工具，真正的后端通过 `ctx.web` seam 选择。本 bundle 在 `anysearch` id 下注册一个切换提供方：选中 AnySearch 时调用 `POST https://api.anysearch.com/v1/search`，否则委托给官方 DeepSeek 搜索端点。允许匿名访问；配置 API key 可提高限流。

## 兼容性

**要求 dsh `v0.1.5-alpha.1` 或更高。** CI 矩阵逐一验证该下限之后的每个发布：v0.1.5-alpha.1、v0.1.5-alpha.2、v0.1.5-rc.1、v0.1.5-rc.2、v0.1.6-alpha.2 与 v0.1.7-alpha.1。（dsh 从未发布 `0.1.4`——谱系是 `0.1.3-alpha.2` → `0.1.5-alpha.1`。）

### 设置与页面的两代契约

在该区间内，本插件消费的两个契约各有两种形状，每个版本只携带其中一种；插件自行探测，因此一份构建服务整个区间。

**设置 seam。** 直到 `0.1.6-alpha.2`，插件通过 `ctx.settings.installSection(...)` 注册配置节，再通过回调拿到的 scope 读取。`0.1.7-alpha.1` 删掉了这个调用：schema 上标记 `.volatile()` 的字段会以「稳定引用」的形式交给 `apply`，`get()` 返回当前值，profile 改动由框架就地写入该引用而不再重挂插件。本插件的 schema 在构建器支持时把每个字段都标为 volatile（`.volatile()` 自 schemastery 3.18.3 起存在，0.1.7 是首个携带它的版本），读取时两种形状都认，并且只在仍有安装器的版本上注册设置节。它对「官方 DeepSeek 搜索」的委托同样改为从 loader 读取对方的实时配置，缺少该 seam 的版本再回落设置服务。

**Plugins 页面。** `0.1.6-alpha.2` 把卡片列表换成「bundle 自己的配置页」；`0.1.7-alpha.1` 又改成「每一行的页面」，并把该行的实时取值与写入命令作为 owner props 交给卡片。浏览器半对该区间已知的三个槽位都注册——`plugins.row.config`（key 为 `<包名>#<行 id>`，0.1.7 的形式，表单由页面提供）、`plugins.bundle.config`（按包名，0.1.6）、`settings.plugin.item`（0.1.5 线）——部署没声明的槽位根本不会被注入。于是卡片在 0.1.7 上出现在该行页面、0.1.6 上出现在 bundle 页面、0.1.5 上出现在 **设置 → 插件 → 插件配置**。

宿主半的路由、`cordis.patch.yml` 的 pin 与凭据处理在整个区间一致。

### 支持策略

支持范围自 **`v0.1.5-alpha.1`** 起。**0.1.2 线（`v0.1.2-alpha.1` ~ `v0.1.2-rc.1`）与 `v0.1.3-alpha.2` 已不再支持**：本插件版本不携带它们的代码路径（0.1.2 线的模块级设置安装器），peer 范围也拒绝它们，CI 矩阵同样不再验证。若你的宿主仍停留在下限以下，请固定使用对应那条线的插件发布——`0.1.3-alpha.2`（npm `alpha`）或 `0.1.2-rc.1`（npm `latest`）——两者都已发布并保持冻结。

## 安装

版本与宿主对齐：每个版本针对、并命名为对应的 `@deepseek-ai/dsh` 发布。

需要已初始化 `web` profile 的 DSH 安装（至少启动过一次 Web GUI）。

### 从 npm 安装

按你的宿主版本选择 dist-tag：

1. **npm `alpha`**——当前 npm 构建：

   ```bash
   dsh plugin --profile web add @wenqi_bian/dsh-web-search-anysearch@alpha
   ```

2. **npm `latest`**（`0.1.2-rc.1`）——已冻结的 0.1.2 线，供**低于本插件下限**的宿主使用：

   ```bash
   dsh plugin --profile web add @wenqi_bian/dsh-web-search-anysearch
   ```

npm 包内附预构建的宿主与浏览器 bundle，安装无需构建步骤。已发布的构建只支持它发布时所对应的宿主下限——若你固定使用更早的发布，请查该 tag 上的 README。

### 从源码安装

源码版本 `0.1.7-alpha.2`（即 GitHub Release `v0.1.7-alpha.2` 发布的内容），用于本地开发：

```bash
dsh plugin --profile web add .
```

`dsh` 以 `link:` 链接本目录，把 bundle 层追加进 `dsh.profile.bundles` 并应用 `cordis.patch.yml`（注册提供方行，**同时把 `web.searchProvider` 固定为 `anysearch`**；后应用的 patch 层仍然优先，部署方显式固定自己的值不受影响）。代码变更后用 `npm run build` 重建。0.1.6 起 Plugins 页面只为 profile 里登记过的 bundle 渲染配置，所以请以 bundle 形式安装，而不是只手写一行组合行。**重启 `dsh web`** 生效（bundle 层与分发的浏览器 bundle 都只在启动时应用）。只验证、不启动可先跑：

```sh
dsh --profile web --dump-config
```

迁移：若 profile patch 里已有手写的 `web-search-anysearch` 行（例如之前的 `./anysearch-search.mjs` 方案），先删除该行，再安装 bundle——两者行 id 相同，重复 id 会导致加载失败。

## 在 GUI 中切换搜索服务

dsh `0.1.7-alpha.1` 上打开 **设置 → 插件 → `@wenqi_bian/dsh-web-search-anysearch` → `web-search-anysearch` 行**（配置在该行的页面上）；`0.1.6-alpha.2` 上打开 **设置 → 插件 → `@wenqi_bian/dsh-web-search-anysearch`**（bundle 自己的页面）；`0.1.5` 线上打开 **设置 → 插件 → 插件配置 → AnySearch 搜索服务**。各入口的表单第一项都是切换开关；保存后下一次 `web_search` 立即使用新后端，无需重启：

- **AnySearch**（默认）——按卡片上的 API Key / 接口地址调用 `POST {base}/v1/search`。
- **官方 DeepSeek 搜索**——委托给内置的 DeepSeek 搜索路径；其 key、端点、模型与预算仍由 dsh 自带的 **Web search (DeepSeek)** 卡片配置，本开关只做后端选择。

卡片上的 API key 经凭据域写入（默认引用 `ANYSEARCH_API_KEY`，解析顺序 `$DSH_HOME/.credentials.yaml` > `$DSH_HOME/.env` > 继承环境）。表单上的 **API Key** 字段则是本条目的普通配置字段，输入的值会存进 profile patch；两者并非互斥，见下节。

## 配置文件方式（仍然有效）

后应用的层优先；bundle 只固定 `anysearch`，以下方式可整体覆盖一次启动：

1. **profile patch 一行** - 编辑 `$DSH_HOME/profiles/web/cordis.patch.yml`：

```yaml
- id: web
  config:
    searchProvider: anysearch          # 或 deepseek-official
    fetchProvider: http                # patch 整行替换 config，须一并写回
```

2. **一次性覆盖层**（不改 profile 文件）：

```sh
dsh web --patch examples/use-anysearch.cordis.yml
dsh web --patch examples/use-deepseek-official.cordis.yml
```

3. **环境变量**（整次启动生效）：

```sh
DSH_WEB_SEARCH_PROVIDER=anysearch dsh web
```

多个可用提供方共存时选择仍须显式，否则 seam 抛 `WEB_PROVIDER_AMBIGUOUS`；配置错误分别报 `WEB_PROVIDER_CONFIGURED_MISSING` / `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`。切换卡片编辑的是 `web-search-anysearch` 设置节；若 profile 或环境把提供方固定为其它值（例如 `exa`），卡片不参与服务路径。

## 已知限制

- **仅通用搜索。** dsh seam 请求只携带 `query` 与 `maxResults`；AnySearch 的垂直领域（`finance.quote` 等）、其必填 params、`zone`/`language` 以及 `/v1/extract` 端点无法经 `web_search` 触达。
- 配置表单需要 dsh web GUI 组合本插件（浏览器半部经 `dsh.client` 分发）**且**本 bundle 在 profile 的 `dsh.profile.bundles` 里——0.1.6 起表单属于 bundle 页或行页，只注册行、未登记 bundle 的 profile 看不到表单。headless profile 下功能完整，但只能走配置文件切换。
- `0.1.7-alpha.1` 上，从 profile 编辑器提交的配置改动经 volatile 引用直接送达运行中的插件，下一次 `web_search` 即生效，无需重启。schema 构建器无法标记 volatile 的版本（schemastery < 3.18.3，即 dsh ≤ 0.1.6）仍按原路经设置节解析。
- 选中官方后端时，其可用性跟随内置 DeepSeek 搜索设置（需要 key 与合法端点）；AnySearch 始终支持匿名。内置插件 `@deepseek-ai/dsh-web-search-deepseek` 是**可选 peer**，按需动态加载：未组合该插件的部署仍能加载本插件并使用 AnySearch，官方一侧报告不可用。
- API Key 有两种写入方式，持久化位置不同。表单上的 **API Key** 字段就是本 profile 条目的普通配置字段：在这里输入的值会保存进 profile patch（`config.apiKey`，经线上由 `secret` role 脱敏）。它并非必需——留空即由插件按 `apiKeyEnv`（默认 `ANYSEARCH_API_KEY`）经凭据域解析（`$DSH_HOME/.credentials.yaml` > `$DSH_HOME/.env` > 继承环境），推荐走这条路径。两种方式都允许匿名请求。
- 搜索词会发送到 `https://api.anysearch.com`（可用 `ANYSEARCH_API_BASE_URL` 或卡片上的接口地址覆盖）；返回内容视为不可信外部数据。

## License

MIT
