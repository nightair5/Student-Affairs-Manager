# RCO-5-009A 执行跟踪

| Run ID | 目的 | 首次结果 | 当前状态 |
|---|---|---:|---|
| RCO-5-009A-A1 | 四个新鲜边界对抗夹具 | 1 PASS / 3 FAIL | ROOT_CAUSES_CONFIRMED |
| RCO-5-009A-C1 | action-local 非任务判定 | 定向 PASS | COMPLETE |
| RCO-5-009A-C2 | 对象内关系动作边界 | 定向 PASS | COMPLETE |
| RCO-5-009A-C3 | 条件事实邻接边界 | 定向 PASS | COMPLETE |
| RCO-5-009A-A2 | 首轮独立对抗 | 聚焦 39/39，但 4 个身份断层反例失败 | BLOCK_ROOT_CAUSE_ESCALATED |
| RCO-5-009A-C4 | candidate ledger 直接物化与独立 Schema | 聚焦 49/49 | COMPLETE |
| RCO-5-009A-A3 | 最终独立对抗复审 | 49/49 + 扩展反例 PASS | PASS |
| RCO-5-009A-B8-R2 | 新版本已见 B8 分层回归 | Task F1/边界 100%；Complete 11/12；1 个旧标签冲突 | ARCHITECTURE_PASS_LABEL_CONFLICT_RECORDED |
| RCO-5-009A-G1 | 全量工程与安全门 | lint/build/security PASS；全量 763 pass/1 live OCR skip | PASS_WITH_EXISTING_CHUNK_WARNING |
| RCO-5-009-B9-F1 | 全新 B9 | 未创建 | ELIGIBLE_AFTER_009A_FREEZE_AND_PUSH |

固定边界：0 次模型调用；v1 freeze 和既有数据/结果只读；无稳定接入、RCO-6 或部署。B9 首次运行前必须先冻结并提交数据与 Expected；B9 必须真实检验 `needs_model`，不能复制 B8 的本机自证结构。
