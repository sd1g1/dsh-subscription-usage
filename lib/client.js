window.__ModuleLoader__.load({
  id: "@local/dsh-subscription-usage",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const jsx = require("react/jsx-runtime");

    const css = `
      .dsh-subscription-usage-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 24px;
        padding: 0 7px;
        border: 1px solid var(--dsw-alias-border-l3);
        border-radius: 12px;
        color: var(--dsw-alias-label-secondary);
        background: var(--dsw-alias-bg-base);
        font-size: 11px;
        line-height: 16px;
        white-space: nowrap;
        flex: none;
      }
      .dsh-subscription-usage-badge[data-status="loading"] {
        color: var(--dsw-alias-label-caption);
      }
      .dsh-subscription-usage-badge[data-level="warn"] {
        color: var(--dsw-alias-state-warn-label);
        border-color: var(--dsw-alias-state-warn-label);
      }
      .dsh-subscription-usage-badge[data-level="danger"] {
        color: var(--dsw-alias-state-error-primary);
        border-color: var(--dsw-alias-state-error-primary);
      }
      .dsh-subscription-usage-percent { font-variant-numeric: tabular-nums; font-weight: 600; }
      .dsh-subscription-usage-reset { color: var(--dsw-alias-label-caption); }
    `;
    const styleId = "@local/dsh-subscription-usage/subscription-usage.css";
    if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css="${styleId}"]`) === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "@local/dsh-subscription-usage";
      tag.dataset.pluginCss = styleId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    const LABELS = {
      "openai-codex": "ChatGPT",
      "opencode-go": "OpenCode",
    };

    function formatCountdown(resetsAt, now) {
      if (!Number.isFinite(resetsAt)) return "刷新时间未知";
      const ms = Math.max(0, resetsAt - now);
      const minutes = Math.ceil(ms / 60_000);
      if (minutes < 60) return `${minutes}分钟后`;
      const hours = Math.floor(minutes / 60);
      const restMinutes = minutes % 60;
      if (hours < 24) return restMinutes === 0 ? `${hours}小时后` : `${hours}小时${restMinutes}分后`;
      const days = Math.floor(hours / 24);
      const restHours = hours % 24;
      return restHours === 0 ? `${days}天后` : `${days}天${restHours}小时后`;
    }

    function chooseWindow(windows) {
      if (!Array.isArray(windows) || windows.length === 0) return undefined;
      return windows.reduce((highest, item) => item.usedPercent > highest.usedPercent ? item : highest, windows[0]);
    }

    async function fetchUsage(provider, signal) {
      const response = await fetch(`/subscription-usage?provider=${encodeURIComponent(provider)}`, {
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }

    function SubscriptionUsageBadge({ provider, refreshVersion }) {
      const [state, setState] = React.useState({ status: "loading", windows: [] });
      const [now, setNow] = React.useState(Date.now());

      React.useEffect(() => {
        const controller = new AbortController();
        let active = true;
        // 首次加载由初始 loading 状态呈现；每次最终响应后的刷新保留旧值，
        // 直到新数据到达，避免徽标闪烁。
        fetchUsage(provider, controller.signal).then(
          (value) => { if (active) setState(value); },
          (error) => { if (active && error?.name !== "AbortError") setState({ status: "error", windows: [], error: error?.message ?? String(error) }); },
        );
        return () => { active = false; controller.abort(); };
      }, [provider, refreshVersion]);

      React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(timer);
      }, []);

      if (state.status === "not-configured" || state.status === "unsupported") return null;
      const window = chooseWindow(state.windows);
      if (state.status === "error") return null;
      if (!window) {
        return jsx.jsx("span", {
          className: "dsh-subscription-usage-badge",
          "data-status": "loading",
          title: `${LABELS[provider] ?? provider} 用量正在加载`,
          children: "用量加载中…",
        });
      }
      const remaining = Math.round(window.remainingPercent ?? (100 - window.usedPercent));
      const level = remaining <= 10 ? "danger" : remaining <= 30 ? "warn" : "normal";
      const countdown = formatCountdown(window.resetsAt, now);
      const title = `${LABELS[provider] ?? provider} · ${window.label ?? "订阅限额"}：剩余 ${remaining}% · ${countdown}刷新`;
      return jsx.jsxs("span", {
        className: "dsh-subscription-usage-badge",
        "data-level": level,
        title,
        "aria-label": title,
        children: [
          jsx.jsx("span", { className: "dsh-subscription-usage-percent", children: `${remaining}%` }),
          jsx.jsx("span", { className: "dsh-subscription-usage-reset", children: countdown }),
        ],
      });
    }

    const inject = ["slots", "modelDirectories", "sessions"];

    function apply(ctx) {
      ctx.inject(["slots", "modelDirectories", "sessions"], (scope) => {
        const directories = scope.modelDirectories;
        const sessions = scope.sessions;

        // 任一会话完成一次最终响应（running: true→false）后，广播一次刷新
        // 信号，徽标据此重新拉取用量——每次 LLM 最终响应后更新一次。
        const refreshListeners = new Set();
        let refreshVersion = 0;
        const subscribeRefresh = (listener) => {
          refreshListeners.add(listener);
          return () => refreshListeners.delete(listener);
        };
        const getRefreshVersion = () => refreshVersion;

        const runningBySession = new Map();
        const syncRunning = () => {
          const snapshot = sessions.list.getSnapshot();
          const ids = new Set(snapshot.ids);
          for (const sessionId of snapshot.ids) {
            const summary = snapshot.byId[sessionId];
            if (summary === undefined) continue;
            if (runningBySession.get(sessionId) === true && summary.running === false) {
              refreshVersion += 1;
              for (const listener of refreshListeners) listener();
            }
            runningBySession.set(sessionId, summary.running);
          }
          for (const sessionId of runningBySession.keys()) {
            if (!ids.has(sessionId)) runningBySession.delete(sessionId);
          }
        };

        scope.effect(() => {
          syncRunning();
          return sessions.list.subscribe(syncRunning);
        }, "subscription-usage: watch final responses");

        scope.slots.inject("conversation.input.right", () => scope.slots.register({
          name: "conversation.input.right",
          id: "@local/dsh-subscription-usage:badge",
          order: 10000,
          inject: (sessionId) => ({
            directory: directories.directoryFor(sessionId).store,
          }),
        }, function SubscriptionUsageSeat({ directory }) {
          const state = React.useSyncExternalStore(
            (notify) => directory.subscribe(notify),
            () => directory.getSnapshot(),
          );
          const refreshVersion = React.useSyncExternalStore(subscribeRefresh, getRefreshVersion);
          const provider = state.current?.provider;
          if (!provider || !Object.hasOwn(LABELS, provider)) return null;
          return jsx.jsx(SubscriptionUsageBadge, { provider, refreshVersion });
        }));
      });
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  },
});
