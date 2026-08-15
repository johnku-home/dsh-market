# dsh-market

DeepSeek Harness（DSH）插件市场的内核：把
[`dsh-plugin` GitHub topic](https://github.com/topics/dsh-plugin) 和 npm 上的
`dsh-plugin` 关键字自动同步，归一化成一份结构化索引 `index.json`，供商店前端消费。

## 现状

- ✅ 零依赖爬虫（Node ≥ 18，仅用内置 `fetch`）
- ✅ GitHub topic（分页）+ npm 关键字双线采集、按仓库/包名去重合并
- ✅ 元数据规范与索引 Schema（见 [`docs/SPEC.md`](docs/SPEC.md)）
- ✅ GitHub Actions 每 8 小时自动同步
- ✅ DSH 内市场面板插件（见 [`plugin/`](plugin/README.md)：浏览/搜索/详情/复制安装命令）

## 用法

```sh
# 生成本地 index.json（可选：设置 GITHUB_TOKEN 提升速率上限）
GITHUB_TOKEN=ghp_xxx node src/index.js
# 或
npm run sync
```

输出：仓库根目录的 `index.json`。

## 目录

```
dsh-market/
├── docs/SPEC.md            # 元数据规范 + 索引 Schema
├── src/
│   ├── index.js            # 爬虫编排入口
│   └── lib/
│       ├── fetch.js        # 带重试/限流的 fetch 封装
│       ├── github.js       # GitHub topic 采集
│       ├── npm.js          # npm registry 采集
│       └── normalize.js    # 归一化 + 去重合并
├── index.json              # 生成的索引（提交到仓库）
├── plugin/                 # DSH 内市场面板（web bundle）
│   ├── cordis.patch.yml
│   └── lib/index.js + client.js
├── scripts/smoke-client.mjs # 面板浏览器模块冒烟测试
└── .github/workflows/sync.yml
```

## 路线图

1. [x] 规范 + 索引内核
2. [x] DSH 内市场面板插件（浏览 / 搜索 / 详情 / 复制安装命令）
3. [x] 面板内一键安装（Typert Remote：host `pluginMarket/install` → 执行 `dsh plugin add`）
4. [ ] 信任层：license 扫描、评分、认证徽章、来源锁定
