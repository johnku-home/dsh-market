// npm.js — npm registry 采集（按关键字精确匹配 + 分页）

import { fetchJson } from './fetch.js';

const REGISTRY = 'https://registry.npmjs.org';

/**
 * 按 keywords 精确搜索 npm 包，分页拉取。
 * @param {string} keyword
 * @param {{ perPage?: number, maxFrom?: number }} [opts]
 * @returns {Promise<any[]>} 返回 objects 数组
 */
export async function searchNpmByKeyword(keyword = 'dsh-plugin', { perPage = 250, maxFrom = 10000 } = {}) {
  const out = [];
  for (let from = 0; from < maxFrom; from += perPage) {
    const url = `${REGISTRY}/-/v1/search?text=${encodeURIComponent(`keywords:${keyword}`)}&size=${perPage}&from=${from}`;
    const data = await fetchJson(url);
    const objects = data?.objects ?? [];
    out.push(...objects);
    if (!objects.length || objects.length < perPage) break;
  }
  return out;
}

/**
 * 拉取单个包的 registry 全量元数据。
 * @param {string} name
 * @returns {Promise<object|null>}
 */
export async function fetchPackage(name) {
  return fetchJson(`${REGISTRY}/${encodeURIComponent(name)}`);
}
