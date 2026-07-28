# Agent 数据源使用手册：AKShare 与 FTShare

> 面向需要获取中国公募基金、ETF、指数日频数据并进行个人投资组合复盘的 Agent。

更新时间：2026-07-27
当前版本：AKShare `1.18.79`；FTShare MCP Server `0.1.1`

## 0. 重要结论

没有逐一调用 AKShare 和 FTShare 的全部接口。

- AKShare 当前安装包中，仅 `fund_*`、`stock_zh_index*`、`index_*` 等相关入口就有 160 余个；整个项目范围更大。
- FTShare MCP 实际 `tools/list` 返回 172 个工具，其中公募基金 20 个、ETF 专题 8 个、指数专题 8 个，另有通用 K 线等工具。
- 本研究实测了个人组合日频复盘的核心路径；其他能力按官方文档或当前安装包进行盘点，但不能视为已经验证可用。

本文使用以下状态：

| 标记 | 含义 |
|---|---|
| ✅ | 已在当前环境、当前日期实测成功 |
| ⚠️ | 已实测，但存在失败、口径或稳定性问题 |
| ◻️ | 文档或安装包中存在，尚未调用验证 |
| ❌ | 当前实测不可用或不满足需求 |

## 1. Agent 应采用的数据源顺序

1. 优先读取本地数据库或 CSV。
2. 缺少数据时，优先使用 AKShare 增量同步。
3. AKShare 失败或需要交叉验证时，调用 FTShare。
4. 两个来源不一致时，不要静默选一个；统一单位与复权口径后再次比较。
5. 外部接口调用成功后先写入本地，再进行分析。

推荐定位：

| 来源 | 定位 |
|---|---|
| AKShare | 主同步源、历史回补、本地数据管道 |
| FTShare | MCP 查询层、备援、交叉验证 |
| 本地数据库 | 分析时的唯一直接输入 |

## 2. 快速选择

| 需要的数据 | AKShare 首选 | FTShare 首选 | 状态 |
|---|---|---|---|
| 公募基金历史单位净值 | `fund_open_fund_info_em` | `ft_get_fund_net_value` | 两者均 ✅ |
| 公募基金复权净值 | 需结合累计净值/自行处理 | `ft_get_fund_net_value` 直接返回复权因子与复权净值 | FTShare ✅ |
| ETF 场内日 K | `fund_etf_hist_em` | `ft_stock_candlesticks` | 两者均 ✅ |
| ETF 专用行情日线 | `fund_etf_hist_em` | `ft_get_fund_daily` | FTShare 专用接口 ⚠️ |
| ETF 基金净值 | `fund_open_fund_info_em` | `ft_get_fund_net_value` | 两者可用 |
| 上证指数日 K | `stock_zh_index_daily_em` | `ft_stock_candlesticks` | 两者均 ✅ |
| 基金最新股票持仓 | `fund_portfolio_hold_em` | `ft_get_fund_portfolio` | AKShare ✅；FTShare ◻️ |
| ETF 规模/份额 | `fund_etf_scale_sse` / `fund_etf_scale_szse` | `ft_get_fund_share`、ETF 基础/盘前工具 | AKShare 上交所 ✅ |
| 基金基本资料 | `fund_name_em`、`fund_overview_em` | `ft_get_fund_basicinfo` / `ft_get_fund_overview` | AKShare 名录 ✅ |
| 基金经理、费率、分类 | 多个 `fund_*` 接口 | 对应公募基金工具 | 均 ◻️ |
| 指数成分和权重 | `index_stock_cons*` 等 | 指数权重工具 | 均 ◻️ |

## 3. 统一代码与日期格式

| 标的 | AKShare 示例 | FTShare 示例 |
|---|---|---|
| 公募基金 | `000001` | `000001` 或 `000001.OF` |
| 上交所 ETF | `510300` | `510300.XSHG` |
| 上证指数 | `sh000001` | `000001.XSHG` |
| 沪深300指数 | 依接口为 `000300` / `sh000300` | `000300.XSHG` |

