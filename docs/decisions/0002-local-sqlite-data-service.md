# ADR 0002：本地 SQLite 金融数据服务

状态：历史；2026-07-27 因远程查看需求被 ADR 0001 再次取代。

日期：2026-07-27

## 背景

已确认的第一项产品能力是把公开基金、ETF 和指数日频数据保存在本机，并允许用户检查范围和手动同步。该能力需要直接访问本机文件型数据库。Cloudflare Worker 运行时不能直接打开本机 SQLite 文件，继续使用本地 D1 会使用户要求的数据库形态不成立。

## 决策

- 使用 Node.js 24 的 `node:sqlite` 与 SQLite 文件 `.data/wealthplans.sqlite`。
- 使用 Hono Node 服务提供 `/api/v1`，默认监听 `127.0.0.1:8787`。
- Vite 页面默认监听 `localhost:5173`，开发时代理 `/api` 到本地 Hono 服务。
- `pnpm dev` 同时启动两者。
- SQLite 使用 WAL 与外键，保存原始十进制字符串、来源、抓取时间和原始 JSON。
- 本地页面只通过 API 读取 SQLite，不直接依赖外部数据源。

## 数据源

根据 `AGENT_FUND_ETF_DATA_GUIDE.md`，AKShare 为推荐主源，FTShare 为回退与交叉验证源。当前运行时没有引入 Python 依赖；本机验证中东方财富指数接口连续失败，而 FTShare 两条核心路径成功。因此第一版同步器直接使用 FTShare 公共 MCP，后续增加 AKShare sidecar 时必须保持同一入库 Schema 和来源标识。

## 结果

优点：

- 数据库是真正的本机 SQLite 文件，轻量且容易备份。
- 页面与外部数据源解耦，断网时仍可读已有数据。
- 同步覆盖策略可以在数据库事务中明确执行。
- 不需要 Cloudflare 账户或远程资源。

代价：

- 当前形态是本地应用，不再是可直接部署到 Cloudflare Worker 的单运行时应用。
- 页面和 API 是两个本地进程。
- FTShare 是无 SLA 的公共服务，需要保留重试、错误提示和本地缓存。

## 与 Cloudflare 方案的比较

| 维度 | 本地 SQLite + Node API | Cloudflare Worker + D1/R2 |
|---|---|---|
| 数据位置 | 用户本机文件 | Cloudflare 远程资源 |
| 离线读取 | 支持 | 不支持 |
| Agent 本机直连 | 简单，回环 HTTP API | 需要公网部署和认证 |
| 跨设备 | 需要另建同步 | 天然支持 |
| 多用户与权限 | 当前不适合 | 更适合建立认证与隔离 |
| 运维与成本 | 几乎无远程运维 | 需要资源、部署、配额和密钥管理 |
| 备份 | 复制 SQLite 文件 | D1 备份/Time Travel 与部署流程 |
| 扩展性 | 适合个人、单机、中小数据量 | 更适合远程服务和多终端 |

当时需求以个人本机数据和 Agent 直接访问为主，因此采用 SQLite。随后用户明确提出跨设备远程查看，触发了本 ADR 已记录的切换条件，项目恢复 Cloudflare Worker + D1/R2。SQLite 数据模型被迁移为 D1 Schema；不保留双写或自动双向同步。

## 被取代内容

本 ADR 保留用于解释本地 SQLite 阶段。当前事实以 ADR 0001、`wrangler.jsonc`、D1 migrations 和 Cloudflare runbook 为准。
