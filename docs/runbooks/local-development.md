# Cloudflare 本地开发与 Preview 部署

## 1. 本地开发

```sh
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

访问 <http://localhost:5173>。Cloudflare Vite 插件在同一进程中运行 React、Hono Worker、本地 D1 和本地 R2；状态保存在 `.wrangler/state/`。

`pnpm dev` 会选择 `wrangler.jsonc#env.local-sync`：`DB`、`FILES` 仍使用本地模拟，
`REMOTE_DB`、`REMOTE_FILES` 通过 remote bindings 连接 preview。remote binding 只在环境同步页面或对应
API 被调用时产生远程读写；启动服务本身不会复制数据。使用该功能需要 Wrangler 已登录 Cloudflare。

健康检查：

```sh
curl http://localhost:5173/api/v1/health
curl http://localhost:5173/api/v1/instruments
```

## 2. 数据迁移

Schema 由 `src/worker/db/schema.ts` 和 `migrations/` 共同描述。迁移顺序固定为：

```sh
pnpm db:migrate:local
pnpm db:migrate:preview
```

production 尚未创建；不得把 preview 命令替换为无环境参数的远程写入。

## 3. Preview

preview 资源在 `wrangler.jsonc#env.preview` 中绑定：

- D1：`wealthplans-preview`
- R2：`wealthplans-preview-files`
- Worker：`wealthplans-preview`

部署：

```sh
pnpm deploy:preview
```

Cloudflare Vite 插件在构建阶段读取 `CLOUDFLARE_ENV=preview`。不要对已生成的 `dist/wealthplans/wrangler.json` 手工修改。

## 4. 远程同步安全

preview 默认 `REMOTE_SYNC_ENABLED=false`，只允许远程查看。启用同步时：

1. 执行 `pnpm exec wrangler secret put SYNC_TOKEN --env preview`。
2. 将 `wrangler.jsonc#env.preview.vars.REMOTE_SYNC_ENABLED` 改为 `true`。
3. 重新运行 `pnpm deploy:preview`。
4. Web 或 Agent 请求使用 `Authorization: Bearer <SYNC_TOKEN>`。

不得把 Token 写入仓库、日志或公开页面。

上述 Token 用于“远程 Worker 自己抓取外部数据”，与本地/preview 环境复制不同。环境复制从本地 Worker
通过 remote bindings 完成，不开放公网复制写 API。

## 5. Local 与 preview 环境复制

网页入口：<http://localhost:5173/environment-sync>

检查：

```sh
curl http://localhost:5173/api/v1/environment-sync/compare
```

确认提交示例：

```sh
curl -X POST http://localhost:5173/api/v1/environment-sync/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "action": "pull_missing",
    "planHash": "<compare 返回的 64 位哈希>",
    "confirmed": true
  }'
```

动作：

| action | 行为 |
|---|---|
| `push_missing` | 本地独有记录新增到 preview |
| `pull_missing` | preview 独有记录新增到本地 |
| `resolve_local` | 内容冲突以本地为准，覆盖 preview |
| `resolve_remote` | 内容冲突以 preview 为准，覆盖本地 |

规则：

- 主键为来源、标的、数据类型、日期。
- 指纹包含全部金融数值字段，不包含 `fetchedAt`。
- 单次最多 500 条；总清单第一版最多 5000 条。
- 一次只执行一个方向，不提供隐式双向合并。
- 提交时重新计算 plan hash；不一致返回 `409 SYNC_PLAN_STALE`。
- 目标环境必须已有标的定义，否则拒绝写入。
- 成功传输在目标 R2 留存审计归档。

Git commit、push、migration 和 deploy 不会调用此 API。

## 6. 验证

```sh
pnpm check
```

页面或 API 变化后启动 `pnpm dev`，通过 HTTP 检查首页和 API 可访问。页面视觉与交互由用户自行查看，不要求 Agent 执行浏览器测试。

## 7. 禁止事项

- 不提交 `.wrangler/state/`、Token、Cookie 或个人财务数据。
- 不把外部失败响应作为空行情写入。
- 不混淆基金单位净值、复权净值和指数/ETF 市场价。
- local remote bindings 只能指向 preview，不得绑定 production。
