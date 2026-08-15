// smoke-client.mjs — 在 Node 里用 mock 环境加载插件 client.js，验证模块结构与 apply 路径。
// 运行：node scripts/smoke-client.mjs

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(resolve(here, '../plugin/lib/client.js'), 'utf8');

// mock DOM
const head = { appendChild() {} };
const documentMock = {
  createElement() {
    return { textContent: '', style: {}, remove() {}, appendChild() {}, select() {}, setAttribute() {} };
  },
  head,
  body: { appendChild() {} },
};

let captured = null;
globalThis.window = { __ModuleLoader__: { load: (spec) => { captured = spec; } } };
globalThis.document = documentMock;

// 执行 client.js 顶层代码
new Function(code)();

if (!captured) throw new Error('未捕获到 __ModuleLoader__.load 调用');

const mockReact = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (init) => [init, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useRef: (v) => ({ current: v }),
};

const mod = captured.factory((name) => {
  if (name === 'react') return mockReact;
  throw new Error('unexpected require: ' + name);
});

console.log('id          =', captured.id);
console.log('name        =', mod.name);
console.log('inject      =', JSON.stringify(mod.inject));
if (typeof mod.apply !== 'function') throw new Error('缺少 apply 函数');

// mock slots 服务，记录 inject/register 调用
const interactions = [];
const slots = {
  inject: (slotName, cb) => { interactions.push('inject:' + slotName); cb(); },
  register: (opts) => { interactions.push('register:' + opts.name + ':' + opts.id); },
};

const remote = {
  $mount: async (contribution) => {
    interactions.push('mount:' + contribution.package);
    return async () => {};
  },
};
const ctx = {
  slots,
  remote,
  effect: (fn) => { fn().catch(() => {}); return () => {}; },
  get: (n) => (n === 'remote.pluginMarket' ? null : undefined),
};

mod.apply(ctx);
console.log('apply        = OK');
for (const line of interactions) console.log('  ' + line);

const expect = ['sidebar.footer.action', 'shell.overlay'];
for (const slot of expect) {
  if (!interactions.some((i) => i.startsWith('inject:' + slot))) {
    throw new Error('缺少槽位注册: ' + slot);
  }
}
if (!interactions.some((i) => i.startsWith('mount:'))) {
  throw new Error('缺少 remote $mount 调用');
}

console.log('SMOKE TEST PASSED');
