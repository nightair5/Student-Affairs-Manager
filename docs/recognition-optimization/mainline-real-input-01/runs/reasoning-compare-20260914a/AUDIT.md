# Flash 低强度思考对照收尾审计

## 结论

本轮没有证明 `reasoning.effort=low` 能减少用户修改。首个同材料正式配对中，`none` 在 9.698 秒返回完整结果；`low` 在 37.323 秒后用满 8192 个输出 token，其中 6719 个是推理 token，响应状态为 `incomplete`，原因是 `max_output_tokens`。冻结网关因此拒绝结算和评分，账本立即停机；后续 38 个请求没有发送。

决定为 `DO_NOT_ADOPT_LOW_KEEP_NONE`。保留 `deepseek-flash + candidate03 + reasoning.effort=none`，不修改最大输出、不补跑、不追加 high/Pro/候选，也不把不完整推理内容当作通知事实。

## 本轮改变了什么

- 新增显式 `none` / `low` 实验配置，不放宽历史 `none` 对 `reasoning_tokens=0` 的要求。
- 网关允许 `low` 响应在最终 message 前携带 reasoning 项，但只有最终完整 message 才进入既有 candidate03 解析和评分。
- 用量校验按响应总 output 计费一次，并单独核验 reasoning token 不超过 output；没有重复计费。
- 模型、候选、输入、请求、响应和评分依赖都绑定到固定单元身份。
- 最终答案缺失、截断、usage 不完整或身份不符时，先保留原始响应，再停机；不会自动重试。
- 修复了新策略接入时历史 P/R/S/U/W 批次的显式策略路由，旧回答和旧账本不改写。

## 真实调用结果

计划是 20 份通知、两臂各一次，共 40 次。实际只发生 2 次上游请求：

| 单元 | 模式 | 上游结果 | 等待 | 用量 | 业务结果 |
| --- | --- | --- | ---: | --- | --- |
| Y01-A | none | HTTP 200 / completed | 9698 ms | input 4777，output 2275，reasoning 0 | 两项任务、两个截止时间、三项材料在业务含义上正确；无需实质纠正 |
| Y01-B | low | HTTP 200 / incomplete | 37323 ms | input 4802，output 8192，reasoning 6719 | 最终答案不完整，不评分、不回放、不保存 |

`none` 的严格评分仍因来源范围和精确表达差异标为 major correction，但任务、日期和材料的业务事实正确；两种口径已分开。`low` 没有可用最终答案，所以不存在有效的逐对质量差值、20 份错误计数、中位等待或 P95。

## 用户是否少改

没有新证据证明用户少改。`low` 在第一个样例就把大部分输出预算用于推理，既没有形成可确认建议，也把等待增加到 `none` 的约 3.85 倍。继续发送剩余样例只会在已知协议失败后扩大费用，因此按预先规则停止是正确结果，不是实验漏做。

上一轮可靠基线的既有结论仍可复用：Flash `none` 在 20 份已见通知中 17/20 无需实质纠正，存量零调用工程回放可正确保存 20 条事实正确任务，分布于 16 份来源。它们是历史工程和模型证据，不是本轮 `low` 的收益，也不是真人转化率。

## 费用与账本

- 起点累计上界：10.559813 元，含 A01 永久未知预留 3.30 元。
- Y01-A 已结算上界：0.027754 元。
- Y01-B 因结算拒绝保留未知预留：3.30 元。
- 当前累计权威上界：13.887567 元，低于 20 元项目上限。
- 服务商实际扣费：`NOT_OBSERVABLE`。
- 账本共 512 行，最后 sequence 511，完整哈希链通过；原 507 行前缀逐字保留。

Y01-B 原始响应中的 token 数可读，但它没有完成受控结算，所以不能拿公开价格算出的数替换 3.30 元未知预留，更不能冒充服务商实扣。

## 产品与浏览器

官方内置浏览器本轮按授权只连接一次，21.438 秒后返回 `nodeRepl.fetch request failed`，没有获得可操作标签。本轮两条页面旅程、刷新、独立读库和两个实际下载均为 `NOT_RUN`。

6632 本地服务当前 HTTP 200；对识别端点的 POST 返回 405 `MODEL_AND_WRITES_DISABLED`，说明页面没有开放任意模型调用。先前 Q01/Q07 三项任务的页面闭环，以及 U11 一项任务的双路径下载一致证据继续保留，但不冒充本轮新验收。

## 工程检查

- 新增预算与网关定向测试 120/120 通过。
- Node 语法、TypeScript、lint、无根 `.env` 临时 Vite 构建通过；lint 仅 4 个旧警告，构建仅旧 chunk 警告。
- Vitest 1382 通过、1 跳过；server 8、Worker 25、时间 AST 1、评估库 23、Functions 5 均通过。
- 最终报告写入后 Secret scan 覆盖 2211 个文件并通过。
- `npm run test` 最后仍只有历史 RCO-5-007 的 `package-lock.json` 冻结 SHA 不匹配；锁文件本轮无 diff，旧断言未回切、删除或弱化。

当前工程结论是 `PASS_WITH_RETAINED_HISTORICAL_FREEZE_FAILURE`；模型实验结论是 `INCOMPLETE_PROTOCOL_REJECTED`；浏览器结论是 `NOT_RUN`。三者没有混在一起。

## 后续主线

本轮应停止，不再对低强度思考追加调用。下一次若继续提高首次识别，应回到已经证明可完整输出的 `none + candidate03`，针对复合通知的动作/材料/条件/取消归属做单变量改进；不能用提高 token 上限来掩盖本次低思考协议的成本和截断问题。

官方依据：

- DeepSeek 模型与价格：`https://api-docs.deepseek.com/zh-cn/quick_start/pricing/`
- 思考模式：`https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/`
- Responses API：`https://api-docs.deepseek.com/zh-cn/guides/responses_api/`
