// fetch.js — 带重试与限流处理的 fetch 封装（零依赖）

const UA = 'dsh-market-crawler/0.1.0 (+https://github.com/dsh-market)';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 发起请求，处理 404（返回 null）与 403/429（按 Retry-After 退避重试）。
 * @param {string} url
 * @param {{ headers?: Record<string,string>, retries?: number, backoff?: number }} [opts]
 * @returns {Promise<Response|null>}
 */
async function doFetch(url, { headers = {}, retries = 3, backoff = 1000, timeoutMs = 15000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        headers: { 'user-agent': UA, ...headers },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(backoff * (attempt + 1));
        continue;
      }
      break;
    }

    if (res.status === 404) return null;
    if (res.status === 403 || res.status === 429) {
      const now = Math.floor(Date.now() / 1000);
      const reset = Number(res.headers.get('x-ratelimit-reset')) || 0;
      const ra = Number(res.headers.get('retry-after')) || 0;
      const untilReset = reset > now ? (reset - now) * 1000 : 0;
      const wait = Math.max(ra * 1000, untilReset, backoff * (attempt + 1));
      console.warn(`  [rate-limit] ${res.status} ${url} → 等待 ${Math.round(wait / 1000)}s`);
      if (attempt < retries) {
        await sleep(wait);
        continue;
      }
      throw new Error(`Rate limited on ${url}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return res;
  }
  throw lastError ?? new Error(`fetch failed: ${url}`);
}

export async function fetchJson(url, opts) {
  const res = await doFetch(url, opts);
  if (res === null) return null;
  return res.json();
}

export async function fetchText(url, opts) {
  const res = await doFetch(url, opts);
  if (res === null) return null;
  return res.text();
}