日期类型不统一：

- AKShare 多数区间参数为 `YYYYMMDD` 字符串。
- FTShare 基金净值的日期参数为 `YYYYMMDD` 整数。
- FTShare 基金行情日线的日期参数为 `YYYYMMDD` 字符串。
- FTShare 通用 K 线使用毫秒时间戳。

Agent 调用前必须读取实时函数签名或 MCP `inputSchema`，不可凭经验猜类型。

## 4. AKShare 能获取什么

### 4.1 基金目录与基础资料

| 能力 | 接口 | 状态 | 说明 |
|---|---|---|---|
| 全部基金代码、名称、类型 | `fund_name_em` | ✅ | 实测返回 27,332 条 |
| 单只基金概览 | `fund_overview_em` | ◻️ | 基本资料、管理信息等 |
| 同花顺基金资料 | `fund_info_ths` | ◻️ | 不同上游来源 |
| 申购赎回及费率快照 | `fund_purchase_em` | ◻️ | 全市场快照 |
| 基金公司 AUM | `fund_aum_em` | ◻️ | 另有历史和趋势接口 |
| 新发基金 | `fund_new_found_em` / `fund_new_found_ths` | ◻️ | 新发与成立信息 |

### 4.2 公募基金净值与收益

| 能力 | 接口 | 状态 | 说明 |
|---|---|---|---|
| 开放式基金当日净值快照 | `fund_open_fund_daily_em` | ◻️ | 通常交易日晚间更新 |
| 单只基金历史单位净值 | `fund_open_fund_info_em(..., indicator="单位净值走势")` | ✅ | `000001` 实测 5,970 条 |
| 累计净值 | 同接口，`indicator="累计净值走势"` | ✅（510300） | 可用于分红相关核对 |
| 累计收益率 | 同接口，`indicator="累计收益率走势"` | ◻️ | 平台口径，不应替代自算 |
| 同类排名 | 同接口的排名指标 | ◻️ | 不建议作为核心原始数据 |
| 分红送配 | 同接口分红指标；或 `fund_announcement_dividend_em` | ◻️ | 复权和现金流处理所需 |
| 货币基金收益 | `fund_money_fund_daily_em` / `fund_money_fund_info_em` | ◻️ | 每万份收益、7日年化 |
| 理财型、分级、港基净值 | 对应 `fund_financial_*`、`fund_graded_*`、`fund_hk_*` | ◻️ | 部分类型可能已停止更新 |

限制：

- `fund_open_fund_info_em` 的单位净值可以直接用于日变动，但含分红的长期总回报应使用复权净值或基于分红重建。
- “累计净值”不应未经验证就等同于红利再投资总回报。
- 平台提供的收益率、排名和波动指标可能与本地方法不同，组合复盘应自行计算。

### 4.3 ETF 与 LOF 行情

| 能力 | 接口 | 状态 | 说明 |
|---|---|---|---|
| ETF 实时全市场快照 | `fund_etf_spot_em` | ✅ | 实测 1,555 条、37 字段 |
| ETF 日/周/月行情 | `fund_etf_hist_em` | ✅/⚠️ | 成功取得日 K；重复调用曾被上游断开 |
| ETF 分钟行情 | `fund_etf_hist_min_em` | 未纳入需求 | 本项目不需要 |
| 场内基金当日净值 | `fund_etf_fund_daily_em` | ◻️ | 日净值快照 |
| ETF 专用历史净值 | `fund_etf_fund_info_em` | ❌ | 1.18.79 实测字段数错位 |
| ETF 历史净值替代 | `fund_open_fund_info_em` | ✅ | `510300` 实测 3,457 条 |
| ETF 分红 | `fund_etf_dividend_sina` | ◻️ | 分红事件 |
| ETF 份额/规模 | `fund_etf_scale_sse` | ✅ | 指定日期上交所 ETF 份额 |
| 深交所 ETF 规模 | `fund_etf_scale_szse` | ◻️ | 最近交易日 |
| LOF 行情 | `fund_lof_hist_em` / `fund_lof_spot_em` | ◻️ | 日线及实时快照 |

