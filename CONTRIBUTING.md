# 贡献指南

感谢你对 `dsh-subscription-usage` 的关注。

## 开发

```sh
npm test
```

本包是纯 ESM JavaScript，无需构建步骤。插件入口为 `lib/index.js`（Host）和
`lib/client.js`（Web 客户端）。请把纯解析与格式化辅助函数放在
`lib/subscription-usage.js` 中，以便保持可单元测试。

## 拉取请求

- 保持改动聚焦，并在描述中说明动机。
- 任何行为变更请在 `test/` 中新增或更新测试。
- 提交前运行 `npm test`。

## 许可证

贡献即表示你同意你的贡献以 [MIT License](LICENSE) 授权。
