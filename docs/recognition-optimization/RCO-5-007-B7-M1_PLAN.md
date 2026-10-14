# RCO-5-007-B7-M1 模型锚点选择与冻结 P3 计划

**Problem**：B6 只证明理想 scope/action/object 锚点进入 P3 后，本机任务形成和修订关系可以正确工作；当前未知瓶颈是模型能否从原文和不可变 scope catalog 中找对这些锚点。

**Primary claim**：`deepseek-v4-flash-vision-exp` 只选择命题 scope、原文动作和原文对象，不输出语义、风险、`requiresAction`、关系或 `selected`；冻结 P3 独立形成待确认任务。

**Anti-claim**：结果不能来自 Expected 泄漏、模型替本机决定安全状态、Repair/retry 追分，或用本机理想锚点成绩冒充模型成绩。

## 数据与唯一变量

- 数据：12 个全新匿名合成 Development 案例，与 B0–B6 的 source text 和 semantic family 均不重复，逐例字符 bigram Jaccard `<0.55`。
- 输入：纯文字、reference time/timezone 和本机生成的 immutable scope catalog；不发送图片、文件、Expected 或整个工作区。
- 模型唯一输出：`directive.id`、`propositionScopeIds`、`action(scopeId,surface)`、`object(scopeId,surface)`、`ignoredScopeIds` 及来源绑定字段。
- 本机职责：严格 Schema/引用校验、actionType/effect、完整语义、`requiresAction`、修订关系、`selected` 和评分。
- 本轮不设 verifier；否则无法单独识别首次模型选择能力。

## 拟冻结付费参数（等待用户确认，不构成调用授权）

| 参数 | 固定值 |
|---|---|
| model | `deepseek-v4-flash-vision-exp` |
| cases / candidate calls | 12 / 每案恰好 1 次 |
| maximum dispatches | 12 |
| temperature / thinking | `0` / `none` |
| Repair / retry | `0 / 0` |
| maximum request bytes | 32,768 / call |
| maximum output tokens | 3,000 / call |
| proposed CNY hard cap | `10.00` 元 |

服务商账单不可观测时写 `NOT_OBSERVABLE`；保守费用包络只用于阻断超预算，不冒充实付金额。用户必须明确同意“最多 12 次、10 元硬上限”后，才创建并冻结联网 runner/checkpoint。

## 失败与停止条件

1. dataset、Expected、Schema、P3 或任一冻结依赖哈希漂移：调用前停止。
2. Secret 缺失/格式异常、模型身份不符、请求体含 Expected/安全字段、理论最坏费用不低于 10 元：调用前停止。
3. 出现未知回执、超时后无法确认是否计费、非 2xx、认证/余额/限流/模型错误：立即停止后续 dispatch，禁止 retry。
4. HTTP 成功但 JSON/Schema/引用绑定不合格：该例记失败，不 Repair，继续未调用案例；整轮结构门失败。
5. 实际 dispatch 超过 12、任何 Repair/retry、请求出现 `requiresAction/semantics/effect/actionType/revisionRefs/selected` 或 Expected：整轮 `INVALID_RUN`。

## 预注册指标与门槛

- 运行完整性：12/12 dispatch 有明确终态；12/12 严格 Schema 与来源绑定通过，否则 `INVALID_RUN`。
- 模型选择：scope micro F1 `>=90%`；action surface exact `>=90%`；object surface exact `>=90%`；完整 anchor case `>=80%`。
- 冻结 P3 端到端：Task F1 `>=90%`；`requiresAction >=95%`；Complete Task Case `>=80%`；Forbidden `=0`。
- 修订安全：cancels/supersedes/amends 各 100%；旧要求失效、新要求生效、歧义 unresolved 各 100%；stale/selected stale `=0`。
- 任一硬门失败：`NO_PROMOTION / PAID_REPLICATION_BLOCKED`。全部通过也只到 `PROMISING_FOR_NEW_FROZEN_REPLICATION`，不启动 RCO-6、不接稳定路径、不部署。

## 顺序

1. 0 调用：新契约、B7 数据、P3 理想锚点上限、隐私/不重复检查。
2. 0 调用：冻结并提交推送 dataset/Expected/plan/contract/P3 依赖。
3. 等待用户明确批准 12 次与 10 元硬上限。
4. 0 调用：新增联网 runner/checkpoint、费用包络和 pre-call 审计，再次冻结提交。
5. 最多 12 次：单次正式运行；随后本机评分、结果冻结和对抗审查。

本计划采用项目自己的计划—跟踪表—冻结清单—追加日志体系；通用 experiment-plan 输出模板不替代项目既有权威链。
