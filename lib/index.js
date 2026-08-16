import { ProviderUsageService, createUsageRoute, defaultProviders } from "./subscription-usage.js";

export const name = "subscription-usage";
export const inject = ["webServer", "credentials"];

export function apply(ctx, config = {}) {
  const providers = defaultProviders(config);
  const service = new ProviderUsageService(ctx, { ...config, providers });
  // 每次 LLM 最终响应（回合即将关闭、模型不再欠响应）后作废用量缓存，
  // 浏览器下一次查询即可拉到最新数据。
  ctx.on("agent/turn-stopping", () => service.invalidateAll());
  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: "/subscription-usage",
    handler: createUsageRoute(service, providers),
  }), "subscription-usage: query route");
}
