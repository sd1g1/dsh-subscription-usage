const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CACHE_MS = 60_000;

export const SUPPORTED_PROVIDERS = Object.freeze({
  "openai-codex": "ChatGPT",
  "opencode-go": "OpenCode Zen Go",
});

export function decodeJwtPayload(token) {
  if (typeof token !== "string") return undefined;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[1].length === 0) return undefined;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

function finiteNumber(value) {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function percentage(value) {
  const number = finiteNumber(value);
  return number === undefined ? undefined : Math.min(100, Math.max(0, number));
}

function epochMilliseconds(value) {
  const number = finiteNumber(value);
  if (number !== undefined) return number > 10_000_000_000 ? number : number * 1000;
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function percentFromUsage(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  const direct = percentage(raw.used_percent ?? raw.usedPercent);
  if (direct !== undefined) return direct;
  const limit = finiteNumber(raw.limit ?? raw.entitlement ?? raw.entitlementRequests);
  const used = finiteNumber(raw.used ?? raw.usedRequests);
  if (limit !== undefined && limit > 0 && used !== undefined) return percentage((used / limit) * 100);
  const remainingPercent = percentage(raw.percent_remaining ?? raw.remainingPercentage);
  if (remainingPercent !== undefined) return 100 - remainingPercent;
  const remaining = finiteNumber(raw.remaining ?? raw.quota_remaining);
  if (limit !== undefined && limit > 0 && remaining !== undefined) return percentage(((limit - remaining) / limit) * 100);
  return undefined;
}

function durationLabel(seconds) {
  const value = finiteNumber(seconds);
  if (value === undefined || value <= 0) return undefined;
  if (value % 604800 === 0) return `${value / 604800}周`;
  if (value % 86400 === 0) return `${value / 86400}天`;
  if (value % 3600 === 0) return `${value / 3600}小时`;
  if (value % 60 === 0) return `${value / 60}分钟`;
  return `${Math.round(value)}秒`;
}

function windowSnapshot(raw, fallbackLabel) {
  if (!raw || typeof raw !== "object") return undefined;
  const usedPercent = percentFromUsage(raw);
  if (usedPercent === undefined) return undefined;
  const durationSeconds = finiteNumber(raw.limit_window_seconds);
  const resetsAt = epochMilliseconds(raw.reset_at ?? raw.resetAt ?? raw.reset_time ?? raw.resetTime ?? raw.resetDate);
  return {
    label: raw.name ?? raw.title ?? durationLabel(durationSeconds) ?? fallbackLabel,
    usedPercent,
    remainingPercent: 100 - usedPercent,
    ...(resetsAt === undefined ? {} : { resetsAt }),
  };
}

export function parseCodexUsage(payload) {
  if (!payload || typeof payload !== "object") return [];
  const rate = payload.rate_limit && typeof payload.rate_limit === "object" ? payload.rate_limit : {};
  const windows = [
    windowSnapshot(rate.primary_window, "主要限额"),
    windowSnapshot(rate.secondary_window, "次要限额"),
  ].filter(Boolean);
  return windows;
}

const OPENCODE_WINDOWS = [
  ["rolling", "滚动限额"],
  ["weekly", "周限额"],
  ["monthly", "月限额"],
];

export function parseOpenCodeUsage(payload) {
  if (!payload || typeof payload !== "object") return [];
  const usage = payload.usage && typeof payload.usage === "object" ? payload.usage : {};
  const windows = [];
  for (const [key, label] of OPENCODE_WINDOWS) {
    const raw = usage[key];
    if (!raw || typeof raw !== "object") continue;
    const usedPercent = percentage(raw.percent);
    if (usedPercent === undefined) continue;
    windows.push({
      label,
      usedPercent,
      remainingPercent: 100 - usedPercent,
      ...(raw.resetsAt === undefined ? {} : { resetsAt: epochMilliseconds(raw.resetsAt) }),
    });
  }
  return windows;
}

function publicError(error) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "查询超时";
    return error.message;
  }
  return String(error);
}

function jsonResponse(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
}

function accountIdFromCodexToken(token) {
  const payload = decodeJwtPayload(token);
  const auth = payload?.["https://api.openai.com/auth"];
  return typeof auth?.chatgpt_account_id === "string" ? auth.chatgpt_account_id : undefined;
}

/** OAuth grant 固定地址：dsh-llm-pi-ai 的 recordKeyFor("openai-codex") */
const CODEX_GRANT_KEY = "llm-pi-ai/openai-codex";

