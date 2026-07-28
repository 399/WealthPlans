# WealthPlans 项目指南

更新时间：2026-07-27

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

状态：Cloudflare 金融数据工具第一版已实现，preview 资源和远程数据已建立。

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

截至 2026-07-27 新增：

- 确认第一项产品能力为金融数据工具。
- 首页改为 D1 数据目录、搜索、明细和同步入口。
- 初始支持上证指数与安信稳健增值混合 A。
- 同步支持日期范围、重叠预检、跳过或覆盖，并在完成后刷新页面。
- 恢复 Cloudflare Worker + D1/R2 架构：D1 保存结构化数据，R2 归档同步批次。
- 创建独立 preview D1 `wealthplans-preview` 与 R2 `wealthplans-preview-files`，并应用初始迁移。
- preview Worker 已部署到 `https://wealthplans-preview.zkfop.workers.dev`，远程页面与读取 API 已验证。
- 两个初始标的各 5 条真实日频数据已写入 local 与 preview D1。
- 本地单日 skip 同步已验证：D1 跳过已有记录，R2 写入对应归档对象。
- 新增 local ↔ preview 环境同步页与 Agent API，支持指纹比较、单向缺少项复制、显式冲突处理和计划过期拒绝。
- Agent API 支持远程目录、JSON/CSV 区间读取、重叠预检和受保护同步。
- 新增 `/agent-access` 接入说明页面与 `docs/runbooks/agent-data-access.md`。
- UI 改为 Tailwind CSS v4 + shadcn/ui 的紧凑数据工具风格。
- 类型、Biome、9 个单元测试、Worker/前端构建、Wrangler dry-run 和 HTTP/API 检查已通过。
- 后续页面改动不再要求 Agent 执行浏览器测试，由用户自行查看；Agent 继续负责代码检查、构建和 HTTP/API 验证。
- AKShare/FTShare 没有公开统一频率额度；已记录官方可确认边界、Schema 单次上限和本项目串行退避策略。

尚未完成，且当前不应被视为缺陷：

- 未创建 production D1、R2、Worker 或域名。
- 未配置用户账户、Cloudflare Access 或 CI/CD。
- preview 远程同步默认关闭，启用前必须配置 `SYNC_TOKEN`。
- 未定义账户体系和金融数据工具之外的完整产品范围。
- `.agents/skills/` 当前没有实际 skill。

后续 Agent 完成一个明确里程碑时，必须更新本节：只记录经过验证的事实，并将被取代的信息移除或标记为历史。

## 4. 已确认技术架构

除非形成新的架构决策记录，当前产品采用：

- TypeScript 严格模式。
- React + Vite。
- React Router。
- Tailwind CSS v4 + shadcn/ui。
- Hono Cloudflare Worker，API 前缀 `/api/v1`。
- Zod + Hono Validator。
- Hono RPC 共享前后端 API 类型。
- Cloudflare D1 + Drizzle Schema。
- Cloudflare R2 保存同步归档。
- React 静态资源和 Hono API 作为一个 Worker 部署。
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
├── wrangler.jsonc               # Worker 与环境 bindings
├── vite.config.ts               # React + Cloudflare Vite 插件
├── .agents/
│   └── skills/                 # WealthPlans 专属的可复用 Agent 技能
├── docs/
│   ├── product/                # 已确认需求、术语、范围、验收标准
│   ├── decisions/              # 架构决策记录
│   └── runbooks/               # 本地开发、部署、备份和恢复步骤
├── public/                     # 公开静态资源
├── src/
│   ├── web/
│   │   ├── components/         # 跨 feature 的通用 UI
│   │   ├── features/           # 按业务能力组织的前端实现
│   │   ├── hooks/
│   │   ├── lib/                # 前端基础工具与 API client
│   │   ├── routes/             # 页面路由
│   │   └── styles/
│   ├── worker/                 # Hono Worker、D1、R2 与数据同步
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
- 将 Vite、Wrangler 和所有构建、测试 CLI 作为项目 `devDependency`。
- 提交 `pnpm-lock.yaml`。
- 提供 `.env.example` 或 `.dev.vars.example`，只列变量名和无敏感示例。

边界规则：

- Node.js、mise/nvm、Corepack、Git 和 GitHub CLI 是设备级工具，只安装一次，不放入仓库。
- React、Hono、Vite、Tailwind、测试工具及所有应用依赖必须作为项目依赖写入 `package.json`，否则其他设备无法复现构建。
- `node_modules/`、`.wrangler/state/`、编辑器缓存和真实密钥不得提交。
- 项目内的 UI 组件属于 WealthPlans 产品代码；跨项目通用 Agent 技能放在用户级 skills 目录，不复制进本仓库。

