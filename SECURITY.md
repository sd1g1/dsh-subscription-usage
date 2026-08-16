# 安全策略

## 报告漏洞

Provider Token 永远不会离开 Host 进程：它们只能通过 `ctx.credentials` 解析，
绝不会发送到浏览器或写入日志。如果你仍然发现凭据可能泄露的途径，或其他任何
漏洞，请私下报告：在 GitHub 上开一个带 "security" 标签的 issue，或直接联系
维护者。不要开一个会暴露凭据内容的公开 issue。

## 范围

- Host 侧的 HTTP 路由（`/subscription-usage`）及其凭据处理。
- Web 客户端徽标：它绝不能收到 Token，只能收到用量摘要。

## 范围外

- OpenAI Codex 和 OpenCode Zen Go 服务本身；本项目与其无关联，它们的 API
  可能随时变更，恕不另行通知。
