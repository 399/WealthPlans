# ADR 0001：Cloudflare 本地、预览与生产环境隔离

状态：已恢复采用；2026-07-27 用户确认需要远程查看

日期：2026-07-25

## 背景

WealthPlans 将部署到 Cloudflare Workers，并计划使用 D1 保存结构化数据、R2 保存文件。日常开发如果直接访问线上资源，会带来网络延迟、免费额度消耗、测试数据污染和误改生产数据的风险。

## 决策

采用三个严格隔离的环境：

| 环境 | Worker | D1 | R2 | 用途 |
|---|---|---|---|---|
| local | 本机 workerd | 本机 D1 | 本机 R2 | 日常开发、快速测试 |
| preview | `wealthplans-preview` | 独立 preview 数据库 | 独立 preview bucket | 集成、远程预览、部署前验证 |
| production | `wealthplans` | 独立 production 数据库 | 独立 production bucket | 真实上线 |

### local

- `pnpm dev` 通过 Cloudflare Vite 插件运行。
- Worker 代码运行在 workerd 中，D1 和 R2 由 Wrangler/Miniflare 在本地模拟。
- 状态保存在仓库内被 Git 忽略的 `.wrangler/state/`。
- 不需要 Cloudflare 网络，不产生 D1/R2 线上用量。
- 本地数据可以随时重建，不含真实用户数据和生产密钥。

### preview

- 只有需要远程集成验证、跨设备查看或真实 Cloudflare 行为验证时才使用。
- 使用单独的 Worker、D1、R2 和 secrets。
- 可以放入合成测试数据或脱敏快照，禁止复制真实敏感数据。
- preview 的资源 ID 创建后写入 `wrangler.jsonc` 的 `env.preview`。

### production

- 只通过明确的 production 构建与部署流程访问。
- 使用独立 D1、R2 和 secrets。
- production binding 永远不设置 `remote: true` 供日常开发使用。
- 迁移先在 local、preview 验证，再在有恢复点的情况下应用到 production。

## 切换规则

- 无环境参数的 `pnpm dev` 永远代表 local。
- Cloudflare Vite 插件通过 `CLOUDFLARE_ENV=preview` 或 `CLOUDFLARE_ENV=production` 在构建阶段选择远程环境配置。
- preview/production 远程资源尚未创建时，不在配置中填入虚假资源 ID。
- 远端命令必须明确包含目标环境和 `--remote`；本地数据库命令必须明确包含 `--local`。
- 禁止使用含糊的默认命令对 D1 执行写操作。

## 数据迁移

- Drizzle schema 是模型事实来源。
- 生成的 SQL 迁移提交到 `migrations/`。
- 同一迁移按 local → preview → production 顺序执行。
- 测试数据通过独立 seed 脚本生成，不写入结构迁移。
- production 迁移前确认 D1 Time Travel 可用，并记录部署版本。

## 结果

优点：

- 日常开发速度不受外网影响。
- 不消耗远程 D1/R2 额度。
- 测试错误不会污染生产数据。
- 本地运行时与 Workers 生产运行时保持接近。

代价：

- 需要维护三个环境的资源配置。
- local 模拟不能完全替代部署前的 preview 集成验证。

## 2026-07-27 恢复决定

本地 SQLite 阶段证明了数据模型与同步闭环，但不能满足跨设备远程查看。项目恢复 Worker + D1/R2：

- D1 保存可查询的结构化金融数据。
- R2 归档每次成功抓取的标准化批次。
- preview 提供远程读取，写入默认关闭。
- UI 使用 Tailwind CSS v4 与 shadcn/ui 组件。

ADR 0002 保留为历史阶段记录，不再是当前运行基线。

### Local 与 preview 的显式复制

为满足用户主动同步两侧数据的需求，local 配置增加只指向 preview 的 `REMOTE_DB` 与
`REMOTE_FILES` remote bindings。Worker 代码仍在本机运行，只有用户访问环境同步功能时才读取或写入
preview。该例外不允许连接 production，也不允许后台自动复制。

复制使用稳定主键、金融内容指纹和乐观计划校验；一次操作只允许一个方向。Git 提交、部署和 migration
均不触发该流程。
