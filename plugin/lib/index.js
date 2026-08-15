// dsh-plugin-market — Host（node）半区。
// 提供 Typert Remote 服务 `pluginMarket`，暴露 `install(spec, profile)` 供浏览器半区
// 一键安装。浏览器半区见 ./client.js。

import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';

export const name = 'plugin-market';
export const inject = [];

// ── 手动应用 @Remote("install") 标记 ──────────────────────────────────────
// 等价于 TypeScript 编译后的 __esDecorate + __runInitializers：
// `Remote("install")` 返回装饰器，用一个人工 decorator context 触发标记收集，
// 构造实例时再逐个执行 initializer，把 "install" 记入 typert-protocol 的私有标记表。
// 这样 SRC 模式（无需 codegen）即可发现并调用该方法。
const remoteInitializers = [];
function collectRemote(methodName) {
  Remote(methodName)(undefined, {
    kind: 'method',
    name: methodName,
    static: false,
    private: false,
    addInitializer: (fn) => remoteInitializers.push(fn),
  });
}
collectRemote('installPlugin');
collectRemote('getIndex');

// ── 参数校验（防命令注入）─────────────────────────────────────────────────
const SAFE_PROFILE = /^[A-Za-z0-9._-]{1,64}$/;

function safeSpec(spec) {
  if (typeof spec !== 'string' || !spec || spec.length > 512) return false;
  if (/[\s;|&<>`$()]/.test(spec)) return false;
  return (
    // npm 包名 / @scope/name 或 带 @version
    /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[^/@\s]+)?$/.test(spec) ||
    // github:owner/repo
    /^github:[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(spec) ||
    // git+https / git+ssh
    /^git\+(https?|ssh):\/\/\S+$/.test(spec) ||
    // https tarball
    /^https?:\/\/\S+$/.test(spec) ||
    // file: / link: 本地路径
    /^(file|link):\S+$/.test(spec)
  );
}

/** 拼接两个字符串并按上限截断（保留尾部）。 */
function cap(value, limit = 8192) {
  return value.length > limit ? value.slice(-limit) : value;
}

/** 定位 DSH_HOME（profile 根目录）。 */
function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh');
}

/** 读取 profile 的 package.json，返回 { deps, bundles } 快照；失败返回 null。 */
async function profileSnapshot(profile) {
  const file = join(dshHome(), 'profiles', profile, 'package.json');
  try {
    const pkg = JSON.parse(await readFile(file, 'utf8'));
    const deps = Object.keys(pkg.dependencies || {});
    const bundles = Array.isArray(pkg.dsh?.profile?.bundles) ? pkg.dsh.profile.bundles : [];
    return { deps, bundles };
  } catch {
    return null;
  }
}

/** 对比安装前后快照，返回新增的依赖 / bundle 名。 */
function diffSnapshot(before, after) {
  if (!before || !after) return [];
  const addedDeps = after.deps.filter((d) => !before.deps.includes(d));
  const addedBundles = after.bundles.filter((b) => !before.bundles.includes(b));
  return [...new Set([...addedDeps, ...addedBundles])];
}

/** 内置 index.json（随包发布，面板无需再另开 8787 索引服务）。 */
const INDEX_FILE = fileURLToPath(new URL('../index.json', import.meta.url));
let indexCache = null;
async function loadIndex() {
  if (indexCache) return indexCache;
  const raw = await readFile(INDEX_FILE, 'utf8');
  indexCache = JSON.parse(raw.replace(/^\uFEFF/, ''));
  return indexCache;
}

/** Remote 服务：`dsh plugin --profile <profile> add <spec>` + 内置索引。 */
class PluginMarketService extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'pluginMarket');
    for (const init of remoteInitializers) init.call(this);
  }

  // 返回内置 index.json（原始对象，含 plugins 数组）。
  async getIndex() {
    try {
      return { ok: true, index: await loadIndex() };
    } catch (err) {
      return { ok: false, error: '读取内置索引失败：' + String((err && err.message) || err) };
    }
  }

  // SRC 模式：参数名从函数签名解析，必须是简单标识符（不可解构/默认值/rest）。
  async installPlugin(spec, profile) {
    if (!safeSpec(spec)) {
      return { ok: false, code: null, spec: String(spec), profile: null, stdout: '', stderr: '', error: '拒绝安装：目标不是合法的包 / git / 链接 spec' };
    }
    const targetProfile = SAFE_PROFILE.test(String(profile ?? '')) ? String(profile) : 'web';
    const before = await profileSnapshot(targetProfile);

    return new Promise((resolve) => {
      let settled = false;
      let timer;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(value);
      };

      const child = spawn('dsh', ['plugin', '--profile', targetProfile, 'add', spec], {
        shell: process.platform === 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (d) => { stdout = cap(stdout + String(d)); });
      child.stderr?.on('data', (d) => { stderr = cap(stderr + String(d)); });

      // 90 秒超时：终止卡住的安装进程树并返回错误，避免面板无限「安装中」。
      timer = setTimeout(() => {
        try {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
          } else {
            child.kill('SIGKILL');
          }
        } catch {}
        settle({
          ok: false,
          code: null,
          spec,
          profile: targetProfile,
          stdout: cap(stdout),
          stderr: cap(stderr),
          error: '安装超时（90 秒）已终止。若该插件是 repository-plugin（.dsh-plugin 子目录），直接 github: 仓库可能装不了，需要带 path 子目录的 spec。',
        });
      }, 90000);

      child.on('error', (err) => settle({
        ok: false,
        code: null,
        spec,
        profile: targetProfile,
        stdout,
        stderr,
        error: String((err && err.message) || err),
      }));

      child.on('close', (code) => {
        if (code !== 0) {
          settle({
            ok: false,
            code: code === null ? null : code,
            spec,
            profile: targetProfile,
            stdout,
            stderr,
            error: stderr.slice(-2048) || '安装失败',
          });
          return;
        }
        // 退出码 0 不代表真的装上了：回头校验 package.json 是否新增了内容。
        profileSnapshot(targetProfile).then((after) => {
          const added = diffSnapshot(before, after);
          if (added.length > 0) {
            settle({
              ok: true,
              code,
              spec,
              profile: targetProfile,
              stdout,
              stderr,
              error: null,
              note: '安装成功；bundle 需重启 web 后生效',
            });
          } else {
            settle({
              ok: false,
              code,
              spec,
              profile: targetProfile,
              stdout,
              stderr,
              error: '未检测到新安装（可能已安装过，或该 spec 未能新增 bundle）。dsh 输出：' + cap(stdout + '\n' + stderr, 2048),
            });
          }
        }).catch((e) => settle({
          ok: false,
          code,
          spec,
          profile: targetProfile,
          stdout,
          stderr,
          error: '校验安装结果失败：' + String((e && e.message) || e),
        }));
      });
    });
  }
}

/** 注册 Typert Remote 服务；Service 构造器已自动 ctx.provide。 */
export function apply(ctx) {
  new PluginMarketService(ctx);
}
