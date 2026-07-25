# WealthPlans 项目指南

更新时间：2026-07-25

## 1. 开始工作的强制步骤

本项目是一个可克隆到任意设备和目录的独立 Git 仓库。本文中的“仓库根目录”指 `git rev-parse --show-toplevel` 返回的位置，不依赖任何固定绝对路径。开始任何分析、安装或修改之前：

1. 阅读本文件；它包含继续开发所需的完整项目规则。
2. 如果当前设备另外提供容器级或用户级 `AGENTS.md`，同时遵循其中不与本项目冲突的通用规范；项目不能假设该文件存在或位于固定路径。
3. 检查 `git status --short --branch`、最近提交和实际目录。
4. 阅读与任务相关的 `docs/product/`、`docs/decisions/`、`docs/runbooks/`。
5. 按本文件的环境规则检查设备工具和项目依赖。

不得仅根据项目名推断功能，不得把“计划采用”误报为“已经实现”。

## 2. 项目定义

项目名称：WealthPlans

项目方向：个人财富规划与管理 Web 应用。

GitHub 仓库：<https://github.com/399/WealthPlans>（公开）

当前只确认项目方向，尚未确认具体产品范围、数据来源、账户体系、计算规则或发布地区。以下功能均不能在没有需求确认时自行假设：

- 银行、券商或支付账户连接。
- 自动交易、投资建议或收益承诺。
- 实时行情、汇率和第三方金融数据。
- 多用户、家庭共享或顾问协作。
- 预算、资产负债、现金流、目标规划的具体优先级。
- 涉及监管、金融建议、身份验证或敏感个人数据的能力。

涉及财务计算时，必须先明确口径、币种、时区、精度、舍入规则和数据更新时间。金额不得使用浮点数直接进行核心计算；实际方案应在产品规则确认后通过整数最小货币单位或明确的 Decimal 策略实现。

## 3. 当前项目状态

状态：技术基线与首个响应式页面已完成，本地全栈运行已验证。

截至 2026-07-25 已完成：

- 创建独立项目目录和 Git 仓库。
- 建立前端、Worker、共享代码、文档、迁移、测试和项目技能目录骨架。
- 确认默认技术架构。
- 建立父级和项目级 Agent 指南。
- 建立基础 `.gitignore`。
- 设备已通过 mise 配置 Node.js 24 LTS，并通过 Corepack 配置 pnpm。
- 创建 `.node-version`，使本项目选择 Node 24。
- 根据已连接的 GitHub 账户配置 Git 身份并建立首次本地提交。
- 创建公开 GitHub 仓库 `399/WealthPlans`，本地 `main` 跟踪 `origin/main`。
- 移除项目文档中的设备绝对路径依赖，仓库可克隆到任意目录。
- 创建并锁定 React、Vite、Tailwind、Hono、Zod、Drizzle、Wrangler、Biome、Vitest 和 Playwright 项目依赖。
- 建立 Cloudflare Vite 插件、Hono Worker、Hono RPC 和 `/api/v1/health`。
- 建立 local、preview、production 三层 Cloudflare 环境隔离方案与操作手册。
- 验证 local D1 和 local R2 bindings；日常开发不访问远程资源。
- 完成响应式 WealthPlans 初始页面，演示数据已明确标记。
- 类型检查、Biome、单元测试、生产构建和 Wrangler dry-run 已通过。

尚未完成，且当前不应被视为缺陷：

- 未创建远程 preview/production D1、R2 或 Worker。
- 未配置域名、认证、CI/CD 和线上部署。
- 未定义真实业务数据表、账户体系和完整产品范围。
- `.agents/skills/` 当前没有实际 skill。

后续 Agent 完成一个明确里程碑时，必须更新本节：只记录经过验证的事实，并将被取代的信息移除或标记为历史。

## 4. 已确认技术架构

除非形成新的架构决策记录，本项目采用：

- TypeScript 严格模式。
- React + Vite。
- React Router。
- Tailwind CSS。
- Hono，API 前缀 `/api/v1`。
- Zod + Hono Validator。
- Hono RPC 共享前后端 API 类型。
- Cloudflare D1 + Drizzle ORM。
- Cloudflare R2 存储用户文件或大对象。
- React 静态资源和 Hono API 作为一个 Cloudflare Worker 部署。
- pnpm + Corepack。
- Biome、Vitest、Playwright。

默认不启用 KV、Durable Objects、Queues、Workflows、PWA、SSR、微服务或 monorepo。新增这些能力需要在 `docs/decisions/` 记录具体需求、替代方案、成本和结果。

