# dsh-web-search-anysearch

面向 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/DeepSeek-Harness) 的 [AnySearch](https://www.anysearch.com) 网页搜索提供方插件，并在官方 DeepSeek 搜索端点与 AnySearch 之间显式切换——切换可在 Web GUI 的设置页以卡片形式完成，与 dsh 内置插件卡片完全一致。

dsh 对模型只暴露一个固定的 `web_search` 工具，真正的后端通过 `ctx.web` seam 选择。本 bundle 在 `anysearch` id 下注册一个切换提供方：选中 AnySearch 时调用 `POST https://api.anysearch.com/v1/search`，否则委托给官方 DeepSeek 搜索端点。允许匿名访问；配置 API key 可提高限流。

## 兼容性

针对 dsh v0.1.2-alpha.1 ~ alpha.5、v0.1.2-rc.1 与 v0.1.3-alpha.2 七个 tag 验证（本插件消费的契约面在七个版本上一致；CI 矩阵逐个验证）。

## 安装

版本与宿主对齐：每个版本针对、并命名为对应的 `@deepseek-ai/dsh` 发布。

需要已初始化 `web` profile 的 DSH 安装（至少启动过一次 Web GUI）。

### 从 npm 安装

1. **npm `latest`**（`0.1.2-rc.1`，与 `rc` 通道同步）——兼容 dsh v0.1.2-alpha.1 ~ rc.1：

   ```bash
   dsh plugin --profile web add @wenqi_bian/dsh-web-search-anysearch
   # 等价：dsh plugin --profile web add @wenqi_bian/dsh-web-search-anysearch@rc
   ```

npm 包内附预构建的宿主与浏览器 bundle，安装无需构建步骤。

### 从源码安装

源码版本 `0.1.2-rc.1`（即 GitHub Release `v0.1.2-rc.1` 发布的内容），用于本地开发：

```bash
dsh plugin --profile web add .
```

`dsh` 以 `link:` 链接本目录，把 bundle 层追加进 `dsh.profile.bundles` 并应用 `cordis.patch.yml`（注册提供方行，**同时把 `web.searchProvider` 固定为 `anysearch`**；后应用的 patch 层仍然优先，部署方显式固定自己的值不受影响）。代码变更后用 `npm run build` 重建。**重启 `dsh web`** 生效（bundle 层的变更只在启动时应用）。只验证、不启动可先跑：

```sh
dsh --profile web --dump-config
```

迁移：若 profile patch 里已有手写的 `web-search-anysearch` 行（例如之前的 `./anysearch-search.mjs` 方案），先删除该行，再安装 bundle——两者行 id 相同，重复 id 会导致加载失败。

## 在 GUI 中切换搜索服务

打开 **设置 → 插件 → 插件配置 → AnySearch 搜索服务**。卡片第一项就是切换开关；保存后下一次 `web_search` 立即使用新后端，无需重启：

- **AnySearch**（默认）——按卡片上的 API Key / 接口地址调用 `POST {base}/v1/search`。
- **官方 DeepSeek 搜索**——委托给内置的 DeepSeek 搜索路径；其 key、端点、模型与预算仍由 dsh 自带的 **Web search (DeepSeek)** 卡片配置，本开关只做后端选择。

卡片上的 API key 经凭据域写入（默认引用 `ANYSEARCH_API_KEY`，解析顺序 `$DSH_HOME/.credentials.yaml` > `$DSH_HOME/.env` > 继承环境），永不落进设置文件。匿名请求同样可用。

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
- 切换卡片需要 dsh web GUI 组合本插件（浏览器半部经 `dsh.client` 分发）；headless profile 下功能完整，但只能走配置文件切换。
- 选中官方后端时，其可用性跟随内置 DeepSeek 搜索设置（需要 key 与合法端点）；AnySearch 始终支持匿名。内置插件 `@deepseek-ai/dsh-web-search-deepseek` 是**可选 peer**，按需动态加载：未组合该插件的部署仍能加载本插件并使用 AnySearch，官方一侧报告不可用。
- 搜索词会发送到 `https://api.anysearch.com`（可用 `ANYSEARCH_API_BASE_URL` 或卡片上的接口地址覆盖）；返回内容视为不可信外部数据。

## License

MIT
