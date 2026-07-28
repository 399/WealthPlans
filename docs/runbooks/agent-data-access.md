# Agent 金融数据接入

状态：当前稳定契约，Schema `1.1`。

日期：2026-07-27

## 1. 入口

Agent 不需要打开网页。基础地址使用当前 Worker 域名：

```text
https://<worker-host>/api/v1/agent
```

本地开发时为：

```text
http://localhost:5173/api/v1/agent
```

先访问 `/api/v1/health` 和 `/api/v1/agent`，不要在 Agent 中硬编码 preview 域名。

## 2. 查询目录

```sh
curl -s "$BASE_URL/catalog"
curl -s "$BASE_URL/catalog?q=001316"
```

返回标的、类型、记录数、覆盖范围、来源和最近抓取时间。

## 3. 读取日频数据

```sh
curl -s "$BASE_URL/data?symbol=001316.OF&start_date=2026-07-20&end_date=2026-07-27&order=asc&limit=500"
curl -s "$BASE_URL/data?symbol=000001.XSHG&order=asc&format=csv"
```

| 参数 | 必填 | 说明 |
|---|---|---|
| `symbol` | 是 | 先从 catalog 获取 |
| `start_date` | 否 | `YYYY-MM-DD`，含首日 |
| `end_date` | 否 | `YYYY-MM-DD`，含末日 |
| `order` | 否 | `asc` 默认；或 `desc` |
| `limit` | 否 | 默认 500，最大 5000 |
| `format` | 否 | `json` 默认；或 `csv` |

价格、净值和成交额是十进制字符串。

## 4. 同步

先预检：

```sh
curl -s -X POST "$BASE_URL/sync/preview" \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["000001.XSHG", "001316.OF"],
    "startDate": "2026-07-20",
    "endDate": "2026-07-27"
  }'
```

远程同步默认关闭。启用后必须携带 secret：

```sh
curl -s -X POST "$BASE_URL/sync" \
  -H "Authorization: Bearer $WEALTHPLANS_SYNC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["001316.OF"],
    "startDate": "2026-07-20",
    "endDate": "2026-07-27",
    "conflict": "skip"
  }'
```

未获得明确覆盖意图时使用 `skip`。成功抓取先归档 R2，再写入 D1。

## 5. 错误

- `401 SYNC_AUTH_REQUIRED`：缺少或错误的远程同步令牌。
- `403 REMOTE_SYNC_DISABLED`：环境为只读，不能触发远程同步。
- `409 SYNC_IN_PROGRESS`：当前 isolate 已有同步任务。
- `503 UPSTREAM_UNAVAILABLE`：外部服务不可用，退避后再试。
- 其他 4xx：参数错误，不要原样重试。

## 6. Agent 执行顺序

1. 检查 health 和 manifest。
2. 读取 catalog，确认 D1 覆盖范围。
3. 已满足任务时只读 data，不访问外部数据源。
4. 缺少数据时先调用 sync preview。
5. 默认使用 skip；overwrite 需要明确意图。
6. 同步成功后重新读取 catalog 和 data。
7. 报告实际来源、日期范围和抓取时间。

## 7. 当前边界

- 仅支持 `000001.XSHG` 和 `001316.OF` 外部同步。
- 读取 API 当前没有用户账户隔离，只包含公开金融数据。
- 当前没有删除数据 API。
- production 环境尚未创建。

## 8. Agent 发起环境复制

Agent 只有在本地服务运行、用户已经查看比较结果并明确确认方向后，才可调用：

```sh
curl -s http://localhost:5173/api/v1/agent/environment/compare
```

返回的 `planHash` 绑定当前 local 与 preview 两侧状态。用户确认后：

```sh
curl -s -X POST http://localhost:5173/api/v1/agent/environment/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "action": "pull_missing",
    "planHash": "<compare 返回值>",
    "confirmed": true
  }'
```

Agent 不得自行推断冲突方向：

- `push_missing` / `pull_missing` 只新增缺少记录。
- `resolve_local` / `resolve_remote` 会覆盖冲突记录，必须得到用户明确选择。
- `SYNC_PLAN_STALE` 表示数据在确认前发生变化；必须重新 compare，不得原样重试。
- 这些端点在远程 Worker 上返回 `LOCAL_ONLY`，避免形成公网复制写入口。
