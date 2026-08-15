# dsh-plugin-market（DSH 插件市场面板）

DeepSeek Harness（DSH）的**浏览器内插件市场面板**：在侧边栏底部加一个「插件市场」入口，
点开浮层即可**浏览 / 搜索 / 筛选 / 查看详情 / 一键复制安装命令**。

数据来自 `dsh-market` 爬虫产出的 `index.json`（见上层目录），面板从 URL 拉取该索引，
因此爬虫同步后市场自动更新。

## 功能

- 侧边栏底部「插件市场」入口 + 浮层面板（`sidebar.footer.action` + `shell.overlay`）
- 搜索（名称/描述）、「只看已验证」开关、按分类筛选
- 插件卡片：名称、简介、star、verified（`dsh.bundle`）、来源（npm/git）、分类、版本
- 详情页：作者、license、版本、关键词、主页、仓库、完整安装命令
- **一键安装**：面板内直接执行 `dsh plugin --profile <profile> add <spec>`（经 host Typert Remote 服务）
- 一键**复制安装命令**：`dsh plugin --profile <profile> add <spec>`（备选）
- 可配置索引地址与目标 profile（面板底部）

## 安装（静态 bundle，永久生效）

装进 DSH 的 `web` profile（浏览器端组合由 bundle 组成）：

```sh
# 从本地目录安装（开发时）
dsh plugin --profile web add ./plugin

# 或从 GitHub / npm 安装（发布后）
dsh plugin --profile web add github:<你>/dsh-market
dsh plugin --profile web add dsh-plugin-market
```

重启 web：

```sh
dsh --profile web
```

重启后：

- 插件自动加载，侧边栏底部出现「插件市场」按钮
- 出现在「设置 → 插件」清单（id: `plugin-market`）

## 配置索引地址

面板顶部有「索引地址」输入框，默认为 `https://raw.githubusercontent.com/YOUR_NAME/dsh-market/main/index.json`。
把它改成你自己的 `index.json` raw 地址即可（`index.json` 在爬虫同步后由 GitHub Actions 提交到仓库）。

## 文件结构

```
plugin/
├── package.json         # bundle 声明（dsh.bundle.patch / dsh.client / exports / typert 依赖）
├── cordis.patch.yml     # web 组合补丁：插入 plugin-market 行
├── lib/
│   ├── index.js         # Host（node）半区：Typert Remote 服务 pluginMarket/install
│   └── client.js        # 浏览器半区：__ModuleLoader__ 模块（静态版，UI + remote 挂载）
└── README.md
```

## 关键技术点

- **双半区**：Host 半区提供 `pluginMarket` 服务，浏览器半区经 `dsh.client` 声明由 `__ModuleLoader__` 加载。
- **Host↔Client（一键安装）**：host 半区用 `TypertRemoteService` + 手写 `@Remote("install")` 标记（SRC 模式，无需 codegen）暴露 `install(spec, profile)`；client 半区 `inject: ['remote']`、经 `ctx.remote.$mount()` 挂载 strict 贡献（手写 `.parse` 极简 schema，无需 zod）、再经 `ctx.get('remote.pluginMarket')` 调用。
- **槽位**：`sidebar.footer.action`（入口按钮）+ `shell.overlay`（浮层面板）。
- **联动状态**：多槽位组件经闭包小 store（`Set` 订阅 + `force(n=>n+1)`）同步开合。
- **安全**：host 侧对 `spec`/`profile` 做严格白名单校验，`spawn` 参数数组 + 仅 Windows 走 `shell`，防止命令注入。
- **生命周期**：样式标签、槽位注册、remote 挂载均交由 `ctx.effect` 管理，卸载自动清理。
