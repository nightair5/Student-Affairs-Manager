# Candidate11 B1 零调用准备包

状态：`B1_PREPARED_FOR_REVIEW` / `MODEL_CALLS=0` / `CANDIDATE11_RESULTS=NOT_RUN` / `AWAITING_NEW_MODEL_CALL_AUTHORIZATION`。

本目录冻结六份已见Development来源、六份完整工程参照、四臂24个请求身份、实际模型Schema、版本与哈希清单、消融设计、评分细则、方法审查和预算授权卡。它没有Secret、grant、预算预留、收据或模型回答，也不是Holdout、独立人工真值或真人试用结果。

## 审查入口

- `EXPERIMENT_DESIGN.md`：2×2因素、平衡顺序、失败与停止、候选选择规则。
- `SOURCES.json`：六份来源、出处、已见程度、场景与教学例重合。
- `REFERENCES.json`：任务最小义务、动作/对象别名、条件、完成标准、材料、时间、修订和禁止推断。
- `SCORING_REFERENCE_RULES.md`：完整/部分参照、合法拆合、匹配与歧义裁决。
- `BUDGET_AUTHORIZATION_CARD.md` 与 `PRICING_EVIDENCE.json`：官方计价、最坏预算、唯一账本、锁和续跑方案。
- `PREPARED_REQUESTS.json`：24个完整prepared packet；全部 `dispatchAuthorized=false`、`resultStatus=NOT_RUN`。
- `MODEL_SCHEMA.json`：24个请求共用的实际模型输出Schema。
- `MANIFEST.json`：来源、参照、候选、示例、Schema、评分器、适配器、脚本及逐请求哈希。
- `PREPARATION_REPORT.json`：零调用、保护文件、账本快照和历史失败摘要。
- `REVIEW.md`：消融方法审查与仍未覆盖的证据边界。

生成与验证命令：

```bash
node scripts/prepare-candidate11-b1.mjs --verify
node --test scripts/candidate11-b1.node-test.mjs
```

`--write` 只用于首次冻结缺失产物；已有产物字节漂移会失败。准备脚本仅读取权威账本和工作树快照进行一致性确认，不打开writer。任何未来派发都需要新的、明确的模型调用及预算授权，并另行创建与24个冻结身份绑定的grant。
