# WealthPlans

WealthPlans 是部署在 Cloudflare Workers 上的金融数据工具。首页用于查看 D1 中已存储的基金、ETF、指数日频数据，搜索标的、检查覆盖范围，并按日期区间同步；每次成功抓取的标准化批次同时归档到 R2。

## 本地开发

要求 Node.js 24 与 Corepack：

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

- 页面与同域 API：<http://localhost:5173>
- Agent 接入页：<http://localhost:5173/agent-access>
- 本地 D1/R2 状态：`.wrangler/state/`，不会提交到 Git。

## Preview 环境

独立资源：

- Worker：`wealthplans-preview`
- D1：`wealthplans-preview`
- R2：`wealthplans-preview-files`

```sh
pnpm db:migrate:preview
pnpm deploy:preview
```

preview 默认允许远程读取、禁止同步写入。启用写入前必须设置 `SYNC_TOKEN` secret，并将 `REMOTE_SYNC_ENABLED` 改为 `true` 后重新部署。

## 本地与 Preview 数据同步

本地开发配置同时提供：

- `DB` / `FILES`：本地模拟 D1/R2。
- `REMOTE_DB` / `REMOTE_FILES`：通过 Cloudflare remote bindings 连接 preview D1/R2。

运行 `pnpm dev` 只建立连接，不会自动传输数据。访问
<http://localhost:5173/environment-sync> 后：

1. 读取两侧记录并按 `来源 + 标的 + 类型 + 日期` 对齐。
2. 对金融字段生成 SHA-256 指纹。
3. 分类为一致、仅本地、仅 Cloudflare、内容冲突。
4. 用户选择单一方向并确认。
5. 服务重新计算计划；数据已变化时拒绝旧计划。
6. 目标 R2 保存本次传输归档，目标 D1 执行新增或明确覆盖。

此流程使用本机 Wrangler 的 Cloudflare 登录，不开放公网复制写接口，也不需要把 Token 交给网页。Git commit、Git push、migration 和 Worker 部署都不会自动触发环境数据同步。

## 数据获取方法

数据源选择遵循 `AGENT_FUND_ETF_DATA_GUIDE.md`：

1. 页面与 Agent 优先读取 D1。
2. AKShare 是推荐的主同步源，适合历史回补和数据管道。
3. 当前 Worker 使用已验证的 FTShare 公共只读 MCP 通道。
4. 成功响应先归档至 R2，再按冲突策略写入 D1。
5. 相同来源、标的、价值类型和日期用于去重；同步前必须选择跳过或覆盖。

当前只向外部服务发送公开标的代码和日期范围，不发送持仓、成本或账户信息。

| 标的 | 标准代码 | 数据类型 | FTShare 工具 |
|---|---|---|---|
| 上证指数 | `000001.XSHG` | 指数日 K | `ft_stock_candlesticks` |
| 安信稳健增值混合 A | `001316.OF` | 单位、累计、复权净值 | `ft_get_fund_net_value` |

两项标的各有 5 条初始数据，由 D1 migration 写入。外部网络失败不会删除或用空值覆盖已有数据。

## 数据源调用限制

### AKShare

- 没有适用于全部接口的公开统一 QPS、每分钟次数或每日配额。
- 限制由东方财富、新浪、CNINFO 等上游分别决定，可能随接口、IP 和时间变化。
- 官方对超时建议降低访问频率，但没有提供可依赖的固定数值。
- GitHub issue 中约 4 次调用后限流、约 4 秒间隔可用的记录仅是环境样本，不是官方额度。

### FTShare

- 官方仓库没有公布公共 MCP 的统一调用额度或 SLA。
- 当前 Schema 上限：基金净值每页最多 200 条；通用 K 线 `limit` 最多 500；分钟 K 单次最多覆盖 3 个 Asia/Shanghai 自然日。
- 本项目自动翻页基金数据、按 365 日分段指数日 K，并在单个 Worker isolate 内串行同步。

没有公开数字不等于无限制。遇到 HTTP 429、连接断开或 `UPSTREAM_UNAVAILABLE` 时应停止加压并退避重试。

## UI

页面使用 Tailwind CSS v4 和 shadcn/ui 的代码内组件，配置见 `components.json`，组件位于 `src/web/components/ui/`。视觉原则是紧凑、清晰、以数据读取和同步操作为主，不使用装饰性大幅排版。

## 标准检查

```sh
pnpm check
```

该命令执行 TypeScript、Biome、Vitest、Worker/前端构建和 Wrangler dry-run。
