import { ProviderUsageService, createUsageRoute, defaultProviders } from "./provider-usage.js";

export const name = "provider-usage";
export const inject = ["webServer", "credentials"];

export function apply(ctx, config = {}) {
  const providers = defaultProviders(config);
  const service = new ProviderUsageService(ctx, { ...config, providers });
  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: "/provider-usage",
    handler: createUsageRoute(service, providers),
  }), "provider-usage: query route");
}