当前标准命令：

```sh
pnpm install --frozen-lockfile  # 安装锁定的项目依赖
pnpm db:migrate:local           # 应用本地 D1 迁移
pnpm dev                        # local React + Worker + D1 + R2
pnpm check                      # 类型、规范、测试、构建、部署 dry-run
```

环境架构详见 `docs/decisions/0001-cloudflare-environments.md` 和 `docs/runbooks/local-development.md`。

## 8. Cloudflare 与外部数据源确认

当前 local、preview 使用隔离的 D1/R2；production 资源尚未创建。ADR 0001 是当前基线，ADR 0002 为历史阶段。

当前资源以以下位置为唯一事实来源：

| 内容 | 确认位置 |
|---|---|
| Worker、D1、R2 bindings | `wrangler.jsonc` |
| D1 Schema 与迁移 | `src/worker/db/schema.ts`、`migrations/` |
| 外部同步实现 | `src/worker/services/ftshare.ts` |
| 本地状态 | `.wrangler/state/` |
| 远程 secrets | Cloudflare Secrets |
| 数据获取策略 | `README.md`、`AGENT_FUND_ETF_DATA_GUIDE.md` |
| 备份和恢复步骤 | `docs/runbooks/local-development.md` |
| 产品使用的第三方系统 | `docs/product/` 和对应 ADR |

规则：

- 不把推测的数据源字段或单位写成已验证事实。
- 页面和分析读取 D1；外部成功响应先归档 R2，再写入 D1。
- 外部失败时保留已有数据，不写空值覆盖。
- 同步只发送公开标的代码和日期区间，不发送个人财务数据。
- 新增标的或数据源后立即更新 Schema 映射、产品文档和 runbook。
- local、preview、production 资源必须相互隔离；不得在 local 日常开发中绑定 production。
- local 可通过 `REMOTE_DB`/`REMOTE_FILES` remote bindings 显式访问 preview；只能由环境同步 API 在用户确认后使用。
- 远程同步默认关闭；启用时必须使用 `SYNC_TOKEN`。
- 不在日志、提交、文档或对话中输出真实 Token、Cookie、密码和财务敏感数据。

## 9. API、数据与 UI 约定

### API

- 路径统一为 `/api/v1/*`。
- 所有外部输入在边界使用 Zod 校验。
- 使用稳定的机器可读错误码，不让前端依赖错误文本。
- 前端静态资源与 API 同域部署，除非出现明确需求，不增加 CORS 配置。
- Hono 路由导出类型供前端 RPC client 使用。

### 数据

- Drizzle Schema 是模型事实来源，migration 是数据库变化事实来源。
- 每个 migration 必须先在 local，再在 preview 验证。
- 删除、覆盖或恢复远程数据属于破坏性操作，必须获得明确授权。
- 环境复制一次只能执行一个方向；缺少项只新增，冲突覆盖必须明确选择来源。
- 环境复制提交必须携带最新 plan hash，状态变化后拒绝旧计划。
- 数据日按 Asia/Shanghai 自然日保存，抓取时间按 UTC ISO 时间保存。
- 价格、净值和金额按原始十进制字符串保存；计算策略另行通过 ADR 固定。

### UI

- Mobile First，使用响应式布局，不判断具体设备型号。
- 业务页面优先使用 `src/web/components/ui/` 中的 shadcn/ui 组件与 Tailwind utilities。
- 保持紧凑、务实，避免装饰性大标题、渐变和无关动效。
- 关键操作不能只依赖 hover。
- 表格必须定义窄屏行为。
- 组件优先保持可访问性和键盘操作。
- 新增 UI 原语优先通过 shadcn/ui 组件代码扩展，不引入第二套组件库。

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
2. 页面、路由或运行时行为发生变化时，必须启动实际本地服务，并通过 HTTP/API 检查确认目标页面和相关 API 可访问；不要求 Agent 执行浏览器测试，页面视觉与交互由用户自行查看。
3. 如果本次交付需要用户通过本地 URL 查看效果，完成服务和 HTTP 验证后保持服务运行，并在交接中说明访问地址；若服务已停止，必须明确说明该地址当前不可访问。
4. 对照验收标准说明实际验证结果；不能把代码阅读、推测或留给用户测试当作完成证据。
5. 更新本文件“当前项目状态”中的里程碑事实。
6. 产品事实写入 `docs/product/`，架构取舍写入 `docs/decisions/`，操作步骤写入 `docs/runbooks/`。
7. 明确列出尚未完成或无法验证的部分，不把下一步计划写成完成。

本文件应保持为可快速进入项目的索引，不用于堆积每日日志。详细内容成熟后移动到相应 docs 目录，并从这里链接。
