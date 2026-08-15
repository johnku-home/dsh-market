// dsh-plugin-market — 浏览器（web）半区，静态 bundle 版。
// 由 dsh-client-modules 扫描进 window.__DSH_BOOT__，随 web 启动常驻加载。
// 参考自 dsh_web_client_theme_switcher 的 ModuleLoader 模块格式。
window.__ModuleLoader__.load({
  id: 'dsh-plugin-market',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    let React = require('react');

    const name = 'plugin-market';

    /** Required client packages：runtime 提供 React，ui-slots 提供 slots 服务。 */
    const inject = ['slots', 'remote'];

    // 索引地址：留空 = 用 host 内置索引（index.json 随包发布，无需再开 8787 服务）；
    // 填入 https://… 远程 URL 时则从网络拉取（用于发布后接 GitHub raw）。
    const DEFAULT_INDEX_URL = '';

    const h = React.createElement;
    const { useState, useEffect, useMemo, useRef } = React;

    // ── 共享状态：侧边栏按钮与浮层面板联动 ────────────────────────────────
    let panelOpen = false;
    const subs = new Set();
    function notify() { subs.forEach((fn) => fn()); }
    function setPanelOpen(v) { panelOpen = v; notify(); }
    function usePanelOpen() {
      const [, force] = useState(0);
      useEffect(() => {
        const fn = () => force((n) => n + 1);
        subs.add(fn);
        return () => { subs.delete(fn); };
      }, []);
      return [panelOpen, setPanelOpen];
    }

    // ── 样式 ─────────────────────────────────────────────────────────────
    function insertStyle(css) {
      const tag = document.createElement('style');
      tag.textContent = css;
      document.head.appendChild(tag);
      return () => { tag.remove(); };
    }

    const CSS = [
      '.dsm-trigger{display:inline-flex;align-items:center;gap:6px;cursor:pointer;' +
        'color:var(--dsw-alias-label-secondary,#777);font-size:13px;padding:6px 8px;' +
        'border-radius:6px;background:transparent;border:none;}' +
      '.dsm-trigger:hover{color:var(--dsw-alias-brand-primary,#2f6bff);background:var(--dsw-alias-bg-layer-2,#eee);}',
      '.dsm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:9990;border:none;padding:0;margin:0;display:block;}',
      '.dsm-panel{position:fixed;top:0;right:0;bottom:0;width:460px;max-width:94vw;z-index:9991;' +
        'background:var(--dsw-alias-bg-base,#fff);border-left:1px solid var(--dsw-alias-border-l1,#e5e5e5);' +
        'display:flex;flex-direction:column;color:var(--dsw-alias-label-primary,#222);' +
        'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}',
      '.dsm-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;' +
        'border-bottom:1px solid var(--dsw-alias-border-l1,#e5e5e5);}',
      '.dsm-title{font-size:15px;font-weight:600;margin:0;}',
      '.dsm-sub{font-size:12px;color:var(--dsw-alias-label-secondary,#888);margin-top:2px;}',
      '.dsm-close{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#888);' +
        'font-size:18px;line-height:1;cursor:pointer;padding:4px;}',
      '.dsm-toolbar{padding:12px 16px;display:flex;flex-direction:column;gap:8px;' +
        'border-bottom:1px solid var(--dsw-alias-border-l1,#e5e5e5);}',
      '.dsm-search{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;' +
        'border:1px solid var(--dsw-alias-border-l1,#ddd);background:var(--dsw-alias-bg-layer-1,#fafafa);' +
        'color:var(--dsw-alias-label-primary,#222);font-size:13px;outline:none;}',
      '.dsm-search:focus{border-color:var(--dsw-alias-brand-primary,#2f6bff);}',
      '.dsm-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}',
      '.dsm-select{padding:6px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,#ddd);' +
        'background:var(--dsw-alias-bg-layer-1,#fafafa);color:var(--dsw-alias-label-primary,#222);font-size:12px;}',
      '.dsm-check{display:inline-flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;' +
        'color:var(--dsw-alias-label-secondary,#666);}',
      '.dsm-btn{padding:6px 10px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,#ddd);' +
        'background:var(--dsw-alias-bg-layer-2,#eee);color:var(--dsw-alias-label-primary,#222);' +
        'font-size:12px;cursor:pointer;}',
      '.dsm-btn:hover{border-color:var(--dsw-alias-brand-primary,#2f6bff);}',
      '.dsm-btn.primary{background:var(--dsw-alias-brand-primary,#2f6bff);border-color:transparent;color:#fff;}',
      '.dsm-stats{font-size:12px;color:var(--dsw-alias-label-secondary,#888);padding:8px 16px 0;}',
      '.dsm-list{flex:1;overflow-y:auto;padding:8px 16px 16px;}',
      '.dsm-empty{padding:32px 16px;text-align:center;color:var(--dsw-alias-label-secondary,#888);font-size:13px;}',
      '.dsm-card{border:1px solid var(--dsw-alias-border-l1,#e5e5e5);border-radius:10px;padding:12px;' +
        'margin-bottom:10px;background:var(--dsw-alias-bg-layer-1,#fafafa);}',
      '.dsm-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;}',
      '.dsm-name{font-size:14px;font-weight:600;margin:0;word-break:break-all;}',
      '.dsm-desc{font-size:12px;color:var(--dsw-alias-label-secondary,#666);margin:6px 0 0;line-height:1.5;' +
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.dsm-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;}',
      '.dsm-badge{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#ddd);' +
        'color:var(--dsw-alias-label-secondary,#666);}',
      '.dsm-badge.ok{border-color:var(--dsw-alias-state-success-primary,#22c55e);color:var(--dsw-alias-state-success-primary,#22c55e);}',
      '.dsm-badge.warn{border-color:var(--dsw-alias-state-warn-primary,#f59e0b);color:var(--dsw-alias-state-warn-primary,#f59e0b);}',
      '.dsm-actions{display:flex;gap:8px;margin-top:10px;}',
      '.dsm-detail{padding:16px;overflow-y:auto;flex:1;}',
      '.dsm-detail h3{margin:0 0 8px;font-size:16px;}',
      '.dsm-detail p{margin:6px 0;font-size:13px;line-height:1.6;}',
      '.dsm-kv{font-size:12px;margin:4px 0;color:var(--dsw-alias-label-secondary,#666);}',
      '.dsm-kv b{color:var(--dsw-alias-label-primary,#222);font-weight:600;}',
      '.dsm-cmd{margin:12px 0;padding:10px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,#111);' +
        'color:#e6edf3;font-family:ui-monospace,Consolas,monospace;font-size:12px;word-break:break-all;white-space:pre-wrap;}',
      '.dsm-back{display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;' +
        'color:var(--dsw-alias-brand-primary,#2f6bff);border:none;background:none;padding:0;margin-bottom:12px;}',
      '.dsm-copied{color:var(--dsw-alias-state-success-primary,#22c55e);font-size:12px;margin-left:8px;}',
      '.dsm-footer{padding:10px 16px;border-top:1px solid var(--dsw-alias-border-l1,#e5e5e5);' +
        'display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#888);}',
      '.dsm-footer input{width:90px;padding:5px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,#ddd);' +
        'background:var(--dsw-alias-bg-layer-1,#fafafa);color:var(--dsw-alias-label-primary,#222);font-size:12px;}',
      '.dsm-url{font-size:11px;color:var(--dsw-alias-label-secondary,#888);margin-top:4px;word-break:break-all;}',
      '.dsm-status{font-size:12px;margin:8px 0 0;color:var(--dsw-alias-state-success-primary,#22c55e);word-break:break-all;}',
      '.dsm-status.err{color:var(--dsw-alias-state-error-primary,#ef4444);}',
    ].join('\n');

    // ── 工具函数 ─────────────────────────────────────────────────────────
    const CATEGORY_LABELS = {
      tool: '工具', skill: '技能', workflow: '工作流', ui: '界面',
      integration: '集成', other: '其他',
    };
    function categoryLabel(c) { return CATEGORY_LABELS[c] || c || '其他'; }

    function installCommand(p, profile) {
      const spec = p && p.install && p.install.spec;
      if (!spec) return null;
      return 'dsh plugin --profile ' + (profile || 'web') + ' add ' + spec;
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          return ok;
        } catch (e2) {
          return false;
        }
      }
    }

    // ── Remote 贡献（host 一键安装）────────────────────────────────────────
    // client 侧 $mount 要求 strict codec，但 codec.schema 只需有 .parse()，
    // 因此手写极简 schema 即可，无需 zod。
    const STRING_SCHEMA = {
      parse: (value) => {
        if (typeof value !== 'string') throw new Error('expected string');
        return value;
      },
    };
    const INSTALL_RESULT_SCHEMA = {
      parse: (value) => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('expected plain object');
        }
        return value;
      },
    };
    const REMOTE_CONTRIBUTION = {
      package: 'dsh-plugin-market',
      descriptors: [
        {
          id: 'dsh-plugin-market#pluginMarket/installPlugin',
          service: 'pluginMarket',
          namespace: 'pluginMarket',
          method: 'installPlugin',
          invocation: { kind: 'direct' },
          parameters: [
            { name: 'spec', wire: 'spec', source: 'json', codec: { mode: 'strict', typeSymbol: 'string', schema: STRING_SCHEMA } },
            { name: 'profile', wire: 'profile', source: 'json', codec: { mode: 'strict', typeSymbol: 'string', schema: STRING_SCHEMA } },
          ],
          result: { mode: 'strict', typeSymbol: 'object', schema: INSTALL_RESULT_SCHEMA },
        },
        {
          id: 'dsh-plugin-market#pluginMarket/getIndex',
          service: 'pluginMarket',
          namespace: 'pluginMarket',
          method: 'getIndex',
          invocation: { kind: 'direct' },
          parameters: [],
          result: { mode: 'strict', typeSymbol: 'object', schema: INSTALL_RESULT_SCHEMA },
        },
      ],
    };
    // 挂载完成后指向 remote.pluginMarket 命名空间服务（含 install 方法）
    let installApi = null;
    let mountError = null;

    function useInstall(spec, profile) {
      const [state, setState] = useState({ phase: 'idle', message: '' });
      const run = async () => {
        if (installApi === null) {
          setState({ phase: 'error', message: mountError ? ('安装接口未就绪：' + mountError) : '安装接口未就绪' });
          return;
        }
        if (!spec) {
          setState({ phase: 'error', message: '该插件没有可安装的 spec' });
          return;
        }
        setState({ phase: 'running', message: '安装中…' });
        try {
          const res = await installApi.installPlugin(spec, profile);
          if (res && res.ok) {
            const v = res.value || {};
            setState({
              phase: v.ok ? 'done' : 'error',
              message: v.note || v.error || (v.ok ? '安装成功' : '安装失败'),
            });
          } else {
            setState({
              phase: 'error',
              message: (res && res.error && res.error.message) || '调用失败',
            });
          }
        } catch (err) {
          setState({ phase: 'error', message: String((err && err.message) || err) });
        }
      };
      return [state, run];
    }

    // ── 组件 ─────────────────────────────────────────────────────────────
    function SidebarButton(props) {
      const [open, setOpen] = usePanelOpen();
      return h('button', {
        className: 'dsm-trigger',
        title: '插件市场',
        onClick: () => setOpen(!open),
      }, h('span', null, '插件市场'));
    }

    function PluginCard(props) {
      const { p, profile, onDetail } = props;
      const [copied, setCopied] = useState(false);
      const stars = p.github && typeof p.github.stars === 'number' ? p.github.stars : null;
      const source = p.install ? p.install.source : null;
      const category = p.dsh && p.dsh.category;
      const spec = p.install ? p.install.spec : null;
      const [installing, runInstall] = useInstall(spec, profile);

      const doCopy = async () => {
        const cmd = installCommand(p, profile);
        if (!cmd) return;
        const ok = await copyText(cmd);
        setCopied(ok);
        if (ok) setTimeout(() => setCopied(false), 1500);
      };

      return h('div', { className: 'dsm-card' },
        h('div', { className: 'dsm-card-head' },
          h('p', { className: 'dsm-name' }, p.name || p.id),
          stars !== null ? h('span', { className: 'dsm-badge' }, '★ ' + stars) : null
        ),
        p.description ? h('p', { className: 'dsm-desc' }, p.description) : null,
        h('div', { className: 'dsm-badges' },
          p.verified
            ? h('span', { className: 'dsm-badge ok' }, '✓ 已验证')
            : h('span', { className: 'dsm-badge warn' }, '未验证'),
          source ? h('span', { className: 'dsm-badge' }, source === 'npm' ? 'npm' : 'git') : null,
          category ? h('span', { className: 'dsm-badge' }, categoryLabel(category)) : null,
          p.version ? h('span', { className: 'dsm-badge' }, 'v' + p.version) : null
        ),
        h('div', { className: 'dsm-actions' },
          h('button', { className: 'dsm-btn primary', onClick: doCopy }, copied ? '已复制 ✓' : '复制安装命令'),
          h('button', {
            className: 'dsm-btn',
            onClick: runInstall,
            disabled: installing.phase === 'running',
          }, installing.phase === 'running' ? '安装中…' : '一键安装'),
          h('button', { className: 'dsm-btn', onClick: () => onDetail(p) }, '详情')
        ),
        installing.message
          ? h('p', { className: 'dsm-status' + (installing.phase === 'error' ? ' err' : '') }, installing.message)
          : null
      );
    }

    function DetailPane(props) {
      const { p, profile, onBack } = props;
      const [copied, setCopied] = useState(false);
      const cmd = installCommand(p, profile);
      const spec = p.install ? p.install.spec : null;
      const [installing, runInstall] = useInstall(spec, profile);

      const doCopy = async () => {
        if (!cmd) return;
        const ok = await copyText(cmd);
        setCopied(ok);
        if (ok) setTimeout(() => setCopied(false), 1500);
      };

      return h('div', { className: 'dsm-detail' },
        h('button', { className: 'dsm-back', onClick: onBack }, '← 返回列表'),
        h('h3', null, p.name || p.id),
        p.description ? h('p', null, p.description) : null,
        h('div', { className: 'dsm-badges' },
          p.verified
            ? h('span', { className: 'dsm-badge ok' }, '✓ 已验证（dsh.bundle）')
            : h('span', { className: 'dsm-badge warn' }, '未声明 dsh.bundle'),
          p.install ? h('span', { className: 'dsm-badge' }, p.install.source) : null
        ),
        p.author && p.author.name ? h('p', { className: 'dsm-kv' }, '作者：', h('b', null, p.author.name)) : null,
        p.license ? h('p', { className: 'dsm-kv' }, 'License：', h('b', null, p.license)) : null,
        p.version ? h('p', { className: 'dsm-kv' }, '版本：', h('b', null, p.version)) : null,
        p.keywords && p.keywords.length
          ? h('p', { className: 'dsm-kv' }, '关键词：', h('b', null, p.keywords.slice(0, 8).join(' · ')))
          : null,
        p.homepage ? h('p', { className: 'dsm-kv' }, '主页：', h('b', null, p.homepage)) : null,
        p.repository && p.repository.url
          ? h('p', { className: 'dsm-kv' }, '仓库：', h('b', null, p.repository.url))
          : null,
        cmd
          ? h('div', null,
              h('p', { className: 'dsm-kv' }, '安装命令：'),
              h('div', { className: 'dsm-cmd' }, cmd),
              h('div', { className: 'dsm-actions' },
                h('button', { className: 'dsm-btn primary', onClick: doCopy }, copied ? '已复制 ✓' : '复制命令'),
                h('button', {
                  className: 'dsm-btn',
                  onClick: runInstall,
                  disabled: installing.phase === 'running',
                }, installing.phase === 'running' ? '安装中…' : '一键安装')
              ),
              installing.message
                ? h('p', { className: 'dsm-status' + (installing.phase === 'error' ? ' err' : '') }, installing.message)
                : null
            )
          : null
      );
    }

    function MarketOverlay(props) {
      const [open, setOpen] = usePanelOpen();
      const [data, setData] = useState(null);       // { plugins: [] }
      const [error, setError] = useState(null);
      const [query, setQuery] = useState('');
      const [onlyVerified, setOnlyVerified] = useState(false);
      const [category, setCategory] = useState('all');
      const [selected, setSelected] = useState(null);
      const [profile, setProfile] = useState('web');
      const [indexUrl, setIndexUrl] = useState(DEFAULT_INDEX_URL);
      const [loading, setLoading] = useState(false);

      useEffect(() => {
        if (!open || data || error) return;
        let cancelled = false;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        setLoading(true);
        (async () => {
          try {
            let list = [];
            if (indexUrl) {
              // 远程 URL 模式
              const res = await fetch(indexUrl, { cache: 'no-store', signal: ctrl.signal });
              if (!res.ok) throw new Error('HTTP ' + res.status);
              let j;
              try {
                j = await res.json();
              } catch (err) {
                throw new Error('该地址返回的不是 JSON（请确认填的是 index.json 地址，或留空用内置索引）');
              }
              list = Array.isArray(j) ? j : (j && j.plugins) || [];
            } else {
              // 内置索引模式（经 host getIndex）
              if (installApi === null) {
                throw new Error(mountError ? ('安装接口未就绪：' + mountError) : '安装接口未就绪（可点「刷新」重试）');
              }
              const res = await installApi.getIndex();
              if (!(res && res.ok)) {
                throw new Error((res && res.error && res.error.message) || '索引接口调用失败');
              }
              const v = res.value || {};
              if (!v || !v.ok) throw new Error((v && v.error) || '读取内置索引失败');
              list = (v.index && v.index.plugins) || [];
            }
            if (!cancelled) setData({ plugins: list });
          } catch (e) {
            if (!cancelled) {
              const msg = (e && e.name === 'AbortError')
                ? '远程索引超时（8 秒无响应）。留空「索引地址」即可用内置索引，无需联网'
                : String((e && e.message) || e);
              setError(msg);
            }
          } finally {
            clearTimeout(timer);
            if (!cancelled) setLoading(false);
          }
        })();
        return () => { cancelled = true; clearTimeout(timer); ctrl.abort(); };
      }, [open, indexUrl, data, error]);

      const plugins = (data && data.plugins) || [];
      const categories = useMemo(() => {
        const s = new Set();
        plugins.forEach((p) => { const c = p.dsh && p.dsh.category; if (c) s.add(c); });
        return ['all'].concat(Array.from(s).sort());
      }, [plugins]);

      if (!open) return null;

      let filtered = plugins;
      if (onlyVerified) filtered = filtered.filter((p) => p.verified);
      if (category !== 'all') filtered = filtered.filter((p) => (p.dsh && p.dsh.category) === category);
      if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter((p) =>
          (p.name || '').toLowerCase().indexOf(q) >= 0 ||
          (p.description || '').toLowerCase().indexOf(q) >= 0
        );
      }

      const refresh = () => { setData(null); setError(null); setLoading(false); };

      return h('div', null,
        h('button', {
          className: 'dsm-backdrop',
          'aria-label': '关闭',
          onClick: () => setOpen(false),
        }),
        h('div', { className: 'dsm-panel' },
          h('div', { className: 'dsm-header' },
            h('div', null,
              h('p', { className: 'dsm-title' }, '插件市场'),
              h('p', { className: 'dsm-sub' }, 'DeepSeek Harness (DSH) 插件生态')
            ),
            h('button', { className: 'dsm-close', onClick: () => setOpen(false), title: '关闭' }, '×')
          ),
          h('div', { className: 'dsm-toolbar' },
            h('input', {
              className: 'dsm-search',
              placeholder: '搜索插件名称 / 描述…',
              value: query,
              onChange: (ev) => setQuery(ev.target.value),
            }),
            h('div', { className: 'dsm-row' },
              h('label', { className: 'dsm-check' },
                h('input', {
                  type: 'checkbox',
                  checked: onlyVerified,
                  onChange: (ev) => setOnlyVerified(ev.target.checked),
                }),
                '只看已验证'
              ),
              h('select', {
                className: 'dsm-select',
                value: category,
                onChange: (ev) => setCategory(ev.target.value),
              }, categories.map((c) => h('option', { key: c, value: c }, c === 'all' ? '全部分类' : categoryLabel(c)))),
              h('button', { className: 'dsm-btn', onClick: refresh }, loading ? '加载中…' : '刷新'),
              h('button', { className: 'dsm-btn', onClick: () => { setIndexUrl(''); setData(null); setError(null); } }, '用内置索引')
            ),
            h('input', {
              className: 'dsm-search',
              placeholder: '索引地址（留空 = 内置索引；或填远程 index.json URL）',
              value: indexUrl,
              onChange: (ev) => { setIndexUrl(ev.target.value); setData(null); setError(null); },
            })
          ),
          h('div', { className: 'dsm-stats' },
            loading ? '加载中…' : (error ? '加载失败：' + error : '共 ' + plugins.length + ' 个插件 · 已验证 ' + plugins.filter((p) => p.verified).length)
          ),
          selected
            ? h(DetailPane, { p: selected, profile, onBack: () => setSelected(null) })
            : (loading
                ? h('div', { className: 'dsm-empty' }, '正在拉取插件索引…')
                : error
                  ? h('div', { className: 'dsm-empty' }, '无法加载索引：' + error, h('br'), '留空「索引地址」即可用内置索引（无需联网），或点上方「用内置索引」')
                  : h('div', { className: 'dsm-list' },
                      filtered.length === 0
                        ? h('div', { className: 'dsm-empty' }, '没有匹配的插件')
                        : filtered.map((p) => h(PluginCard, { key: p.id || p.name, p, profile, onDetail: setSelected }))
                    )
            ),
          h('div', { className: 'dsm-footer' },
            '安装到 profile:',
            h('input', { value: profile, onChange: (ev) => setProfile(ev.target.value) }),
            h('span', null, '命令：dsh plugin --profile <profile> add <spec>')
          )
        )
      );
    }

    // ── apply ────────────────────────────────────────────────────────────
    function apply(ctx) {
      const slots = ctx.slots;
      const remote = ctx.remote;

      // 挂载 host 安装接口（remote.pluginMarket/install）
      if (remote !== undefined) {
        ctx.effect(async () => {
          let dispose = async () => {};
          try {
            dispose = await remote.$mount(REMOTE_CONTRIBUTION);
            installApi = ctx.get('remote.pluginMarket') ?? null;
            mountError = null;
          } catch (err) {
            mountError = String((err && err.message) || err);
            installApi = null;
            console.error('[plugin-market] 安装接口挂载失败:', err);
          }
          return async () => {
            installApi = null;
            await dispose();
          };
        });
      }

      if (slots === undefined) return;

      insertStyle(CSS);

      slots.inject('sidebar.footer.action', () => slots.register(
        { name: 'sidebar.footer.action', id: 'plugin-market', order: 11, label: '插件市场' },
        (props) => h(SidebarButton, props)
      ));

      slots.inject('shell.overlay', () => slots.register(
        { name: 'shell.overlay', id: 'plugin-market-panel', order: 11 },
        () => h(MarketOverlay, null)
      ));
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