async function resolveCodexToken(ctx, credentialRef) {
  // 1) 优先读 OAuth grant（自动刷新后的 access）
  try {
    const record = await ctx.credentials.readRecord(CODEX_GRANT_KEY);
    if (record?.kind === "grant" && record.payload?.type === "oauth" && typeof record.payload.access === "string" && record.payload.access.length > 0) {
      const accountId = typeof record.payload.accountId === "string" && record.payload.accountId.length > 0
        ? record.payload.accountId
        : accountIdFromCodexToken(record.payload.access);
      return { token: record.payload.access, accountId };
    }
  } catch {
    // readRecord 失败回退到 ref
  }
  // 2) 回退读旧 ref（兼容 apiKeyEnv 写法）
  if (credentialRef) {
    try {
      const credential = await ctx.credentials.resolve(credentialRef);
      if (credential?.value) {
        return { token: credential.value, accountId: accountIdFromCodexToken(credential.value) };
      }
    } catch {}
  }
  return undefined;
}

export class ProviderUsageService {
  constructor(ctx, config = {}) {
    this.ctx = ctx;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.cacheMs = config.cacheMs ?? DEFAULT_CACHE_MS;
    this.cache = new Map();
    this.inflight = new Map();
    this.epoch = 0;
    ctx.on("credentials/updated", (ref) => {
      for (const [provider, spec] of Object.entries(config.providers ?? {})) {
        if (spec.credentialRef === ref) this.cache.delete(provider);
      }
    });
    ctx.on("credentials/record-updated", (key) => {
      if (key === CODEX_GRANT_KEY) this.cache.delete("openai-codex");
    });
  }

  async snapshot(provider, config) {
    const cached = this.cache.get(provider);
    if (cached && Date.now() - cached.fetchedAt < this.cacheMs) return cached;
    const active = this.inflight.get(provider);
    if (active) return active;
    const epoch = this.epoch;
    const promise = this.fetchProvider(provider, config)
      .then((result) => {
        // 查询期间若发生过作废（epoch 变化），该结果已过期，不再写入缓存。
        if (epoch === this.epoch) this.cache.set(provider, result);
        return result;
      })
      .finally(() => this.inflight.delete(provider));
    this.inflight.set(provider, promise);
    return promise;
  }

  /** 作废全部 Provider 的用量缓存（含在途查询），下一次查询强制重新拉取。 */
  invalidateAll() {
    this.epoch += 1;
    this.cache.clear();
    this.inflight.clear();
  }

  async fetchProvider(provider, config) {
    const fetchedAt = Date.now();
    try {
      let token;
      let accountId;
      if (provider === "openai-codex") {
        const resolved = await resolveCodexToken(this.ctx, config.credentialRef);
        if (!resolved?.token) return { provider, status: "not-configured", windows: [], fetchedAt };
        token = resolved.token;
        accountId = resolved.accountId;
      } else {
        const credential = await this.ctx.credentials.resolve(config.credentialRef);
        if (!credential?.value) return { provider, status: "not-configured", windows: [], fetchedAt };
        token = credential.value;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };
        if (provider === "openai-codex") {
          headers["User-Agent"] = "codex-cli";
          if (accountId) headers["ChatGPT-Account-Id"] = accountId;
        }
        const response = await fetch(config.url, { headers, signal: controller.signal });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          const suffix = body.trim() ? `: ${body.trim().slice(0, 160)}` : "";
          throw new Error(`HTTP ${response.status}${suffix}`);
        }
        const payload = await response.json();
        const windows = provider === "openai-codex" ? parseCodexUsage(payload)
          : provider === "opencode-go" ? parseOpenCodeUsage(payload)
          : [];
        return {
          provider,
          status: windows.length > 0 ? "ready" : "unsupported",
          windows,
          fetchedAt,
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      return { provider, status: "error", windows: [], fetchedAt, error: publicError(error) };
    }
  }
}

export function defaultProviders(config = {}) {
  return {
    "openai-codex": {
      credentialRef: config.openaiCodexCredentialRef ?? "OPENAI_CODEX_ACCESS_TOKEN",
      url: config.openaiCodexUsageUrl ?? "https://chatgpt.com/backend-api/wham/usage",
    },
    "opencode-go": {
      credentialRef: config.opencodeGoCredentialRef ?? "OPENCODE_API_KEY",
      url: config.opencodeGoUsageUrl ?? "https://opencode.ai/zen/go/v1/usage",
    },
  };
}

export function createUsageRoute(service, providers) {
  return async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD" });
      res.end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const provider = url.searchParams.get("provider");
    if (!provider || !Object.hasOwn(providers, provider)) {
      jsonResponse(res, 400, { error: "unsupported provider" });
      return;
    }
    const result = await service.snapshot(provider, providers[provider]);
    if (req.method === "HEAD") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end();
      return;
    }
    jsonResponse(res, 200, result);
  };
}