PC 和移动网页共用一套 React 应用，采用 Mobile First 响应式设计；不维护两套页面。

## 5. 目录职责

```text
WealthPlans/
├── AGENTS.md                    # 本文件：项目入口与当前事实
├── package.json                 # 项目依赖与标准命令
├── pnpm-lock.yaml               # 可复现依赖锁
├── wrangler.jsonc               # Worker 与 Cloudflare bindings
├── vite.config.ts               # React + Cloudflare 本地运行
├── .agents/
│   └── skills/                 # WealthPlans 专属的可复用 Agent 技能
├── docs/
│   ├── product/                # 已确认需求、术语、范围、验收标准
│   ├── decisions/              # 架构决策记录
│   └── runbooks/               # 本地开发、部署、备份和恢复步骤
├── migrations/                 # D1 迁移
├── public/                     # 公开静态资源
├── src/
│   ├── web/
│   │   ├── components/         # 跨 feature 的通用 UI
│   │   ├── features/           # 按业务能力组织的前端实现
│   │   ├── hooks/
│   │   ├── lib/                # 前端基础工具与 API client
│   │   ├── routes/             # 页面路由
│   │   └── styles/
│   ├── worker/
│   │   ├── db/                 # Drizzle client 与 schema
│   │   ├── middleware/
│   │   ├── routes/             # Hono API 路由
│   │   └── services/           # 跨路由业务服务
│   └── shared/
│       ├── constants/
│       ├── lib/
│       ├── schemas/            # 前后端共享 Zod schema
│       └── types/
└── tests/
    ├── unit/
    └── e2e/
```

目录不存在内容时保留 `.gitkeep`。放入真实文件后，可以删除同目录的 `.gitkeep`。

## 6. 产品事实与开发顺序

产品内容尚未确认。第一次进入功能开发时，先与用户确认并写入 `docs/product/`：

1. 目标用户和使用场景。
2. 第一版必须解决的问题。
3. 明确不做的内容。
4. 核心实体和术语。
5. 关键页面和用户流程。
6. 财务计算口径及示例。
7. 数据敏感等级、保存周期和导出/删除要求。
8. 第一版验收标准。

建议开发顺序，但它不是已经批准的功能范围：

1. 确认产品范围。
2. 建立最小可运行脚手架。
3. 建立数据模型和迁移。
4. 完成一个纵向闭环，而不是同时铺开所有页面。
5. 补充关键测试和运行手册。
6. 建立 preview 环境。
7. 用户授权后再创建或部署 production。

## 7. 环境与依赖规则

设备级环境由各设备独立准备，本项目不依赖固定安装目录。本项目已经用 `.node-version` 固定 Node 24。项目脚手架应：

- 在 `package.json#engines` 声明兼容的 Node 版本。
- 在 `package.json#packageManager` 固定实际 pnpm 版本。
- 将 Wrangler 和所有构建、测试 CLI 作为项目 `devDependency`。
- 提交 `pnpm-lock.yaml`。
- 提供 `.env.example` 或 `.dev.vars.example`，只列变量名和无敏感示例。

边界规则：

- Node.js、mise/nvm、Corepack、Git 和 GitHub CLI 是设备级工具，只安装一次，不放入仓库。
- React、Hono、Wrangler、Vite、Tailwind、测试工具及所有应用依赖必须作为项目依赖写入 `package.json`，否则其他设备无法复现构建。
- `node_modules/`、本地 Worker 状态、编辑器缓存和真实密钥不得提交。
- 项目内的 UI 组件属于 WealthPlans 产品代码；跨项目通用 Agent 技能放在用户级 skills 目录，不复制进本仓库。

当前标准命令：

```sh
pnpm install --frozen-lockfile  # 安装锁定的项目依赖
pnpm cf:typegen                 # bindings 变化后重新生成 Worker 类型
pnpm dev                        # local React + Worker + D1 + R2
pnpm check                      # 类型、规范、测试、构建、部署 dry-run
```

Cloudflare 资源与环境切换详见 `docs/decisions/0001-cloudflare-environments.md` 和 `docs/runbooks/local-development.md`。

## 8. Cloudflare 与系统资源确认

当前没有创建任何远程 Cloudflare 资源。本地开发使用 Wrangler/Cloudflare Vite 插件提供的本地 D1、R2 模拟，不连接线上资源。

资源建立后，以以下位置为唯一事实来源：

