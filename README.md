# DSH Subscription Usage

DeepSeek Harness Web 插件：当当前模型来自订阅制 Provider 时，在模型选择器左侧显示账户剩余用量百分比与距离下一次刷新时间。

## 支持范围

- `openai-codex`：读取 ChatGPT Codex `/backend-api/wham/usage`
- `opencode-go`：读取 OpenCode Zen Go `/zen/go/v1/usage`（滚动 / 周 / 月三个限额窗口）

Provider 未配置凭据、接口不支持或查询失败时，徽标自动隐藏，不影响模型选择和发送消息。

## 默认凭据引用

| Provider | 默认 DSH credential ref |
| --- | --- |
| OpenAI Codex | `OPENAI_CODEX_ACCESS_TOKEN` |
| OpenCode Zen Go | `OPENCODE_API_KEY` |

可通过 Loader row 的 `config` 覆盖 `*CredentialRef`、`*UsageUrl`、`cacheMs` 和 `timeoutMs`。

## 安装与接入

本包同时提供运行时插件和 DSH Bundle。Bundle 内置 `cordis.patch.yml`，会自动插入
`ui-subscription-usage` 行；用户不需要再把这行复制到 profile 的
`cordis.patch.yml`。

在 `~/.dsh/profiles/web/package.json` 中，将包加入 `dependencies`，并把包名加入
`dsh.profile.bundles`：

```json
{
  "dependencies": {
    "@scope/dsh-subscription-usage": "^0.1.0"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@scope/dsh-subscription-usage"
      ]
    }
  }
}
```

发布前的本地开发可以把依赖改为 `link:/path/to/dsh-subscription-usage`。
修改 profile 的 `package.json` 后需要重启 DSH；仅修改 Bundle patch 或用户 patch 时，
可按当前 DSH 的 HMR 行为重新加载配置。

浏览器半边由包内 `dsh.client` 声明发现，Bundle patch 只负责把插件行加入组合树。

## 数据与安全

Provider Token 仅由 Host 侧 `ctx.credentials` 解析和使用。浏览器只收到百分比、刷新时间、状态和非敏感错误摘要。
