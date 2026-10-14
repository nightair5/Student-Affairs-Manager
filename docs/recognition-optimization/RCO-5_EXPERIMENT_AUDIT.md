# RCO-5 新鲜对抗实验审查

**日期**：2026-09-02

**审查对象**：隔离的 `facts-1.0` 技术候选与 0 调用契约证据

**审查独立性**：同模型家族、新鲜上下文、只读审查，`provisional`

**最终结论**：`Overall WARN / CONTRACT_EVIDENCE_REPRODUCED_WITH_AUTHORITY_CHAIN_WARNINGS`

## 审查边界

本审查只回答事实账本、确定性构造器、共享 Schema 复验和失败保护是否可复现。它不审查模型 Recall/Precision、图片或文件识别正确率、真人修改时间、真实材料泛化、浏览器兼容或发布资格。本轮模型调用为 0，稳定 Worker、浏览器默认路径、RC.4、Production 与稳定模型均未修改。

## 最终复现证据

- `src/recognition/facts.ts` SHA-256：`e6f1003d703ade7d1f55a3d62787e00855e34e591075f807cf008a1a01cf58e1`
- `src/recognition/facts.test.ts` SHA-256：`332b55865100868d097217a839db0e0d7ebab98ba4c4c3314ed5f168b3052c63`
- 共享 Schema SHA-256：`81f636bcf62a4e35221ba7e620a0410b3cc39bbf7481882e42ab1222839eab40`
- 共享时间 AST SHA-256：`d72109638ce4c653602478d2cd09049ab5a896a17c041422e8f5b583b8afde7d`
- 定向测试：14/14 PASS；目标 lint/typecheck PASS。
- 全量门禁：365 个常规测试 PASS，1 个 live OCR 按策略 SKIP；最终 security scan 267 files PASS；npm audit 0 vulnerabilities；三环境 Cloudflare dry-run PASS，未部署。

## 六项审查

| 维度 | 状态 | 结论 |
|---|---|---|
| A. Ground truth / 证据基准 | PASS | 只使用匿名合成契约夹具，不把手工 facts 当模型质量 ground truth。 |
| B. Normalization / 结果归一化 | PASS | composer 后再次调用共享 `RecognitionResult 2.0` 校验；时间只走统一 AST。 |
| C. Result existence / 结果存在性 | WARN | 技术结果存在且可复现，但审查时尚未形成最终提交；提交哈希需由完成现场补记。 |
| D. Candidate isolation / 候选隔离 | WARN | 隔离有助于零风险验证，但也意味着尚无 Worker/浏览器产品链路证据。 |
| E. Scope / 授权范围 | PASS | 0 模型、0 Repair、无 Secret、无真实数据、无真人、无部署、无受保护输入修改。 |
| F. Failure classification / 失败分类 | PASS | 技术 PASS、质量 NOT_RUN、R6 BLOCKED、NO_PROMOTION 分层清楚。 |

阶段顺序审查为 PASS：RCO-G5 没有质量证据时，RCO-6 正确保持 `BLOCKED_BY_RCO_G5 / NOT_STARTED`。

## 审查促成的修复

初轮审查指出的缺口已在最终候选中修复：资源和关系 distinct 上限、最终共享 Schema 复验、敏感对象不依赖危险动词、视觉独有 action/event 禁止 compose、无关文字不得为视觉动作洗白，以及八类负例不能被解释为模型语义正确率。

## 裁决

该实现可作为 RCO-5 的隔离技术候选保存，结论仅为 `TECHNICAL PASS`。由于 B1/B4 冻结同输入模型配对未运行，RCO-G5 保持 `QUALITY NOT_RUN`，不得晋级、不得启动 RCO-6、不得上线。

审查记录目录只保存可披露的结论、哈希、命令级复现信息和限制，不包含也不声称包含内部思维链。