已知专用净值错误：

```text
fund_etf_fund_info_em("510300", ...)
ValueError: Length mismatch: Expected axis has 14 elements, new values have 13 elements
```

替代：

```python
ak.fund_open_fund_info_em(
    symbol="510300",
    indicator="单位净值走势",
)
```

### 4.4 基金持仓、配置与变动

| 能力 | 接口 | 状态 |
|---|---|---|
| 股票持仓 | `fund_portfolio_hold_em` | ✅ |
| 债券持仓 | `fund_portfolio_bond_hold_em` | ◻️ |
| 行业配置 | `fund_portfolio_industry_allocation_em` | ◻️ |
| 累计买入/卖出 | `fund_portfolio_change_em` | ◻️ |
| 基金资产配置报告 | `fund_report_asset_allocation_cninfo` | ◻️ |
| 行业/股票报告 | `fund_report_industry_allocation_cninfo` / `fund_report_stock_cninfo` | ◻️ |
| 持有人结构 | `fund_hold_structure_em` | ◻️ |
| 基金规模变化 | `fund_scale_change_em` | ◻️ |

持仓限制：

- 持仓来自定期报告，不是实时完整组合。
- 季报通常只披露前十大股票；半年报/年报的披露范围可能更完整。
- 返回的多个报告期可能在同一表中，必须先筛选最新季度。

### 4.5 基金经理、费率、评级与公告

| 能力 | 代表接口 | 状态 |
|---|---|---|
| 基金经理大全 | `fund_manager_em` | ◻️ |
| 认购/申购/赎回费率 | `fund_fee_em` | ◻️ |
| 基金评级 | `fund_rating_all`、`fund_rating_*` | ◻️ |
| 基金排名 | `fund_open_fund_rank_em`、`fund_exchange_rank_em` | ◻️ |
| 净值估算 | `fund_value_estimation_em` | ◻️ |
| 人事、定期报告、分红公告 | `fund_announcement_*` | ◻️ |

这些数据适合补充解释，不应作为组合收益计算的核心原始序列。

### 4.6 指数

| 能力 | 代表接口 | 状态 |
|---|---|---|
| 沪深指数历史日 K | `stock_zh_index_daily_em` | ✅ |
| 新浪/腾讯指数日 K 备援 | `stock_zh_index_daily` / `stock_zh_index_daily_tx` | ◻️ |
| 中国指数历史行情 | `index_zh_a_hist` | ◻️ |
| 中证指数历史 | `stock_zh_index_hist_csindex` | ◻️ |
| 指数列表/基础信息 | `index_stock_info`、`index_csindex_all` 等 | ◻️ |
| 指数成分股 | `index_stock_cons*` | ◻️ |
| 指数权重 | `index_stock_cons_weight_csindex` | ◻️ |
| 国证、申万行业指数 | `index_hist_cni`、`index_hist_sw` 等 | ◻️ |
| 全球指数 | `index_global_hist_em` 等 | ◻️ |

### 4.7 AKShare 通用限制

- 多数接口封装公开网页，不是带 SLA 的正式数据服务。
- AKShare 没有公布适用于全部接口的统一 QPS、每分钟次数或每日配额；限制由各上游网站分别决定。
- 官方文档对部分接口仅提示“注意调用频率”，FAQ 对超时建议降低访问频率，但没有给出可依赖的固定数值。
- GitHub issue 中的“约 4 次调用后限流”和“约 4 秒间隔可用”只是个别环境样本，不是官方额度。
- 上游网页改版会造成字段变化、空表或解析错误。
- 同一类数据可能来自不同网站，字段口径和更新时间不完全一致。
- 接口可能发生瞬时断连，生产同步必须重试、退避和缓存。
- WealthPlans 成功抓取后先归档 R2，再写入 D1；不进行高并发抓取。
- 返回列名和日期字段可能随版本改变，应固定版本并做 Schema 检查。
- 官方对数据使用场景有风险提示；商业用途需另行确认上游许可。
- 当前 Python 使用 LibreSSL 2.8.3，会触发 `urllib3` 警告；若出现 TLS 问题应升级 Python。