| 内容 | 确认位置 |
|---|---|
| Worker 名称、兼容日期、环境 | `wrangler.jsonc` |
| D1/R2/KV binding 和资源 ID | `wrangler.jsonc` |
| D1 数据结构 | `src/worker/db/schema.ts`、`migrations/` |
| 本地非敏感变量名 | `.dev.vars.example` 或 `.env.example` |
| 本地真实密钥 | 未纳入 Git 的 `.dev.vars` / `.env.local` |
| 线上密钥 | Cloudflare Secrets，经授权后由本地 Wrangler 查询名称 |
| 实际线上资源状态 | Cloudflare 控制台或 `pnpm exec wrangler ...` |
| 部署和恢复步骤 | `docs/runbooks/` |
| 产品使用的第三方系统 | `docs/product/` 和对应 ADR |

规则：

- 不把示例资源名或推测的 ID 写成真实资源。
- local、preview 和 production 使用相互隔离的 D1、R2 及密钥。
- 日常 `pnpm dev` 只允许使用本地 binding；不得给 production binding 设置 `remote: true`。
- 未经用户明确授权，不创建、修改或删除线上资源，不部署 production。
- 任何资源创建完成后，立即把非敏感 binding 和环境信息写入 `wrangler.jsonc`，把操作方式写入 runbook。
- 不在日志、提交、文档或对话中输出真实 Token、Cookie、密码和财务敏感数据。

## 9. API、数据与 UI 约定

### API

- 路径统一为 `/api/v1/*`。
- 所有外部输入在边界使用 Zod 校验。
- 使用稳定的机器可读错误码，不让前端依赖错误文本。
- 前后端同域部署，除非出现明确需求，不增加 CORS 配置。
- Hono 路由导出类型供前端 RPC client 使用。

### 数据

- schema 是数据模型事实来源，迁移是数据库变化事实来源。
- 每个迁移都必须先在本地和 preview 验证。
- 删除、覆盖、恢复生产数据属于破坏性操作，必须获得明确授权。
- 时间按 UTC 存储，在展示层转换。
- 金额策略必须通过 ADR 固定后再实施。

### UI

- Mobile First，使用响应式布局，不判断具体设备型号。
- 关键操作不能只依赖 hover。
- 表格必须定义窄屏行为。
- 组件优先保持可访问性和键盘操作。
- 引入组件或状态库前先证明原生 React 和现有依赖不能清晰解决。

## 10. 项目 Skills

项目专属技能位于：

```text
.agents/skills/<skill-name>/SKILL.md
```

当前技能：无。

只有出现至少一种情况时才创建 skill：

- 相同的 WealthPlans 工作流需要稳定重复。
- 工作流包含容易遗漏的检查、脚本或专业口径。
- 单纯写在 `AGENTS.md` 会使入口文档明显膨胀。

候选例子必须等实际需求出现后才能建立，例如：

- 财务计算用例验证。
- D1 schema 变更与迁移审查。
- 发布前隐私和敏感数据检查。

skill 必须清楚声明适用与不适用场景。通用工作流应放在 `~/.agents/skills`，不要复制到本项目。

## 11. 工作与交接规则

开始任务时：

1. 先区分“已确认事实”“当前计划”“仍待确认”。
2. 查看 Git 和文档，避免重复实现已经完成的内容。
3. 发现未提交改动时保护它们，不擅自还原或覆盖。
4. 缺少产品选择但不同选择会改变数据或架构时，停止并向用户确认。

完成任务时：

1. 每次代码或配置改动后必须由 Agent 自行验证；至少运行与改动相关的类型检查、静态检查、测试和构建，默认使用 `pnpm check`。
2. 页面、路由或运行时行为发生变化时，必须启动实际本地服务，确认目标页面和相关 API 可访问，并使用浏览器完成与改动相称的实际检查；构建成功不能替代运行时验证。
3. 如果本次交付需要用户通过本地 URL 查看效果，完成验证后保持服务运行，并在交接中说明访问地址；若服务已停止，必须明确说明该地址当前不可访问。
4. 对照验收标准说明实际验证结果；不能把代码阅读、推测或留给用户测试当作完成证据。
5. 更新本文件“当前项目状态”中的里程碑事实。
6. 产品事实写入 `docs/product/`，架构取舍写入 `docs/decisions/`，操作步骤写入 `docs/runbooks/`。
7. 明确列出尚未完成或无法验证的部分，不把下一步计划写成完成。

本文件应保持为可快速进入项目的索引，不用于堆积每日日志。详细内容成熟后移动到相应 docs 目录，并从这里链接。
