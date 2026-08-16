# DSH Subscription Usage

DeepSeek Harness Web 插件：当当前模型来自订阅制 Provider 时，在模型选择器左侧显示账户剩余用量百分比与距离下一次刷新时间。

## 支持范围

- `openai-codex`：读取 ChatGPT Codex `/backend-api/wham/usage`
- `opencode-go`：读取 OpenCode Zen Go `/zen/go/v1/usage`（滚动 / 周 / 月三个限额窗口）

Provider 未配置凭据、接口不支持或查询失败时，徽标自动隐藏，不影响模型选择和发送消息。

## 刷新时机

徽标在挂载时加载一次；此后每次 LLM 最终响应完成（任意会话/子代理回合结束）后自动刷新一次，
Host 侧同时作废用量缓存，保证刷新拉到最新数据。刷新期间保留旧值，数据到达后替换，不闪烁。

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

### 通过 DSH bundle 安装（推荐）

```bash
dsh plugin --profile web add github:sd1g1/dsh-subscription-usage
```

重启 DSH 后，bundle 会自动把 `ui-subscription-usage` 行加入 Web profile 的组合树。
也可以直接编辑 profile 的 `package.json`，把包加入 `dependencies` 和
`dsh.profile.bundles`：

```json
{
  "dependencies": {
    "@local/dsh-subscription-usage": "github:sd1g1/dsh-subscription-usage"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@local/dsh-subscription-usage"
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
