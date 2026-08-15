// github.js — GitHub topic 采集（分页）

import { fetchJson, fetchText, sleep } from './fetch.js';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';

function authHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}

/**
 * 按 topic 搜索仓库，按 star 降序，分页拉取。
 * 未认证搜索限 10 次/分钟，页面间留间隔。
 * @param {string} topic
 * @param {{ maxPages?: number, perPage?: number }} [opts]
 * @returns {Promise<any[]>}
 */
export async function searchReposByTopic(topic = 'dsh-plugin', { maxPages = 10, perPage = 100 } = {}) {
  const headers = { accept: 'application/vnd.github+json', ...authHeaders() };
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const q = encodeURIComponent(`topic:${topic}`);
    const url = `${API}/search/repositories?q=${q}&sort=stars&order=desc&per_page=${perPage}&page=${page}`;
    const data = await fetchJson(url, { headers });
    const batch = data?.items ?? [];
    if (!batch.length) break;
    items.push(...batch);
    if (batch.length < perPage) break;
    if (page < maxPages) await sleep(6500);
  }
  return items;
}

/**
 * 拉取仓库默认分支的 package.json；默认分支取不到时回退 main / master。
 * @param {{ full_name: string, default_branch?: string }} repo
 * @returns {Promise<object|null>}
 */
export async function fetchPackageJson(repo) {
  const branches = [repo.default_branch, 'main', 'master'].filter(Boolean);
  const seen = new Set();
  for (const branch of branches) {
    if (seen.has(branch)) continue;
    seen.add(branch);
    const url = `${RAW}/${repo.full_name}/${branch}/package.json`;
    const text = await fetchText(url);
    if (text !== null) {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }
  }
  return null;
}
