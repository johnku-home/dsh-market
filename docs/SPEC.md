# dsh-market 元数据规范与索引 Schema

本文档定义 DeepSeek Harness（DSH）插件市场的数据契约。目标是让
[`dsh-plugin` GitHub topic](https://github.com/topics/dsh-plugin) 这个“标签列表”
之上，出现一个结构化的、可被商店前端消费的**单一数据源**。

## 1. 背景：DSH 插件到底是什么

一个 DSH 插件（bundle）本质是一个 **npm 包**，其 `package.json` 里声明了
`dsh.bundle.patch`，表明它向配置树叠加了一个 patch 层。`dsh` CLI 在
`dsh plugin --profile <name> <pnpm args>` 安装后，就是靠这个字段判断该依赖是否
应当进入 `dsh.profile.bundles`。

> 依据：`@deepseek-ai/dsh` 的 plugin 命令实现中，
> `readProfileManifest(NAME, dir).dsh?.bundle?.patch !== void 0` 为“是 bundle”的判据。

因此市场的原子事实是：

- **安装来源**只有三类：npm 包名、git 仓库（`git+…` / `github:owner/repo`）、tarball / 本地路径。
- **可校验的插件身份**是 `dsh.bundle.patch` 是否存在。

## 2. 推荐的插件侧元数据（`dsh.plugin`）

`dsh.bundle.patch` 是**必填**的硬约定；以下 `dsh.plugin` 是市场**推荐**的软约定，
用于描述“这个插件长什么样、怎么分类、兼容哪个版本”。插件作者在 `package.json`
里加上它，市场爬虫就能拿到高质量元数据而无需猜测：

```jsonc
{
  "name": "dsh-plugin-example",
  "version": "0.1.0",
  "description": "一句能上架商店的简介",
  "keywords": ["dsh", "dsh-plugin", "tool"],
  "dsh": {
    "bundle": {
      "patch": "./patch.yml"          // 必填：profile patch 层入口
    },
    "plugin": {                        // 可选：市场元数据
      "name": "Example Plugin",        // 展示名
      "category": "tool",              // tool | skill | workflow | ui | integration | other
      "compatibility": { "dsh": ">=0.1.0" },
      "icon": "https://…/icon.png",
      "screenshots": ["https://…/a.png"]
    }
  }
}
```

字段说明：

| 字段 | 必填 | 说明 |
|---|---|---|
| `dsh.bundle.patch` | ✅ | bundle 入口，DSH 用它识别插件 |
| `dsh.plugin.name` | 推荐 | 展示名；缺省回退到 `name` |
| `dsh.plugin.category` | 推荐 | 分类，取值见上 |
| `dsh.plugin.compatibility.dsh` | 推荐 | 兼容的 dsh 版本区间 |
| `dsh.plugin.icon` / `screenshots` | 可选 | 商店展示素材 |

## 3. 索引 Schema（`index.json` v1）

爬虫产出的单一数据源，商店前端只读它：

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "sources": {
    "githubTopic": "dsh-plugin",
    "githubReposFound": 12,
    "npmQuery": "dsh-plugin",
    "npmPackagesFound": 8
  },
  "stats": {
    "plugins": 15,          // 去重后总数
    "verified": 13,         // 声明了 dsh.bundle.patch 的数量
    "npm": 12,              // 走 npm 安装的数量
    "githubOnly": 3         // 仅 git 安装的数量
  },
  "plugins": [ /* PluginEntry[]，见下 */ ]
}
```

### 3.1 PluginEntry

```jsonc
{
  "id": "npm:dsh-plugin-example",           // npm:<name> 或 github:<owner/repo>
  "name": "dsh-plugin-example",
  "description": "…",
  "version": "0.1.0",
  "author": { "name": "…", "email": "…", "url": "…" } | null,
  "license": "MIT",
  "keywords": ["dsh", "dsh-plugin"],
  "homepage": "https://…" | null,
  "repository": { "type": "git", "url": "https://github.com/owner/repo" } | null,

  "install": {
    "source": "npm",                          // npm | git
    "spec": "dsh-plugin-example"              // npm 包名 或 github:owner/repo 或 git+url
  },

  "npm": {                                    // 有 npm 发行时为对象，否则 null
    "name": "dsh-plugin-example",
    "version": "0.1.0",
    "date": "2026-01-01T00:00:00.000Z",
    "tarball": "https://registry.npmjs.org/…"
  },

  "github": {                                 // 能关联到 GitHub 时为对象，否则 null
    "owner": "owner",
    "repo": "repo",
    "fullName": "owner/repo",
    "stars": 42,
    "forks": 3,
    "pushedAt": "2026-01-01T00:00:00.000Z",
    "description": "…",
    "defaultBranch": "main",
    "topic": true                             // 是否打了 dsh-plugin topic
  },

  "dsh": { "category": "tool" } | null,       // 来自 dsh.plugin 或关键词推断
  "verified": true,                           // 是否声明了 dsh.bundle.patch
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

字段约定：

- `id` 稳定唯一，是前端做去重/收藏/埋点的键。
- `install.spec` 是**唯一安装指令来源**：商店的“一键安装”把它交给
  `dsh plugin --profile <name> add <install.spec>`。
- `verified` 只表达“声明了 `dsh.bundle.patch`”，**不等于安全**；安全校验是后续分层（见 §5）。

## 4. 爬虫归一化规则

数据源两条线，合并成一份索引：

1. **GitHub 线**：`/search/repositories?q=topic:dsh-plugin`（按 star 降序、分页，
   上限 10 页 = 1000 条），逐个拉默认分支的 `package.json`。无 `package.json` 的
   仓库（多半是 awesome 列表/文档类聚合仓库）排除出插件列表，仅记入日志。
2. **npm 线**：`/-/v1/search?text=keywords:dsh-plugin`（精确关键字、分页），逐包
   拉 registry 全量元数据，取 `dist-tags.latest` 对应的 manifest。

合并去重：npm 包通过 `repository.url` 反解出 `owner/repo`，与 GitHub 线按仓库键
合并（GitHub 线补 stars/forks/pushedAt/topic）；GitHub 仓库若其 `package.json.name`
已存在于 npm 线，则并入 npm 条目，避免重复。

分类推断优先级：`dsh.plugin.category` > 关键词启发式（`skill`/`workflow`/`tool`/
`ui`/`integration`）> `other`。

## 5. 分层与信任（后续阶段）

`index.json` 只解决“发现 + 安装”这一层。市场要健康，还需要在它之上叠加：

- **安装层**：`install.spec` → `dsh plugin add` 的适配器（DSH 内面板 / CLI）。
- **信任层**：license 扫描、来源锁定（commit/pin）、`verified` 之外再加
  “官方/社区认证”徽章、评分与下载量。
- **审核层**：自动入库 + 人工精选/置顶/下架。
