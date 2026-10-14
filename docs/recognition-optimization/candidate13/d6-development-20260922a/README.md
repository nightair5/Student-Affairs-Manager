# Candidate13 D6 Development结果包

状态：`REJECT_CANDIDATE13_DEVELOPMENT`。

本目录保存D5-R1冻结的24个Candidate03/Candidate13请求的一次性执行、raw、适配结果、v4.1评分、预算结算和工程回放证据。数据角色固定为`SYNTHETIC_DEVELOPMENT / PROVISIONAL_MODEL_AUTHORED`，不具备独立人工Holdout资格。

## 核心文件

- `AUTHORIZATION.json`、`GRANT.json`：本批授权与专用grant。
- `BINDING.json`、`RUN_MANIFEST.json`：24个冻结身份与派发前绑定。
- `raw/`、`results/`：24份原始响应与24份解析结果。
- `ANALYSIS.json`、`REPORT.md`：v4.1逐单元评分、配对结果、门槛和结论。
- `EXECUTION_LEDGER.json`：本批49条权威账本追加记录的只读副本。
- `BUDGET_SETTLEMENT.json`：usage、上界、实际费用可观察性和账本终态。
- `ENGINEERING_REPLAY.md`：独立本机数据库的工程回放与浏览器验收。
- `VALIDATION.md`：测试、保护文件、历史失败及边界。
- `EXPERIMENT_AUDIT.md`、`EXPERIMENT_AUDIT.json`：全新同系列审计员的provisional实验完整性复核；不是独立人工真值。

## 不可扩大解释

Candidate13的Task F1从61.54%升至80.00%，但完整正确来源仍为2/12，并有2个Forbidden。冻结门槛要求全部同时满足，所以正式决定只能是拒绝。工程回放证明编辑和保存链路可以工作，不证明真人正确处置率、低修改率或主动修改时间。
