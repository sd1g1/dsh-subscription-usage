# DSH Provider Usage

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

推荐用 `dsh plugin` 命令从本机源码路径安装。`dsh plugin` 会运行 pnpm 安装并把包
写入 profile 的 `dependencies`，安装成功后自动把本包追加到 `dsh.profile.bundles`
（因为包声明了 `dsh.bundle`）；Bundle 内置的 `cordis.patch.yml` 会自动插入
`ui-provider-usage` 行，不需要再手动改任何配置文件。

### 推荐：本机源码路径安装

```sh
# 绝对路径（从任意目录执行）
dsh plugin --profile web add /path/to/dsh-provider-usage

# 相对路径必须以 . 或 .. 开头，且以执行命令的目录为基准
cd ~
dsh plugin --profile web add ./path/to/dsh-provider-usage
```

安装完成后重启 DSH 进程，浏览器刷新页面即可看到徽章。之后在本机源码目录改代码
会直接生效（本地路径以 `link:` 依赖安装），无需重新安装。

### 其他方式

从 GitHub（源码与本地方式等价，适合不开本地仓库的机器）：

```sh
dsh plugin --profile web add github:sd1g1/dsh-provider-usage
```

发布到 npm 后（包名待定，例如 `@scope/dsh-provider-usage`）：

```sh
dsh plugin --profile web add @scope/dsh-provider-usage
```

### 验证安装

```sh
dsh --profile web --dump-config | grep -B2 -A1 provider-usage
```

浏览器半边由包内 `dsh.client` 声明发现，Bundle patch 只负责把插件行加入组合树。

## 数据与安全

Provider Token 仅由 Host 侧 `ctx.credentials` 解析和使用。浏览器只收到百分比、刷新时间、状态和非敏感错误摘要。