## 5. FTShare 能获取什么

### 5.1 服务特性

- 公共 MCP：`https://market.ft.tech/gateway/mcp`
- Streamable HTTP。
- 无需在本地安装服务器。
- 服务端源码未在文档仓库公开。
- 成功结果为：

```text
structuredContent.metadata
structuredContent.data
```

`metadata` 提供来源、工具、总数、分页、截断和 warnings。错误结果包含结构化错误码和 `retryable`。

限制：

- 实际工具数量为 172，README 写 171，说明文档可能轻微滞后；必须以 `tools/list` 为准。
- 官方仓库没有公布公共 MCP 的统一 QPS、每分钟次数、每日配额或 SLA；没有公开数字不代表无限调用。
- 当前实测 Schema 限制包括：基金净值 `page_size` 最大 200；通用 K 线 `limit` 最大 500；分钟 K 单次最多 3 个 Asia/Shanghai 自然日。
- 远程服务可能停机、限流、改权限或未来收费。
- 文档 MIT License 只覆盖文档与示例，不等于数据服务无限制开放。
- 查询标的和日期区间会发送到 FTShare 服务端；不要发送个人成本、份额等隐私数据。

### 5.2 公募基金：20 个文档工具

| 工具 | 能力 | 状态 |
|---|---|---|
| `ft_get_fund_support_symbols` | 支持标的列表 | ◻️ |
| `ft_get_fund_list` | 基金列表 | ◻️ |
| `ft_get_fund_basicinfo` | 基金基础信息 | ◻️ |
| `ft_get_fund_overview` | 基金总览 | ◻️ |
| `ft_get_fund_classification` | 多套基金分类 | ◻️ |
| `ft_get_fund_nav` | 基金净值快照 | ◻️ |
| `ft_get_fund_net_value` | 历史净值、累计/复权净值 | ✅ |
| `ft_get_fund_net_value_performance` | 净值收益表现 | ◻️ |
| `ft_get_fund_cal_return` | 基金收益 | ◻️ |
| `ft_get_fund_daily` | ETF/LOF 场内行情日线 | ⚠️ |
| `ft_get_fund_portfolio` | 基金持仓明细 | Schema ✅，数据调用 ◻️ |
| `ft_get_fund_asset_allocation` | 资产配置 | ◻️ |
| `ft_get_fund_holder_structure` | 持有人结构 | ◻️ |
| `ft_get_fund_share` | 基金份额 | ◻️ |
| `ft_get_fund_manager` | 基金经理任职关系 | ◻️ |
| `ft_get_fund_company` | 基金公司 | ◻️ |
| `ft_get_fund_fee` | 基金费率 | ◻️ |
| `ft_get_fund_risk_level` | 风险等级 | ◻️ |
| `ft_get_fund_index_fund` | 指数跟踪基金 | ◻️ |
| `ft_get_fund_new_found` | 新发基金 | ◻️ |

`ft_get_fund_net_value` 实测字段：

- 发布日、净值日。
- 单位净值、累计净值。
- 单位净值增长率。
- 复权因子、复权单位净值、复权增长率。
- 每万份收益、7日年化。

注意：

- 多年历史每页最多 200 条，Agent 必须自动翻页。
- 实测基金净值按日期倒序返回，入库前必须排序。
- 数值字段多数为字符串，分析前必须显式转为数值。

