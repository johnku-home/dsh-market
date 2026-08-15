// serve-index.mjs — 把 index.json 以 CORS 静态服务暴露，供面板浏览器端 fetch。
// 运行：node scripts/serve-index.mjs  （可用 PORT 环境变量改端口，默认 8787）

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(here, '../index.json');
const port = Number(process.env.PORT || 8787);

const json = await readFile(indexPath, 'utf8');

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === '/' || req.url === '/index.json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(200);
    res.end(json);
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[serve-index] 已启动: http://127.0.0.1:${port}/index.json`);
});
