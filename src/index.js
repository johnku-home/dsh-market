// index.js — 爬虫编排：GitHub topic + npm 关键字 → index.json

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sleep } from './lib/fetch.js';
import { searchReposByTopic, fetchPackageJson } from './lib/github.js';
import { searchNpmByKeyword, fetchPackage } from './lib/npm.js';
import { githubEntry, npmEntry, merge } from './lib/normalize.js';

const TOPIC = 'dsh-plugin';
const OUT = resolve(process.cwd(), 'index.json');
const POLITE_DELAY = 150; // 请求间隔（ms）
const MAX_GITHUB_PAGES = Number(process.env.MAX_GITHUB_PAGES || 10);
const NPM_KEYWORDS = (process.env.NPM_KEYWORDS || 'dsh-plugin')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  const t0 = Date.now();
  console.log(`[dsh-market] 开始同步 (github 页数≤${MAX_GITHUB_PAGES}, npm 关键字: ${NPM_KEYWORDS.join(', ')})`);

  // ---- 1. GitHub topic（分页） ----
  const repos = await searchReposByTopic(TOPIC, { maxPages: MAX_GITHUB_PAGES });
  console.log(`[github] 抓到 ${repos.length} 个仓库`);

  const githubEntries = [];
  const excluded = [];
  let githubErrors = 0;
  for (const repo of repos) {
    let pkg;
    try {
      pkg = await fetchPackageJson(repo);
    } catch (err) {
      githubErrors++;
      excluded.push(`${repo.full_name} (${err.message})`);
      await sleep(POLITE_DELAY);
      continue;
    }
    if (!pkg) {
      excluded.push(repo.full_name);
      await sleep(POLITE_DELAY);
      continue;
    }
    githubEntries.push(githubEntry(repo, pkg));
    await sleep(POLITE_DELAY);
  }

  // ---- 2. npm 关键字（精确 + 分页 + 去重） ----
  const objects = [];
  const seenNpmNames = new Set();
  for (const kw of NPM_KEYWORDS) {
    const objs = await searchNpmByKeyword(kw);
    for (const o of objs) {
      const n = o.package?.name;
      if (!n || seenNpmNames.has(n)) continue;
      seenNpmNames.add(n);
      objects.push(o);
    }
  }
  console.log(`[npm] 关键字命中 ${objects.length} 个去重包`);

  const npmEntries = [];
  let npmErrors = 0;
  for (const o of objects) {
    const name = o.package.name;
    let doc;
    try {
      doc = await fetchPackage(name);
    } catch {
      npmErrors++;
      await sleep(POLITE_DELAY);
      continue;
    }
    if (!doc) continue;
    const version = doc['dist-tags']?.latest;
    const manifest = version ? doc.versions?.[version] : null;
    if (!manifest) continue;
    npmEntries.push(npmEntry(name, doc, manifest));
    await sleep(POLITE_DELAY);
  }

  // ---- 3. 合并去重 ----
  const plugins = merge([...npmEntries, ...githubEntries]);

  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sources: {
      githubTopic: TOPIC,
      githubReposFound: repos.length,
      npmKeywords: NPM_KEYWORDS,
      npmPackagesFound: objects.length,
    },
    stats: {
      plugins: plugins.length,
      verified: plugins.filter((p) => p.verified).length,
      npm: plugins.filter((p) => p.npm).length,
      githubOnly: plugins.filter((p) => p.npm === null).length,
    },
    plugins,
  };

  await writeFile(OUT, JSON.stringify(index, null, 2) + '\n', 'utf8');

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[dsh-market] 完成：${plugins.length} 个插件（verified ${index.stats.verified}），用时 ${secs}s`);
  console.log(`[dsh-market] 输出 → ${OUT}`);
  if (excluded.length) {
    console.log(`[dsh-market] 排除 ${excluded.length} 个 GitHub 仓库（无 package.json 或抓取失败）`);
  }
  if (githubErrors) console.log(`[dsh-market] GitHub 抓取失败 ${githubErrors} 次`);
  if (npmErrors) console.log(`[dsh-market] npm 抓取失败 ${npmErrors} 次`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
