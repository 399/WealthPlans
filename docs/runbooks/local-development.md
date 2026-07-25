# 本地开发与 Cloudflare 环境切换

## 1. 新设备准备

设备级工具只安装一次，不放入仓库：

- Git。
- Node.js 24 LTS；推荐使用 mise 或 nvm 管理。
- Corepack。

进入仓库后：

```sh
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm cf:typegen
pnpm dev
```

项目依赖安装在本仓库的 `node_modules/`，但不会提交到 Git。这样依赖版本由 `package.json` 和 `pnpm-lock.yaml` 复现，而不是依赖某台设备的全局包。

## 2. 日常 local 开发

```sh
pnpm dev
```

默认行为：

- React 使用 Vite 热更新。
- Hono Worker 在本机 workerd 中运行。
- `DB` 指向本机 D1。
- `FILES` 指向本机 R2。
- 数据持久化在 `.wrangler/state/`，不会访问 Cloudflare 线上资源。

健康检查：

```sh
curl http://localhost:5173/api/v1/health
curl "http://localhost:5173/api/v1/health?deep=1"
```

普通健康检查不读取存储；`deep=1` 会执行一次本地 D1 查询和一次本地 R2 list，用于验证 bindings。

本地 D1 迁移：

```sh
pnpm db:migrate:local
```

所有本地 D1 命令必须显式携带 `--local`。如需全新本地状态，先停止开发服务器，再备份或移走 `.wrangler/state/`；不要删除来源不明的目录。

## 3. 创建 preview 资源

只有在用户明确要求创建 Cloudflare 资源时执行：

```sh
pnpm exec wrangler d1 create wealthplans-preview
pnpm exec wrangler r2 bucket create wealthplans-preview-files
```

把返回的真实 D1 ID 和 bucket 名写入 `wrangler.jsonc` 的 `env.preview`，不得使用示例 ID。preview Worker 名称为 `wealthplans-preview`。

应用迁移：

```sh
pnpm exec wrangler d1 migrations apply wealthplans-preview --env preview --remote
```

构建并部署：

```sh
CLOUDFLARE_ENV=preview pnpm build
CLOUDFLARE_ENV=preview pnpm exec wrangler deploy
```

只有需要直接调试真实 preview bindings 时，才为 preview binding 设置 `remote: true` 并使用：

```sh
CLOUDFLARE_ENV=preview pnpm dev
```

使用结束后应恢复默认 local 开发，避免每次刷新都产生远程访问。

## 4. 创建 production 资源

只有在用户明确要求上线时执行：

```sh
pnpm exec wrangler d1 create wealthplans-production
pnpm exec wrangler r2 bucket create wealthplans-production-files
```

将真实资源信息写入 `wrangler.jsonc` 的 `env.production`。production 不得复用 preview 资源。

上线顺序：

1. 确认 local 检查通过。
2. 确认相同提交已在 preview 验证。
3. 确认 production D1 Time Travel 状态。
4. 应用 production 迁移。
5. 使用 production 环境构建。
6. 部署该构建产物。
7. 执行只读健康检查与关键流程冒烟测试。

```sh
pnpm exec wrangler d1 migrations apply wealthplans-production --env production --remote
CLOUDFLARE_ENV=production pnpm build
CLOUDFLARE_ENV=production pnpm exec wrangler deploy
```

## 5. 禁止事项

- 不把真实 `.env`、`.dev.vars`、Token 或财务数据提交到 Git。
- 不让 local 和 preview/production 共用 D1 或 R2。
- 不把 production binding 配置为日常远程开发资源。
- 不在未确认目标环境时执行 D1 写入、迁移或 R2 删除。
- 不从 production 向本地导入未经脱敏的用户数据。
