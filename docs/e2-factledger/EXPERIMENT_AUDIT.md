# Experiment Audit Report

**Date**: 2026-08-09  
**Auditor**: GPT-5.6-Sol ultra（fresh same-family agent，read-only，provisional）  
**Project**: Student Affairs Manager E2.5 FactLedger Diagnostic

## Overall Verdict: WARN

## Integrity Status: warn

没有发现虚构 B 结果、自我归一化、修改冻结 expected、caseId 补丁或把 fallback 冒充生产模型。D1/D5/D6 的已报告数字可由当前文件与三份 raw cache 复核；B 确实为 `NOT RUN`。剩余 WARN 来自固有范围、ground-truth 与 strict scorer 限制，而不是尚未修复的 checkpoint/重试缺陷。

本审计为同家族代理复核，只能标记 `provisional`，不是独立第三方认证。

## Checks

### A. Ground Truth Provenance: WARN

- Golden/Holdout/Development 的 expected 来自仓库内开发者编写 fixture，而不是模型输出；冻结 hash 与空 corrections log 由 `scripts/recognition-e2-dataset-freeze.mjs` 检查。
- 三个集合共 258 个唯一 caseId，没有跨集合逐字重复；Development 实际是 27 个语义 family × 4 个变体。
- D1 是单人、已暴露失败样例人工归因；D6 是查看原文和最终输出后的单人多标签 human evaluation，不能作为独立 Blind ground truth。
- `goldenDataset.ts` 中部分显式日期 expected 使用 `normalizedLocal=null / needsConfirmation=false`；当前 strict scorer 无法验证此状态下的具体非空归一化值。

分类：synthetic/developer-authored proxy GT + exposed human diagnostic；没有 real-world independent GT。

### B. Score Normalization: WARN

- 未发现以预测自身 max/min/mean 归一化；分母来自 expected、predicted 或两者最大值，见 `src/recognition/e2/scoring.ts` 的 aggregate。
- 空 actual alias 命中缺陷已修复并增加回归测试；24 条 D5 指标重算前后一致。
- 剩余限制：对称 substring 仍可能接受过短泛化 alias；零分母默认 1；Task 未完整评分 actor/modality/condition/channel，Event 100% 仅代表 21/21 标题匹配。

### C. Result File Existence: WARN

- 三份 raw cache 存在并已在 `d5-ab-results.json` 绑定文件名、entry count 与 SHA-256：Golden 110（109 ok + 1 request failure）、Holdout 40 ok、Development 108 ok。
- D5 24 条 A 指标、延迟、token 与重新评分一致；258 条缓存中的 Repair 为 29 attempts / 24 applied / 2 strict improvements / 0 strict harm。
- `NOT_OBSERVABLE`、`NOT_RUN`、`NOT_COMPUTABLE` 与磁盘证据一致；没有 B checkpoint。
- Legacy A cache 没有调用时 input hash，已明确披露；未来配对 B 强制要求新 A 的 source/input hash、Prompt 与模型一致。

### D. Dead Code Detection: WARN

- D5 summarizer、D6 auditor、strict scorer、FactLedger parser/validator/harness 均有实际调用与结果文件。
- `d2-semantic-equivalence-contract.json` 仍是设计稿，尚无 evaluator 消费；报告已明确不能声称语义评分运行过。
- B 路径只有单元/模拟验证，没有真实端到端模型结果。
- FactLedger 没有生产导入；checkpoint 同 label 覆盖、失败隐式重试、resume 漂移、Prompt 漂移均已在审计过程中修复。

### E. Scope Assessment: WARN

- D1：30 条定向失败、单一标注者；
- D5：24 条已暴露复杂样例、每例一次缓存运行、B 0 次；
- D6：60 条已暴露后置人工标签；
- 无新 Blind、无第二标注者一致性、无多次运行、无独立复制、无多语言证据。

最终报告已把 73.7% 限定为“本次 30 条中 19 条人判产品错误”的样本内结论，不再外推。

### F. Evaluation Type: WARN

- D1：`human_eval / exposed / single-rater`；
- D5 A：`synthetic_proxy strict structural evaluation`；
- D5 B：`NOT_RUN`；
- D6 Router/Validator：`human_eval / exposed`；
- FactLedger 单元测试：`simulation_only`；
- Blind / real_gt：无。

## Action Items

- 在运行 B 前，为 24 条样例建立独立、可审计的 Fact Recall reference/scorer；当前 A 无显式事实层，B 也尚无事实召回评分结果。
- 实现并验证 semantic/human-impact evaluator，不把契约 JSON 存在当成已运行。
- 对显式日期的矛盾 expected 只能通过 corrections log 合法处理；不得直接改标准答案。
- 增加第二标注者、盲化顺序与 agreement 统计。
- 使用新 label 重跑带完整 input hash 的 A/B；不要给 legacy cache 事后补调用时 hash。

## Claim Impact

- “FactLedger 优于当前管线”：unsupported，且当前未声称。
- D5 A strict 指标：supported，仅限 24 条暴露合成样例。
- “Planning 占 73.7%”：supported only within selected D1 sample。
- Major Precision/Recall：provisional single-rater human evaluation。
- Repair Success 6.90% / Harm 0%：supported only under strict scorer。
- D6 Router/Validator 指标：supported as exposed diagnostic evidence。
- `E2 BLOCKED / E3 NOT READY / PRODUCTION NOT READY`：supported。