### 5.3 ETF 专题：8 个文档工具

| 工具 | 能力 | 状态 |
|---|---|---|
| `ft_etf_description_all` | ETF 基础信息 | ◻️ |
| `ft_etf_adjust_factor` | ETF 复权因子 | ◻️ |
| `ft_etf_components_all` | ETF 成份列表 | ◻️ |
| `ft_get_etf_components_handler` | 单只 ETF 成份股 | ◻️ |
| `ft_etf_pcf_list_handler` | PCF 清单列表 | ◻️ |
| `ft_etf_fund_export` | 指数 ETF 基金导出 | ◻️ |
| `ft_get_etf_pre` | ETF 盘前数据 | 不属于本项目核心 |
| `ft_get_etf_pre_single_handler` | 单只 ETF 盘前数据 | 不属于本项目核心 |

ETF 日 K 不在“ETF 专题”工具内，推荐调用：

```text
ft_stock_candlesticks
symbol = 510300.XSHG
interval_unit = day
```

实测成功。

`ft_get_fund_daily` 专用 ETF 日线工具连续返回：

```json
{"code":"UPSTREAM_UNAVAILABLE","retryable":true}
```

因此不可作为唯一 ETF 日行情路径。

### 5.4 指数专题：8 个文档工具

| 工具 | 能力 | 状态 |
|---|---|---|
| `ft_index_description_all` | 沪深京指数基础信息和估值快照 | 文档存在 |
| `ft_index_description_list_handler` | 中证指数描述列表 | ◻️ |
| `ft_index_weight_list_handler` | 指数权重列表 | ◻️ |
| `ft_index_weight_summary_handler` | 指数权重汇总 | ◻️ |
| `ft_global_index_daily_kline` | 全球指数历史日 K | ◻️ |
| `ft_sw_industry_overview` | 申万行业总览 | ◻️ |
| `ft_sw_industry_constituent_history` | 申万行业历史成分 | ◻️ |
| `ft_sw_industry_daily_metrics` | 申万行业日度指标 | ◻️ |

国内指数日 K 推荐使用通用工具：

```text
ft_stock_candlesticks
symbol = 000001.XSHG
interval_unit = day
```

上证指数日 K 已实测成功。

### 5.5 通用 K 线

`ft_stock_candlesticks` 支持：

- 股票、ETF、指数、债券。
- 日、周、月、年 K。
- 不复权、前复权、后复权。
- 起止毫秒时间戳和 `limit`。

已实测：

- `510300.XSHG` ETF 日 K：✅
- `000001.XSHG` 上证指数日 K：✅

K 线结果按日期正序；这与基金净值工具的倒序不同。

## 6. 两个来源是否一致

2026-07-01—2026-07-24 的 18 日同字段核对：

| 标的 | 结果 |
|---|---|
| `000001` 公募基金单位净值 | 18 日完全一致 |
| `510300` ETF 开高低收 | 18 日完全一致 |
| `510300` ETF 成交量 | AKShare 为“手”，FTShare 为“份”；乘 100 后近乎完全一致 |
| `510300` ETF 成交额 | 最大差约 0.485 元，可忽略 |
| 上证指数开高低收 | 最大差 0.0049 点，属于显示精度 |
| 上证指数成交量/额 | 统一单位后完全一致 |

这证明样本期内核心日频数据高度一致，但不能证明：

- 所有标的、所有年份一致。
- 所有 AKShare 接口与 FTShare 使用相同上游。
- 未来修订和更新时间永远一致。

## 7. Agent 入库规范

### 7.1 不要混淆三类价值

| 字段 | 用途 |
|---|---|
| 公募基金单位净值 | 当日申购赎回确认与短期变化 |
| 复权基金净值 | 长期总回报、波动率和回撤 |
| ETF 市场收盘价 | 场内实际交易和持仓市值 |
| ETF 基金净值 | 折溢价、跟踪和基金资产价值 |

