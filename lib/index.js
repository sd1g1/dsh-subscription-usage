import { ProviderUsageService, createUsageRoute, defaultProviders } from "./subscription-usage.js";

export const name = "subscription-usage";
export const inject = ["webServer", "credentials"];

export function apply(ctx, config = {}) {
  const providers = defaultProviders(config);
  const service = new ProviderUsageService(ctx, { ...config, providers });
  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: "/subscription-usage",
    handler: createUsageRoute(service, providers),
  }), "subscription-usage: query route");
}
