# E2.9-R9.1 Harness 完整性加固报告

## 大白话结论

这次没有继续“调模型”，而是修了三把尺子和证据链。

以前有三个问题：

1. Gate 里有一项写成了“无论数据是什么都算通过”，看起来像检查，实际上没有检查作用。
2. 匿名评审揭盲后，没有留下以后能重新验算 X/Y 映射的临时密钥；只能相信当时那个进程。
3. Fact Coverage 有时只看 ID 或大致相似文字。同一个 ID 即使把“提交表格”改成“参加活动”，也可能没有立即报警。

现在：

- “零 Fact Loss 天花板”只作为诊断说明，不再混进 Gate 充当恒真的通过项。真正决定通过的是 `Candidate Fact Loss <= Baseline Fact Loss`。
- 后继匿名流程可在标签冻结后，把 reveal secret 和 private bindings 写入 Git ignored 私有 bundle；以后可以重新计算每一组映射和 commitment。公开文件只放 bundle hash，不泄露 secret。
- 新增逐字段语义检查。任务动作和对象、材料名称、时间角色与时间值、事件标题与时间关系、Evidence、Condition/Ambiguity 表达都会检查；ID 没变但语义变了也会失败。

旧 R9 的报告、标签、Gate 和最终结论没有改写。Screening、Selection、Blind、Production 都没有运行。

## 修复范围

### 1. Gate 恒真字段

旧字段 `zeroFactLossTiePasses` 是一个恒真表达式。R9.1 后继 Gate 删除这项布尔检查，改为：

- 真正 Gate：`candidateFactLossNotWorse`；
- 只读诊断：`factLossCeilingObserved`，仅说明是否出现 0 对 0。

这样 0 对 0 仍可通过“不更差”规则，但不会再拿一个恒真字段伪装成额外证据；1 对 0 会明确失败。

### 2. 揭盲证据可复算

新增私有 verification bundle：

- 只能在 `labelsCompletedAt` 之后生成；
- 保存 reveal secret、private bindings、commitments hash、mapping hash；
- 可由独立 verifier 重新打开全部映射；
- secret 与 bindings 只允许进入 `.evaluation-cache/` 等 Git ignored 私有位置；
- 公开投影只包含 bundle hash 和“标签后持久化”状态。

当前 R9 旧 run 的 secret 当时没有保存，因此不能倒推补造。本轮只完成后继协议实现和合成端到端测试；未来新匿名复评必须使用新协议才会产生真实 bundle。

### 3. FactGraph 语义完整性

新检查不再只问“某个 ID 还在不在”，还会问：

- Task 的动作、对象和 Evidence 是否仍对应原 obligation；
- Material 的名称、必需性、格式、命名、数量、提交渠道和 Evidence 是否被改写；
- TimePoint 的角色、原文、规范化值、精度、待确认状态和 Evidence 是否被改写；
- Event 的标题、说明、地点、起止时间和 Evidence 是否被改写；
- Condition/Ambiguity 是否仍以同一语义类别和原文 Evidence 向用户表达；
- Planner 调用前后的原始 FactGraph canonical snapshot 是否完全相同。

等价 obligation 合并仍允许，但必须保持相同动作、连接词归一后的相同对象和全部原文 Evidence。

## 零模型回放

### 首次 A 轮：保留为失败记录

`cache-integrity-result.json` 为 `INVALID_HARNESS_CHECK_TYPE_FAILURE`。

原因不是语义检查失败，而是 verifier 把观测事实 `expectedAnswersRead=false`、`networkRequests=0` 错放进“所有值必须为 true”的 checks 对象，导致进程退出 1。该失败没有被覆盖或删除。

### 全新 B 轮：语义通过，但证据绑定不完整

`cache-integrity-result-b.json` 完整重跑全部 16 条 observation、8 个 source case：

- deterministic replan：PASS；
- FactGraph immutable：PASS；
- semantic projection exact within declared equivalence：PASS；
- graph mutation：0；
- semantic projection issue：0；
- Expected 读取：0；
- 网络请求：0；
- 新增生产 recognition/generation 调用：0。

提交前复核发现，B 轮虽然逐条语义检查通过，但 verifier 还没有强制绑定整个 candidate canonical hash 和每条保存的 `resultSha256`。因此 B 轮保留为 `PASS_WITH_INCOMPLETE_CANDIDATE_BINDING`，不作为最终证明。

### 全新 C 轮：最终完整性通过

C 轮增加 candidate checkpoint canonical hash 与逐 observation `resultSha256` 的 fail-closed 校验，然后再次完整运行 16 条。`cache-integrity-result-c.json` 是本轮最终证据。

这证明新完整性检查可以在冻结输入上复核现有 R9 缓存，并且不会把旧候选误报为语义丢失。它不证明模型在新输入上变强，也不替代 Screening。

## 新增测试

共新增 10 个通用测试：

- Gate 的 0 对 0、0 对 2、1 对 0 行为；
- labels 冻结前禁止生成 reveal bundle；
- ignored 私有 bundle 可重新打开 16 个映射；
- secret 或 binding 被篡改时失败；
- 正常语义投影通过；
- 同 ID Material 名称篡改失败；
- 同 ID TimePoint role 篡改失败；
- 同 ID Event 标题篡改失败；
- Task 对象篡改失败；
- FactGraph canonical snapshot 被改写时失败。

所有测试使用匿名通用样例，没有使用冻结案例完整句子。

## 没有假装修好的问题

1. **同族审阅隔离**：Codex 协作代理共享工作区，无法用当前 Harness 证明 OS 级 ACL 隔离。只能通过最小输入、全新审阅者、packet 扫描和流程约束降低风险。
2. **旧 R9 commitment**：旧 reveal secret 已经不存在，不能事后伪造为可重开。
3. **上游 Fact Discovery**：模糊时间被精确化、Material 未发现属于上游事实层，不在本轮 Harness 修复权限内。
4. **严格评分冲突**：Expected/Scorer 没有修改；严格分与用户影响代理分的冲突仍需未来获批 Screening 验证。
5. **模型能力**：本轮模型调用为 0，不能声称识别能力已经提高。

## 阶段状态

- R9 冻结结论：`R9_REPLAY_GATE_PASS_SCREENING_REQUESTABLE`，保持不变
- R9.1：Harness integrity hardened，等待后继协议实际使用
- Screening：`REQUESTABLE_NOT_RUN`
- Selection：`NOT_RUN`
- Blind：`NOT_CREATED`
- Production：`NOT_DEPLOYED`
- E3/E4：`NOT_ENTERED`

## 工程验证

- `npm run lint`：PASS；
- `npm run test`：PASS；Vitest 50 个文件、213 项，Node 协议测试 127 项，Worker/Cloudflare 测试 143 项，Server 测试 8 项，Functions 测试 5 项；
- `npm run build`：PASS；
- `npm run security:scan`：PASS，扫描 679 个源码/构建文件；
- `git diff --check`：PASS；
- R9.1 私有回放输出：确认由 `.gitignore` 排除；
- Production runtime 搜索：没有接入 R9.1 模块。
