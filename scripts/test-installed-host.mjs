// test-installed-host.mjs — 直接 import 安装位置的真实 host 半区，验证加载与 @Remote 标记。
import { pathToFileURL } from 'node:url';

const profTypert = 'C:/Users/晶鑫/.dsh/profiles/node_modules/@deepseek-ai/dsh-typert-protocol/lib/index.js';
const { remoteMethods } = await import(pathToFileURL(profTypert).href);

const installedIndex = 'C:/Users/晶鑫/.dsh/profiles/web/node_modules/dsh-plugin-market/lib/index.js';

let mod;
try {
  mod = await import(pathToFileURL(installedIndex).href + '?t=' + Date.now());
} catch (e) {
  console.error('❌ 导入安装位置的 lib/index.js 失败:', e.message);
  process.exit(1);
}

console.log('✅ 导入成功，导出 =', Object.keys(mod));

const provided = {};
const ctx = {
  reflect: { provide: (name, value) => { provided[name] = value; } },
};

if (typeof mod.apply !== 'function') {
  console.error('❌ 模块没有导出 apply');
  process.exit(1);
}
mod.apply(ctx);

const svc = provided['pluginMarket'];
if (!svc) {
  console.error('❌ apply 后没有提供 pluginMarket 服务');
  process.exit(1);
}
console.log('✅ 已提供 pluginMarket 服务');
console.log('   namespace =', svc.typertRemote?.namespace);
console.log('   remoteMethods =', JSON.stringify(remoteMethods(svc)));
