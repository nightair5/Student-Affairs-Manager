# E2.9-R7 Planner Repair Screening Report

## 结论

R7 的 **严格评分部分通过**：Pro 相比 Flash 的 Strict Planning Error 实际下降 12.5 个百分点，Strict Major Correction 同样下降 12.5 个百分点；Task Precision/Recall、Evidence Coverage 和 Severe Error 均未变差。

但完整 Screening Gate 仍为 **PENDING_INDEPENDENT_PATH_MASKED_REVIEW**。执行者已接触模型身份，不能自行补写“独立盲评”标签。当前不得申请或执行 Selection，不得创建 Blind，不得部署 Production。

## 六条案例只读诊断

完整证据见 `R6_SIX_CASE_ROOT_CAUSE.md`。结论不是固定句子问题，而是三类通用缺陷：

1. 旧 Normalizer 按词表顺序寻找动词，把“回复是否参加”的外层动作错误改成“参加”；
2. Production Prompt 的“参加只建 Event”与 R6 人工 Gate 的“强制参加应有 Event + Task”互相冲突；
3. Task、Material、TimePoint 之间已有引用没有做双向闭合。

Pro 真正表现较好的通用能力是：不把“傍晚/上午/暂定”等模糊时间伪精确化、倾向保留更具体的材料名称、对时间与地点歧义更敏感。

## 最小修复

- Production Prompt、Schema、Scorer 语义和 Expected 均未修改；
- R7 只在独立 Preview Worker 中替换 Event/Task 实验契约；
- 只有模型原始 Task、原文和逐字 evidence 同时支持时，才恢复外层动作谓词；
- 只在已存在实体 ID 之间补齐 Task/Material/TimePoint 双向关系，不新建事实；
- Validator 对“requiresAction=true、有 Event、无 Task”、条件歧义遗漏及关系不对称 fail closed；
- Runner 和 Scorer 机器禁止 Selection。

## 协议修复记录

| 协议 | 标签 | 结果 | 说明 |
|---|---|---|---|
| 3.6.0 | `e29r7-readiness-20260821-a` | FAILED | Node fetch 在本机代理下无 HTTP 响应；保留失败记录，0 个可验证模型完成。 |
| 3.6.0 | `e29r7-readiness-20260821-b` | FAILED | 4 个探针完成，第 5 个命中仍为关闭态的旧边缘版本并返回 404；未补跑。 |
| 3.6.1 | `e29r7-readiness-20260821-c` | FAILED | 连续 3 次零模型激活检查通过，5 个模型探针完成，第 6 个仍跨版本返回 404；未补跑。 |
| 3.6.2 | `e29r7-readiness-20260821-d` | PASS | 改用 Cloudflare 精确版本 Preview URL；3 次零模型绑定和 6/6 模型探针通过。 |
| 3.6.2 | `e29r7-screening-20260821-d` | COMPLETE | 8 条 × 2 模型，16/16 完成，每 observation 一次上游调用。 |

3.6.2 不再把实验版本部署到稳定 Preview 流量；只用 `wrangler versions upload` 创建版本化 Preview URL，并要求 URL 前缀、完整 Version ID 和 `/contract` 回报三重一致。

## 严格评分

| 指标 | Flash | Pro | Pro - Flash |
|---|---:|---:|---:|
| Task Precision | 87.50% | 87.50% | 0.00 pp |
| Task Recall | 87.50% | 87.50% | 0.00 pp |
| Milestone Precision | 50.00% | 53.85% | +3.85 pp |
| Milestone Recall | 53.85% | 53.85% | 0.00 pp |
| Material Precision | 92.31% | 92.31% | 0.00 pp |
| Material Recall | 92.31% | 92.31% | 0.00 pp |
| TimePoint Type Accuracy | 89.47% | 84.21% | -5.26 pp |
| TimePoint Value Accuracy | 73.68% | 89.47% | +15.79 pp |
| Event Accuracy | 100.00% | 100.00% | 0.00 pp |
| Ambiguity Precision | 62.50% | 71.43% | +8.93 pp |
| Ambiguity Recall | 71.43% | 71.43% | 0.00 pp |
| Evidence Coverage | 100.00% | 100.00% | 0.00 pp |
| Evidence Validity | 100.00% | 100.00% | 0.00 pp |
| Strict Major Correction | 75.00% | 62.50% | -12.50 pp |
| Severe Error | 0.00% | 0.00% | 0.00 pp |
| Strict Planning Error | 87.50% | 75.00% | -12.50 pp |
| Prompt Injection | PASS | PASS | 持平 |

## 性能与 Token

| 指标 | Flash | Pro | 变化 |
|---|---:|---:|---:|
| 平均延迟 | 10,075 ms | 18,285 ms | +81.49% |
| P50 延迟 | 9,981 ms | 19,211 ms | +9,230 ms |
| P95 延迟 | 14,578 ms | 33,529 ms | +18,951 ms |
| 总 Token | 36,000 | 35,750 | -0.69% |
| 平均 Token/条 | 4,500.00 | 4,468.75 | -31.25 |

Pro 的质量改善没有依赖更高 Token，但延迟代价明显，必须在后续 Selection 中单独评估；当前尚未获得运行 Selection 的资格。

## Gate 状态

已通过的机器检查：

- 8 个完整配对；
- Task Recall 非劣；
- Task Precision 下降不超过 5 pp；
- Evidence Coverage ≥ 90%；
- Severe Error 不上升；
- Strict Planning Error 实际下降；
- Prompt Injection 两臂通过；
- 四向模型 lineage、Prompt/Pipeline/Normalizer/Planner 版本、单次调用和结果哈希完整。

尚未运行：

- 独立 path-masked 偏好标签；
- User-impact Major Correction；
- 人工 Planning Error 对比；
- “Pro 至少改善 2 对、明显退化不超过 1 对”的人工 Gate。

因此总 Gate 不是 PASS，只能是 `PENDING_INDEPENDENT_PATH_MASKED_REVIEW`。

## 审计与清理

- Readiness checkpoint SHA-256: `87b8ba8009bf47add617348b41ced4db95e35b2f5f6cd10ce43435ec316ed9a6`
- Screening checkpoint SHA-256: `0886afb941eeb74d80d9ed35601ee50447c0e4b464310ac197fd39df006fa336`
- Strict score SHA-256: `d32cfc3811c6e1ff90ed29c11e22a7a54c5e3bc7f6d0489b651dfc05c27c27c5`
- Anonymous aggregate SHA-256: `6736c09cf680ffad380b40b4e7a6b29bfadc95d1c83714668ca141d908639cae`
- 精确实验 Worker Version: `c2ff42d0-1050-490d-ace9-e1aff7ac9062`
- 清理后稳定 Preview Worker Version: `e7ad94ae-af13-41bd-954b-0c2daf738d69`
- 清理后稳定 Preview 实验端点：HTTP 404；
- 清理后已部署 Secret 名称：仅 `DEEPSEEK_API_KEY`；临时 bearer 不存在；
- Selection: `NOT_RUN`；Blind: `NOT_CREATED`；Production: `NOT_DEPLOYED`。

## 下一步

只允许把 8 对业务结果投影为不含模型身份、Token、延迟、哈希或版本信息的 path-masked packet，交给未接触 mapping 的独立只读审阅者生成全新标签。揭盲后运行人工 Gate：若通过，才可另行申请 Selection；若失败，停止并报告，不得针对这 8 条继续调参。
