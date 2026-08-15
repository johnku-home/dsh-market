// smoke-host.mjs — 用真实的 dsh-typert-protocol 验证「手动 @Remote 标记」机制。
// 运行：node scripts/smoke-host.mjs

import { pathToFileURL } from 'node:url';

const ROOT = 'C:/Users/晶鑫/AppData/Roaming/npm/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai';
const { Remote, TypertRemoteService, remoteMethods } = await import(
  pathToFileURL(ROOT + '/dsh-typert-protocol/lib/index.js').href
);

// 复刻 host/lib/index.js 里的手动 @Remote("installPlugin") 标记
const initializers = [];
Remote('installPlugin')(undefined, {
  kind: 'method',
  name: 'installPlugin',
  static: false,
  private: false,
  addInitializer: (fn) => initializers.push(fn),
});

class PluginMarketService extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'pluginMarket');
    for (const init of initializers) init.call(this);
  }
  // SRC 模式：参数名从函数签名解析，必须简单标识符
  installPlugin(spec, profile) {
    return { ok: true, spec, profile };
  }
}

// 最小 Cordis ctx mock（Service 构造器只用到 reflect.provide）
const provided = {};
const ctx = {
  reflect: { provide: (name, value) => { provided[name] = value; } },
};

const svc = new PluginMarketService(ctx);

console.log('provided      =', Object.keys(provided));
console.log('namespace     =', svc.typertRemote.namespace);
console.log('remoteMethods =', JSON.stringify(remoteMethods(svc)));

const marker = remoteMethods(svc).find((m) => m.method === 'installPlugin');
if (!marker || marker.invocation.kind !== 'direct') {
  throw new Error('手动 @Remote 标记失败');
}
if (svc.typertRemote.namespace !== 'pluginMarket') {
  throw new Error('namespace 错误: ' + svc.typertRemote.namespace);
}

// 验证参数名解析（SRC 模式会从函数源码读取）
const src = Function.prototype.toString.call(svc.installPlugin);
const params = src.slice(src.indexOf('(') + 1, src.indexOf(')')).split(',').map((s) => s.trim());
console.log('installPlugin 参数 =', JSON.stringify(params));
if (params.join(',') !== 'spec,profile') {
  throw new Error('installPlugin 参数名不符合 SRC 要求: ' + params.join(','));
}

console.log('SMOKE-HOST PASSED');
