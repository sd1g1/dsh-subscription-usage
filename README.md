# DSH Subscription Usage

DeepSeek Harness Web 插件：在模型选择器左侧显示订阅 Provider 的剩余用量。

## 安装

```bash
dsh plugin --profile web add github:sd1g1/dsh-subscription-usage
```

## 支持范围

- `openai-codex`：读取 ChatGPT Codex `/backend-api/wham/usage`
- `opencode-go`：读取 OpenCode Zen Go `/zen/go/v1/usage`

Provider 未配置凭据或查询失败时，徽标自动隐藏，不影响使用。

## 凭据

| Provider | 默认 DSH credential ref |
| --- | --- |
| OpenAI Codex | `OPENAI_CODEX_ACCESS_TOKEN` |
| OpenCode Zen Go | `OPENCODE_API_KEY` |
