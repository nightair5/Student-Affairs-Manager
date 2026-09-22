# Candidate14 产品处置 1.1 与测量 2.1

正确无任务来源可以在隔离数据库中写入版本化归档凭据。归档前必须校验当前 SourceVersion、成功 RecognitionRun、持久化首次输出 SHA，以及信息证据、事件和时间 ID；空 result 或虚构 ID 一律拒绝。保存采用真实 Workspace v8 repository 事务，随后独立读回；正式 task、project、event、timePoint、material、calendar 和 reminder 的事务前后哈希必须相同，不要求用户原有工作区为空。旧 6633 入口及旧数据库不参与。

测量事件绑定不可变注册记录、trial、source、candidate 和不可变首次输出。每个事件有唯一 ID 和连续 sequence；暂停使用 token，嵌套同类暂停按区间并集计算。修改次数按持久化 operation ID 去重。调用方自报 `HUMAN_TRIAL` 不能进入聚合，只有注册表中存在的真人试次可计入。

任务确认必须先 `commit_succeeded` 再用同一 operation ID 独立读回；无任务归档也必须用同一 operation ID 读回。未闭合区间、身份漂移、读回失败或未取得语义判断时返回 `null`/`INCOMPLETE`，不得填 0。工程回放不能生成真人转化率。
