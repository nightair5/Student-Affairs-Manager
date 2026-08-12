# E2.9 Reduced V4 Pro 实验计划

日期：2026-08-13  
问题：在冻结 Path A 的条件下，`deepseek-v4-pro` 是否显著优于 `deepseek-v4-flash`，值得进入更大规模验证？  
方法主张：只改变 DeepSeek model ID，使用分阶段早停的严格配对实验。

## Claim Map

| Claim | 最小可信证据 | 实验块 |
| --- | --- | --- |
| C1：Pro 在复杂通知上有大且稳定的用户质量收益 | 24 条 Selection 大效果 Gate 通过，且 24 条新 Blind 保持 Recall/User-impact 与配对胜负优势 | S3–S6 |
| C2：收益不是 Prompt、Schema、Pipeline 或评分变化造成 | 两臂 Prompt/Schema/参数/输入/评分哈希一致，response.model 无 fallback，独立审计通过 | S0–S8 |
| Anti-claim：收益只是更多 Token/延迟或选择性重跑 | 每 observation 单次正式生成、失败保留、交错顺序、完整 latency/token 与 checkpoint | S2–S8 |

## Run order 与预算

| 阶段 | 目的 | 正式样例调用 | 进入条件 | 早停 |
| --- | --- | ---: | --- | --- |
| S0 | `/models` 与最小 Pro 兼容性 | 0；另有 1 次无用户数据 Pro 请求 | Preview server Secret 可用 | Pro 不存在或身份不符即停 |
| S2 | 3 条冒烟 × 2 模型 | 6 | S0/S1 通过 | 任一 Pro 冒烟失败即停 |
| S3 | 8 条快速筛选 × 2 | 16 | S2 通过 | Screening Gate 失败即停 |
| S4 | 补齐 Selection 剩余 16 条 × 2 | 32 | S3 通过 | Selection Gate 失败即停 |
| S6 | 24 条新 Blind × 2 | 48 | S4 通过且 Candidate 冻结 | Blind Gate 失败即停 |

正式样例调用上限为 102；加上 S0 规定的最小 Pro 兼容性请求，最多 103 次上游 completion。不会把 Gate 后阶段视为预先承诺调用。

## 冻结设置

- Flash / Pro 都使用 `POST /chat/completions`，直接 model ID，不使用别名或 fallback。
- Prompt `recognition-2.4.1`，Schema `2.0`，max_tokens 6000，temperature 0，thinking disabled，JSON object。
- Router 强制绕开；Validator 非变更执行；Repair 禁用；PlanningNormalizer 不接入。由此每个 observation 只产生一次上游模型调用。
- 生成只读取 source-only manifest；Expected 在全部成对输出完成后才由评分脚本加载。
- 原文、原始模型输出、逐例 Evidence、usage 与 mapping 仅写入 Git ignored `.evaluation-cache/`。

## 决策顺序

1. 先证明模型真实存在且返回模型身份一致。
2. 冒烟只验证兼容性，不形成质量结论。
3. 8 条筛选必须同时满足自动指标与路径遮蔽用户影响早停条件。
4. 24 条 Selection 要求大效果；只有 `V4_PRO_SELECTION_PASS` 才创建 Blind。
5. Blind 即使通过，也只允许 `MODEL CANDIDATE PROMISING — SMALL SAMPLE`。
6. 最终由只读同家族独立审计给出 provisional PASS/WARN/FAIL。

## 风险

- `deepseek-v4-pro` 可能未向当前账户开放：S0 立即停止。
- Prompt 内固定输出元数据仍写 Flash：模型身份以不可变 HTTP `response.model` 与 `system_fingerprint` 为准，原始输出不作模型身份依据。
- 当前没有 entity-level Semantic P/R：若不能在冻结契约上审计实现，则按规范报告 `NOT RUN`，不得估算。
- 24 条样本只能支持小样本候选，不能支持上线结论。

## STOP 边界

不得进入 E3/E4，不部署 Production，不修改 `student-affairs.site`，不切换生产默认模型，不自动启动 E2.10。
