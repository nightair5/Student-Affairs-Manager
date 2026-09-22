# Candidate14 产品处置 1.2 与测量 2.2

正确无任务来源可以在隔离数据库中写入版本化归档凭据。RecognitionRun 成功时必须把 SourceVersion 和首次完整输出 SHA 冻结到不可变锚点；归档只能使用该锚点，并从冻结 result 确定性派生全部证据、事件和时间 ID。幂等重放必须逐字段匹配完整收据，返回值必须来自独立读回的已持久化收据。空 result、锚点漂移、虚构或部分事实 ID 一律拒绝。保存采用真实 Workspace v8 repository 事务，随后独立读回；正式实体事务前后哈希必须相同。旧 6633 入口及旧数据库不参与。

测量事件绑定专用数据库中已持久化并读回的注册记录、trial、source、candidate 和 64 位首次输出 SHA。每个事件有唯一 ID 和连续 sequence，快照之后每个事件继续携带同一 snapshot SHA；暂停使用 token，嵌套同类暂停按区间并集计算。修改次数只统计完成 commit→独立 readback 的 operation ID 并去重。调用方自报 `HUMAN_TRIAL` 不能进入聚合。

任务确认必须先 `commit_succeeded` 再用同一 operation ID 独立读回；无任务归档也必须用同一 operation ID 读回。未闭合区间、身份漂移、读回失败或未取得语义判断时返回 `null`/`INCOMPLETE`，不得填 0。工程回放不能生成真人转化率。
