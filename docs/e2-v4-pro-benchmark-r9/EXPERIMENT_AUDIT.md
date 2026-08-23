# E2.9-R9 实验完整性审计

**日期：** 2026-08-24

**审计者：** fresh GPT-5.6-Sol ultra，same-family，只读、对抗性、provisional

**审计对象：** `e29r9-cache-replay-20260824-a` 与 `e29r9-replay-review-20260824-a`

## 总体结论：WARN

最终稳定快照未发现阻断性实验完整性缺陷。16 条候选生成、冻结后评分、匿名 packet、标签、揭盲与 Gate 算术均可在本机证据范围内复核，最终状态 `R9_REPLAY_GATE_PASS_SCREENING_REQUESTABLE` 有内部证据支持。

这不是外部见证的盲评，也不是人工或 Ground Truth。审计结论为：

`INTERNALLY CONSISTENT / GATE REPRODUCIBLE / SAME-FAMILY PROXY / EXTERNALLY UNATTESTED`

审计中一度发现主报告引用尚未存在的审计文件。该交付缺口通过创建本文件和 `experiment-audit.json` 消除；最终验证必须再次确认二者存在、JSON 可解析且 Git diff 无异常。

## 已核验通过

- 预注册提交 `0546922` 早于修复提交 `f5ac05d`，并早于候选生成与评分。
- Gate preregistration、Gate policy、source manifest、frozen checkpoint、candidate checkpoint 和 reviewer packet 的 canonical/raw hash 绑定一致。
- Candidate 在 `2026-08-23T17:20:09.118Z` 冻结，评分在 `2026-08-23T17:20:09.832Z` 执行；候选冻结先于 Expected/scorer 加载。
- 生成阶段和匿名 packet 不含 Expected；严格评分阶段读取冻结 Expected，但 Scorer、Schema、三套 Expected 与 Production worker/recognition 相对基线 `3f67959` 未修改。
- 16 个 observation 唯一且完整，恰好为 8 个 source case × 2；16 个 candidate 均能由当前隔离 Planner 确定性重建。
- packet 的直接身份扫描、固定值/日期/字段顺序/ID/文本签名扫描和 Expected-key firewall 无 finding；X/Y 的 Candidate 分配为 8/8。
- 本地文件时序为 packet/commitment → packet audit → labels → reveal；16 条标签完整且唯一。
- Gate 独立重算：16 determinate；Candidate/Baseline Preferred 8/1，净胜 7；Major 3/9；Planning Error 4/9；Fact Loss 0/2；Over-splitting、Evidence Gap、Severe Error 均为 0/0。
- R8 文件与结论无修改，仍为 `R8_REPLAY_ADJUDICATION_FAIL`。
- `.evaluation-cache/` 被 `.gitignore` 忽略，未进入 Git；安全扫描未发现凭证模式。
- 没有 Screening、Selection、Blind 或 Production 执行。

## 非阻断风险

### Medium：审阅隔离只有流程证据

runner 只等待外部写入 packet audit 和 labels，匿名包本身可证明没有 Expected 或直接路径身份，但没有 OS ACL、访问日志或完整 reviewer trace 证明审阅进程只能读取 packet。因此本轮只能作为 same-family provisional proxy，不能升级为人工 Blind 或 Ground Truth。

### Medium：commitment 无法被第三方事后重新打开

mapping commitment 在 labels 前落盘，但 reveal secret 未持久化。运行时同一进程完成 commitment 校验与 reveal；事后审计者只能验证公开的 mapping、commitment 列表、代码与本地时间顺序内部一致，不能独立重建 secret→mapping。cache 和时间戳也没有外部不可变见证。

### Low：零损失天花板字段恒真

`scripts/e2-9-r9-path-mask.mjs` 中 `zeroFactLossTiePasses` 的实现表达式恒为 true。它表达“R9 政策允许 0/0 天花板”，不能作为独立成绩证据。本轮实际 Fact Loss 为 Candidate 0、Baseline 2，`candidateFactLossNotWorse` 已独立通过，因此不影响 Gate 结论。Gate 已在 labels 前冻结，审计后不事后修改。

### Low：Fact Coverage 是内部保真代理

内部 Fact Coverage 使用 Fact ID 或宽松文本重叠判断，不能检测所有“ID 保留但语义改变”。主报告已把它限定为 FactGraph→Planner 内部保真，不宣称独立 Fact Recall。

### Low：canonical hash 与文件字节 hash 不同

公开的 candidate checkpoint hash 是 canonical JSON SHA-256，不是原始文件字节 hash。两者差异属于编码口径，不是内容绑定失败；主报告已明确标注 canonical。

## Claim 边界

- “R9 Gate 在本地证据范围内可重算通过”：SUPPORTED。
- “候选在 same-family 匿名代理评审中 8 对 1 胜出”：SUPPORTED WITH SCOPE QUALIFIER。
- “可以另行申请一次新 Screening”：SUPPORTED；只表示 requestable，未授权也未执行。
- “R9 已经通过真实模型 Screening、Blind 或 Production 验收”：UNSUPPORTED。
- “完全零模型”：UNSUPPORTED；只有新增 production recognition/generation 调用为 0。
- “外部不可篡改的人工盲评”：UNSUPPORTED。

## 审计状态

- 审计 verdict：`WARN`
- 阻断性完整性缺陷：最终快照未发现
- 接受级别：`provisional`
- Screening：`REQUESTABLE_NOT_RUN`
- Selection：`NOT_RUN`
- Blind：`NOT_CREATED`
- Production：`NOT_DEPLOYED`
