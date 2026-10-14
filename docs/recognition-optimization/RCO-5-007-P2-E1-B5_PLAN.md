# RCO-5-007-P2-E1/B5 类型夹具修复与新盲测计划

## 授权与边界

- status: `AUTHORIZED / ZERO_MODEL_CALLS / IN_PROGRESS`
- E1 只修复 `taskFormationB4Dataset.test.ts` 的 TS2352 类型夹具；不修改 B4 Expected、dataset、freeze 或 P2 语义实现。
- B4 已见，只允许证明类型修复后测试、构建和原质量结果可复现；不得重新称为未见。
- E1 必须通过 lint/test/build/security 后，才允许创建全新匿名 B5。
- B5 数据与 Expected 必须在首次 P2 运行前冻结并提交；首次运行后立即视为已见，失败只审计不追分。
- 不修改任何既有 checkpoint/cache，不接稳定路径、不读取 Secret、不调用模型、不启动 RCO-6、不部署。

实验计划技能引用的三个共享输出模板本机缺失，本轮继续使用项目现有的计划、跟踪表、冻结清单、追加日志和短上下文。

## Claim Map

| Claim | 最低可信证据 | 反声明 |
|---|---|---|
| C1：B4 阻碍仅是类型夹具，不改变数据、Expected、P2 或运行时行为 | 原 freeze 不改；唯一源文件差异为类型声明；TypeScript 转译后的 JavaScript 哈希前后一致；B4 已见回归指标逐项等于原结果；lint/test/build/security 全通过 | 借修类型之机修改 B4 答案、P2 逻辑、评分器或运行结果 |
| C2：P2 的质量与工程门可在新表达上同时成立 | 全新 B5 首次门达到固定指标，且完整工程与冻结完整性通过 | 用已见 B4 回归替代 B5，或 B5 失败后修改再跑 |

## E1 固定步骤

1. 记录原 B4 数据测试 SHA、原 freeze 中的绑定值和待修改的唯一类型行。
2. 将 `revisionRefs: []` 的 tuple 类型改为 `ScopeReferenceDirective['revisionRefs']`；不改运行时代码。
3. 生成追加式订正记录，证明数据、Expected、P2、评分器和原 B4 freeze 字节未变，且修复前后转译 JavaScript 相同。
4. 用已见 B4 回归并与原 `result.json` 逐字段比对。
5. 运行 lint、test、build、security；任一失败则停止，不创建 B5。

## B5 固定门

- 16 个全新匿名合成 Development challenge cases；source text 和 semantic family 不复用 B0–B4。
- 16/16 可评分；Task F1 ≥90%；requiresAction ≥95%；Complete Task Case ≥80%；Forbidden=0。
- 同时报告 Precision/Recall、语义字段、任务边界、Major Correction、Safe Default 和 revision/stale-task，不只报告 F1。
- 任一冻结漂移、Expected 泄漏、工程失败、模型/网络/Secret 使用均为 STOP。

## 结论边界

B5 即使通过，也只允许另行申请付费模型协议；不证明模型正确率、图片/文件正确率、真人修改时间或上线资格。
