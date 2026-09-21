# Candidate12 D2 临时 Development 配对执行包

状态：`D2_EXECUTION_COMPLETE_SCORING_PACKAGE_INVALID`。正式预注册结论：`REJECT_CANDIDATE12_ENGINEERING_SCREEN`。

本批在用户明确授权后，按 D1 冻结顺序一次性执行 candidate03 与 Candidate12 的 12×2 配对请求。24/24 请求均取得 HTTP 200 和确定 usage，24/24 完成结算；没有重试、repair、verifier、halt 或 uncertain。执行代码先在提交 `b44c47335a579c94d7749a632acc4997c64bb390` 推送并与远端核对，再创建 grant 和发送请求。

## 正式结论

D1 冻结的 `scorerReference` 使用 `{action, object, status, actionable}`，但绑定的 `candidate11-scoring-2.0.0` 要求 `{actions[], objects[], fields}` 及结构化 checks。10 个含任务的来源均触发 `C11_REFERENCE_IDENTITY_INVALID`。为了不在看见结果后改 Expected、补评分适配层或降低门槛，本轮正式筛选失败关闭，Candidate12 不进入独立人工 Holdout。

`ANALYSIS.json` 另含一份明确标为事后、非预注册的任务结构诊断：Candidate03 的任务 P/R/F1 为 86.67%/72.22%/78.79%，Candidate12 为 94.12%/88.89%/91.43%。该诊断显示 Candidate12 在本批合成材料上少了 3 个 FN、1 个 FP，并修复了 PD09 多端点保留；但两臂诊断完整来源仍均为 6/12，Candidate12 仍有 1 个 Forbidden，且完整来源没有净增 2，不能据此晋级。

这些数据是 `SEEN_SYNTHETIC_DEVELOPMENT / PROVISIONAL_MODEL_AUTHORED`。它们不是独立人工真值、真人试用或“接受并保存”的真实识别转化率。

## 执行与费用

- grant：`dda1a7f0-b703-435c-bff9-37e328ed26b6`
- 调用：24；settle：24；retry/repair/verifier：0/0/0
- usage：输入 109,392 tokens，输出 27,158 tokens
- 本地可审计费用上界：¥0.436048
- 授权最坏上限：¥51.904512
- provider 实际扣费：`NOT_OBSERVABLE`
- 权威账本：693 → 742 行；最终 SHA-256 `df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e`；tail `6812e1b072caeaa4fd3e6e8e55b485c57533bc0a0d9eaaff4dd84bbf48809922`

## 文件

- `AUTHORIZATION.json`：本轮明确授权及边界。
- `BASELINE.json`、`BINDING.json`、`BILLING.json`、`SEND_REVIEW.json`、`GRANT.json`：执行前身份、价格、预算与账本绑定。
- `raw/`：24 份只写一次的上游原始响应记录。
- `results/`：24 份冻结适配结果。
- `EXECUTION_LEDGER.json`：逐请求 reserve、response、usage 与 settle 绑定。
- `ANALYSIS.json`：正式失败关闭及事后诊断。
- `REPORT.md`：可读结果摘要。
- `SCORING_CONTRACT_INCIDENT.md`：冻结评分接口不兼容的根因和后续边界。
- `VALIDATION.md`：本轮测试与保护核验。

下一步只能先做零模型调用的 D3：修复并预注册未来数据使用的参照/评分器接口契约，给现有 D2 结果保留事后诊断标签；不得修改 D1 Expected 后把同一批结果重新包装成正式 PASS。正式 Holdout 仍等待两位真实人员的 12 份独立双审材料。
