// normalize.js — 把 GitHub 仓库与 npm 包归一化为统一 PluginEntry，并去重合并

const PLUGIN_TOPIC = 'dsh-plugin';

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function normalizeAuthor(author) {
  if (!author) return null;
  if (typeof author === 'string') return { name: author };
  const name = author.name;
  if (!name) return null;
  const out = { name };
  if (author.email) out.email = author.email;
  if (author.url) out.url = author.url;
  return out;
}

function normalizeLicense(license, githubLicense) {
  if (typeof license === 'string') return license;
  if (license && license.type) return license.type;
  if (githubLicense && githubLicense.spdx_id) return githubLicense.spdx_id;
  return null;
}

/**
 * 从 repository 字段反解出 owner/repo。
 * 兼容 "git+https://github.com/o/r.git"、"git://github.com/o/r"、"git@github.com:o/r.git"、"github:o/r"。
 * @param {string|{url?: string}|undefined|null} repository
 */
export function parseGithubRepo(repository) {
  if (!repository) return null;
  const url = typeof repository === 'string' ? repository : repository.url;
  if (!url) return null;
  const cleaned = url
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');
  const m = /github\.com[:/]([^/]+)\/([^/]+)$/i.exec(cleaned);
  return m ? { owner: m[1], repo: m[2] } : null;
}

function categoryFrom(manifest) {
  const declared = manifest?.dsh?.plugin?.category;
  if (declared) return declared;
  const kw = new Set(asArray(manifest?.keywords).map((k) => String(k).toLowerCase()));
  const rules = [
    ['skill', ['skill']],
    ['workflow', ['workflow']],
    ['tool', ['tool']],
    ['ui', ['ui', 'theme']],
    ['integration', ['integration', 'mcp', 'onebot', 'im']],
  ];
  for (const [cat, needles] of rules) {
    if (needles.some((n) => kw.has(n))) return cat;
  }
  return 'other';
}

function isBundle(manifest) {
  return manifest?.dsh?.bundle?.patch !== undefined;
}

/**
 * 由 GitHub 仓库 + 其 package.json 构造 PluginEntry（npm 字段暂为 null，合并阶段补）。
 */
export function githubEntry(repo, pkg) {
  const owner = repo.owner?.login;
  const repoName = repo.name;
  const fullName = repo.full_name;
  const pkgName = pkg?.name || null;
  const bundle = isBundle(pkg);

  return {
    id: `github:${fullName}`,
    name: pkgName || repoName,
    description: pkg?.description || repo.description || null,
    version: pkg?.version || null,
    author: normalizeAuthor(pkg?.author),
    license: normalizeLicense(pkg?.license, repo.license),
    keywords: asArray(pkg?.keywords),
    homepage: pkg?.homepage || repo.homepage || null,
    repository: { type: 'git', url: repo.html_url },
    // GitHub 线不猜 npm 源：git spec 始终可安装，npm 已发布的包由 npm 线兜底
    install: { source: 'git', spec: `github:${fullName}` },
    npm: null,
    github: {
      owner,
      repo: repoName,
      fullName,
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? 0,
      pushedAt: repo.pushed_at ?? null,
      description: repo.description ?? null,
      defaultBranch: repo.default_branch ?? null,
      topic: Array.isArray(repo.topics) && repo.topics.includes(PLUGIN_TOPIC),
    },
    dsh: bundle ? { category: categoryFrom(pkg) } : null,
    verified: bundle,
    updatedAt: repo.pushed_at ?? null,
    // 内部用：包名，用于合并阶段判断是否已存在于 npm 线
    _npmName: pkgName,
  };
}

/**
 * 由 npm 包构造 PluginEntry。
 */
export function npmEntry(name, doc, manifest) {
  const repo = parseGithubRepo(manifest?.repository || doc.repository);
  const bundle = isBundle(manifest);
  const version = manifest?.version || doc['dist-tags']?.latest || null;
  const dist = manifest?.dist || {};

  return {
    id: `npm:${name}`,
    name: manifest?.name || name,
    description: manifest?.description || doc.description || null,
    version,
    author: normalizeAuthor(manifest?.author),
    license: normalizeLicense(manifest?.license),
    keywords: asArray(manifest?.keywords),
    homepage: manifest?.homepage || null,
    repository: manifest?.repository
      ? {
          type: 'git',
          url: typeof manifest.repository === 'string' ? manifest.repository : manifest.repository.url,
        }
      : null,
    install: { source: 'npm', spec: name },
    npm: {
      name,
      version,
      date: (doc.time || {})[version] || null,
      tarball: dist.tarball || null,
    },
    github: repo ? { owner: repo.owner, repo: repo.repo, fullName: `${repo.owner}/${repo.repo}` } : null,
    dsh: bundle ? { category: categoryFrom(manifest) } : null,
    verified: bundle,
    updatedAt: (doc.time || {}).modified || null,
  };
}

function repoKey(owner, repo) {
  return `${owner}/${repo}`.toLowerCase();
}

/**
 * 合并去重：npm 条目为主，用 GitHub 线补 stars 等；GitHub 线里
 * 已存在于 npm 的仓库跳过，其余作为 git-only 插件保留。
 * @param {object[]} entries
 * @returns {object[]}
 */
export function merge(entries) {
  const npmIndex = new Map();
  const githubIndex = new Map();
  const githubByNpmName = new Map();

  for (const e of entries) {
    if (e.npm && e.npm.name) npmIndex.set(e.npm.name, e);
    // 只有 GitHub 线条目（npm === null）进入 githubIndex；npm 条目已由 npmIndex 代表
    if (e.npm === null && e.github && e.github.owner && e.github.repo) {
      const key = repoKey(e.github.owner, e.github.repo);
      if (!githubIndex.has(key)) githubIndex.set(key, e);
    }
    if (e._npmName && !githubByNpmName.has(e._npmName)) githubByNpmName.set(e._npmName, e);
  }

  const merged = [];

  // npm 条目为主，补 GitHub 数据（优先按 repository 反解，其次按包名直连）
  for (const [name, entry] of npmIndex) {
    if (entry.repository) {
      const repo = parseGithubRepo(entry.repository);
      if (repo) {
        const gh = githubIndex.get(repoKey(repo.owner, repo.repo));
        if (gh && gh.github) {
          entry.github = gh.github;
          entry.updatedAt = entry.updatedAt || gh.updatedAt;
        }
      }
    }
    if (!entry.github?.stars) {
      const gh = githubByNpmName.get(name);
      if (gh && gh.github) {
        entry.github = gh.github;
        entry.updatedAt = entry.updatedAt || gh.updatedAt;
      }
    }
    delete entry._npmName;
    merged.push(entry);
  }

  // GitHub 线里未发布 npm 的仓库
  for (const [key, entry] of githubIndex) {
    if (entry._npmName && npmIndex.has(entry._npmName)) continue;
    delete entry._npmName;
    merged.push(entry);
  }

  merged.sort((a, b) => {
    const av = a.verified ? 1 : 0;
    const bv = b.verified ? 1 : 0;
    if (bv !== av) return bv - av;
    const as = a.github?.stars ?? 0;
    const bs = b.github?.stars ?? 0;
    if (bs !== as) return bs - as;
    return String(a.name).localeCompare(String(b.name));
  });

  return merged;
}
