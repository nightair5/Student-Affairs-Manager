# Candidate13 D5 Development 准备包

状态：`CANDIDATE13_V4_DEVELOPMENT_READY_FOR_NEW_AUTHORIZATION`。

本包为D5-R1：在 Candidate13 D4 冻结与D5 v4.1评分/测量契约提交`ee6ee45caa4e1bd258237ccb4c6bc9792d0c9e34`之后，重新创建12份匿名合成Development、12份完整的模型辅助单作者参照，以及Candidate03与Candidate13的12×2零调用请求身份。v4.0工作树草稿从未派发或评分，已明确作废。

它可用于下一轮Development工程筛选，不是独立Holdout、真人试用或商业效果证据。当前四项主指标均没有新模型/真人实测结果。

主要产物：

- `SOURCES.json`：12份来源，不包含Expected。
- `REFERENCES.json`：12份完整参照和v4编译结果。
- `PREPARED_REQUEST_IDENTITIES.json`：24个`dispatchAuthorized=false / NOT_RUN`身份。
- `OVERLAP_REPORT.json`：本地逐字与字符bigram高相似检查。
- `MANIFEST.json`：Candidate13 D4身份、v4评估绑定、哈希、账本和边界。
- `MEASUREMENT_CONTRACT.md`：四项主指标的分母、终态和反作弊规则。
- `EXPERIMENT_DESIGN.md`：配对顺序、失败处理和晋级门槛。
- `BUDGET_AUTHORIZATION_CARD_DRAFT.md`：未授权的费用上界草案。
- `HUMAN_TRIAL_PROTOCOL.md`：后续独立标注与真人行为验证协议。
- `EXPERIMENT_AUDIT.md/.json`：同系列全新审计员的provisional完整性复核；结论`PASS_WITH_WARN`。

构建/验证：

```powershell
node scripts/prepare-candidate13-d5.mjs --verify
node --test scripts/candidate13-d5-scorer.node-test.mjs scripts/candidate13-d5.node-test.mjs
npx vitest run src/experiments/candidate13
```

真正派发24次请求前，必须重新核价、创建新grant并取得用户对这一24次和费用上限的明确授权。
