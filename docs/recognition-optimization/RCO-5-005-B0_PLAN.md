# RCO-5-005-B0 预注册执行方案

## 1. 目的与边界

本轮只回答一个问题：相对一次 `facts-first` 紧凑抽取，`完整命题图抽取 + 独立语义复核 + 确定性安全选择` 是否在同一批新冻结匿名 Development 文本上显示出继续扩大验证的价值。

它不回答图片/文件端到端正确率、真实材料泛化、真人修改时间、浏览器验收或上线资格。数据为匿名合成 Development，不是 Holdout 或真实 ground truth。

## 2. 固定输入与调用

- 数据：`RCO-5-005-B0_DEVELOPMENT_DATASET.json`，12 个案例、12 个语义家族；首次模型调用前冻结。
- 模型：`deepseek-v4-flash-vision-exp`。
- 参数：`temperature=0`、thinking disabled、JSON object、单次最多 2,000 输出 token。
- 每例三次独立调用：facts-first、命题图抽取、语义复核；总计 36 次。
- Repair：禁止；自动重试：禁止。checkpoint 写入 `started` 后即占用该逻辑调用，失败不得被静默覆盖。
- Expected 只在本地计分时读取，不得进入任一模型请求。
- Secret 只从进程环境变量 `RCO_B0_DEEPSEEK_API_KEY` 读取，不写文件、不打印。

## 3. 费用硬门

按官方峰值缓存未命中输入价和输出价、1 UTF-8 byte 当作 1 input token、每次预留满 2,000 output token、并按 10 CNY/USD 保守换算，36 次最大理论费用为 3.545626 元，小于授权上限 10 元。若请求在运行前突破提示词字节门，或运行后保守价超过 10 元，立即失败关闭。

API 未返回账单金额时，真实账单写 `NOT_OBSERVABLE`，不得把保守换算冒充实付金额。

## 4. 指标

三臂均报告：

- Task Precision、Recall、F1；
- `requiresAction` 正确率；
- 动作效果、时间、材料、事件、地点正确率；
- Evidence 原文有效率；
- Complete Case、Major Correction；
- Forbidden Default Selection、Missed Safe Default。

失败请求、无效 JSON、Schema 不合格案例保留在分母，不能只挑成功返回计分。独立复核臂只保留 `entailed` 且全部关键语义与候选一致的动作；遗漏动作仍算漏检。

## 5. 事先固定的诊断判定

- `INVALID_RUN`：不是 36/36 调用都有记录，或任一臂不是 12/12 完成且 Schema 合格。
- `REJECT_CANDIDATE`：复核臂出现任何 Forbidden；或其 Task Precision 低于 facts-first；或 Complete Case 低于 facts-first。
- `PROMISING_FOR_LARGER_DEVELOPMENT_B1_ONLY`：命题图 Recall 高于 facts-first，复核臂 Recall 不低于 facts-first，且复核臂 Forbidden 为 0，同时未触发拒绝条件。
- 其他结果为 `INCONCLUSIVE`。

即使得到 `PROMISING`，也只允许提议更大 Development/B1，不得接入稳定路径、启动 RCO-6 或部署。

## 6. 产物与停止条件

每次新运行只在 `docs/recognition-optimization/rco-5-005-b0-runs/<run-id>/` 新建：

- `checkpoint.json`：逐调用状态、原始响应、解析结果、usage 与哈希；
- `result.json`：逐例和聚合计分；
- `REPORT.md`：面向复核的结果摘要和结论边界。

遇到无密钥、认证失败、传输失败、超时、无效 JSON、Schema 失败、费用门失败或冻结哈希漂移时，不 Repair、不重试、不修改旧数据来追分；保留现场并将运行判为无效或候选失败。
