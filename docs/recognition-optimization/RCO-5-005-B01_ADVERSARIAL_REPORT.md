# RCO-5-005-B0.1 对抗审查报告

## 结论

`PASS / ZERO MODEL CALLS / READY TO REQUEST NEW DATA FREEZE AUTHORIZATION ONLY`

B0 的五类已知系统性缺陷已被转换为可执行契约并通过 39 项零调用测试。其中 28 项是实现期定向测试，11 项是实现完成后另写的对抗样例。第一版新鲜样例曾因正控字符位置写错而出现“攻击断言假绿”；本轮没有接受该结果，而是修正正控并强制先验证干净图与复核结果都合格，再重新运行全部攻击。

## 已封闭的失败路径

| B0 缺陷 | B0.1 处置 | 对抗结果 |
|---|---|---|
| 独立 prompt 引用“与上一臂一致” | 每个 prompt 完整内联 canonical 枚举 | 非法中文角色、`positive`、大小写和零宽变体均拒绝 |
| `json_object` 只保证 JSON | Responses API 候选请求使用完整 JSON Schema，所有对象拒绝额外字段 | `selected` 注入、字段错位、未知字段均拒绝 |
| graph 无效仍调用 verifier | graph 本地 Schema 是调用前硬门 | verifier 记为未发出 skip，dispatch=0 |
| verifier-own 与 pipeline 混为一项 | 分别报告 graph、verifier-own、pipeline | graph 失败时 verifier-own=N/A；graph 通过但 verifier 失败时单独记录 |
| requiresAction 被任务数组代算 | facts 直接评分模型顶层值，并校验顶层与活动任务一致 | 顶层错误不能再被活动任务洗正；无效负例不再白拿 25% |
| 漏选、FP 附属字段未完整惩罚 | Missed Safe Default 进入 Complete/汇总/决策；FP 时间/材料/事件/地点进入分母 | 漏选和附属幻觉均导致失败或降分 |
| 模型可能决定默认勾选 | 模型三套 Schema 均无 selected；图单臂永不勾选 | 仅完整复核、关联节点一致和确定性安全策略共同通过才勾选 |
| checkpoint 不能证明真实请求数与回执 | 状态级严格字段、请求/响应哈希、Provider ID、禁止自动重试 | 字段注入、时间漂移、模型错配、回执缺失、重复 key 均失败关闭 |
| graph 可跨案例重放 | producerRunId、原文和候选图指纹绑定 | 换 case id 或候选指纹即拒绝 |

## 验证证据

- `npm run eval:rco5:b01:verify`: `39/39 PASS`，并输出 `modelCalls=0`、`networkDispatches=0`、`newDatasetFrozen=false`。
- `npm run lint`: PASS。
- `npm run test`: Vitest `464 passed / 1 live OCR skipped`；server `8/8`、Worker `25/25`、time parity `1/1`、multimodal evaluator `23/23`、Functions `5/5` PASS。
- `npm run build`: PASS；保留既有大于 500 kB chunk warning。
- `npm run security:scan`: PASS，扫描 346 个源码/构建文件。
- `npm audit --audit-level=high`: 0 vulnerabilities。
- B0 及更早受保护路径无 Git diff；本轮未修改既有 Expected、freeze、dataset、checkpoint、result 或 cache。

## 仍未证明的事项

- 没有向 DeepSeek 发请求，因此尚未证明供应商端实际接受这套 JSON Schema，也没有新模型质量数据。
- 没有创建或冻结下一轮数据；不能复用 B0 的 12 例重试追分。
- 没有真实图片、文件、真人修改时间或 Chrome/Edge/手机验收。
- 没有接入稳定路径、RC.4、Preview 或 Production，也没有部署。
- 39 项测试证明已知和本轮攻击路径失败关闭，不等于自然语言语义空间已被穷尽。

## 下一动作

停止在授权边界。只有用户另行批准后，才能新建并冻结一批未见匿名 Development 数据、冻结新的付费运行计划与预算，再做真实模型调用。RCO-6 和上线仍被阻断。