ETF 市场价与基金净值不能互相替代。

### 7.2 建议本地表

```text
instrument
  symbol, name, asset_type, exchange, currency, benchmark

daily_value
  date, symbol, value_type, open, high, low, close,
  unit_nav, accumulated_nav, adjusted_value,
  volume, turnover, source, fetched_at

fund_snapshot
  symbol, report_date, scale, shares, manager, fee, source

fund_holding
  fund_symbol, report_date, asset_symbol, asset_name,
  weight, quantity, market_value, source

transaction
  date, symbol, action, quantity, price, fee, cash_flow
```

### 7.3 同步规则

- 每日收盘后同步 ETF 和指数。
- 当晚或次日同步基金净值。
- 每次重拉最近 5—10 个交易日，以捕捉修订。
- 使用 `(source, symbol, value_type, date)` 去重。
- 原始值和标准化值分开保存。
- 外部失败时保留已有数据，不写空值覆盖。
- 网络错误重试 3 次，指数退避。
- 同一进程串行同步，避免对未知额度的公共服务发起并发请求。
- 每周检查交易日缺口、重复、异常跳变和 Schema 变化。
- 每月或每季更新规模、份额、持仓、经理和费率。

## 8. 分析规则

- 不要每天保存平台给出的“近三年波动率”。
- 保存每日复权价值，波动率、回撤、相关性和风险贡献应本地计算。
- 分析结果需要复现时，保存：

```text
as_of_date
window
annualization_factor
return_method
data_source
calculation_version
```

- 公募基金长期收益优先使用复权净值。
- ETF 实际持仓收益优先使用复权市场价，并结合真实交易流水。
- 比较不同来源前先统一日期、时区、排序、复权和成交量单位。

## 9. 已知失败与回退表

| 主调用 | 失败表现 | 回退 |
|---|---|---|
| AKShare `fund_etf_fund_info_em` | 字段数错位 | `fund_open_fund_info_em` |
| AKShare `fund_etf_hist_em` | 瞬时断连 | 重试；或 FTShare `ft_stock_candlesticks` |
| FTShare `ft_get_fund_daily` | `UPSTREAM_UNAVAILABLE` | `ft_stock_candlesticks` |
| FTShare 公募基金工具 | 远程服务不可用 | AKShare 本地同步结果 |
| 任意外部接口 | 当日失败 | 使用本地历史，下一周期补拉 |

## 10. 实测与文档边界

已实测成功：

- AKShare：基金名录、ETF 日行情、ETF 实时快照、开放式基金净值、ETF 替代净值、基金股票持仓、上交所 ETF 份额、上证指数日线。
- FTShare：服务初始化、工具 Schema、公募基金净值、ETF 通用日 K、上证指数通用日 K。
- 双源：`000001`、`510300`、上证指数 18 日逐字段比较。

已实测失败或不稳定：

- AKShare ETF 专用历史净值。
- AKShare ETF 行情曾出现瞬时断连。
- FTShare ETF 专用日线。

其余能力仅根据当前安装包函数和 FTShare 仓库文档盘点，调用前必须再次验证。

## 11. 本目录相关文件

- `probe_data_sources.py`：AKShare/BaoStock 核心接口探测。
- `probe_results.json`：探测结果。
- `compare_akshare_ftshare.py`：双源逐日核对。
- `comparisons/comparison_summary.json`：一致性汇总。
- `akshare_relevant_interfaces.txt`：当前 AKShare 相关函数签名原始清单。
- `ftshare_relevant_tools.txt`：FTShare 基金/ETF/指数工具原始清单。
- `evaluations/probe_ftshare.py`：FTShare MCP 协议与核心工具探测。
- `平台调研与实测报告.md`：BaoStock/AKShare 初步评测。
- `新增MCP平台评测.md`：两个 MCP 项目评测。
- `AKShare与FTShare数据一致性核对.md`：双源一致性结论。
