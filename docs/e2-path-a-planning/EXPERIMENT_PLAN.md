# E2.7 Path A Planning & Evaluation Calibration — 预注册执行顺序

状态：`ACTIVE / BLIND_NOT_ELIGIBLE`

## 不变量

- 单阶段 Path A；模型固定 `deepseek-v4-flash`。
- 不复用 FactLedger、Planner，不增加第三/第四次 AI 调用。
- 不修改 Workspace v8、Repository、Migration、DomainCommitPlan、Atomic Commit、Source-before-AI。
- 不修改任何 expected，不按 caseId/固定句子打补丁。
- Preview only；不得部署 Production 或 `student-affairs.site`。

## 顺序与停止条件

1. P0：冻结 Path A 基线、数据集哈希与 Preview 边界。`COMPLETE`
2. P1：冻结 strict / semantic / user-impact 双轨契约。`IN_PROGRESS`
3. P2：至少 60 条真正盲评；必须先冻结标签及哈希，后生成揭盲 key。
4. P3：至少 60 条 Planning failure audit。
5. P4：仅实现确定性 PlanningNormalizer；不得新增事实。
6. P5：仅在 P4 不足时最多两次 principle-only Prompt 迭代。
7. P6：独立 Router Set 至少 80 条。
8. P7：独立 Validator Set 至少 80 条。
9. P8：Repair ablation。
10. P9：component ablation。
11. P10：只有全部 candidate gates 通过才冻结 Candidate。
12. P11：仅在 P10 通过后创建全新 Blind Set，至少 60 条；否则 `NOT RUN`。
13. P12：仅对通过 Blind 的 Candidate 运行 Browser A–J 与工程门槛。

任一步的来源、版本、样本数或时序无法验证时保留 `NOT RUN` / `INCONCLUSIVE`，不得用 mock、fallback、估算或旧缓存冒充。
