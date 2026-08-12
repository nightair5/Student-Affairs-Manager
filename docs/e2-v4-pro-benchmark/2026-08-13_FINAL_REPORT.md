# E2.9 DEEPSEEK V4 PRO REDUCED BENCHMARK REPORT

## 1. Executive Summary

最终状态：`EXPERIMENT BLOCKED`。

DeepSeek V4 Pro 的 S0 可用性和 3/3 Pro 生成均通过，但完整 6-observation 冒烟有 1 个 Flash HTTP 401，协议禁止重试 401；Smoke 3 只有 Prompt Injection/trust-boundary，没有冻结 Ambiguity 标签；同时冻结 24 条选择集不含 S3 强制要求的 pure-information/prompt-injection 结构标签，无法冻结合规 8 条。依据提前停止规则，未执行 S3/S4/S6/S7，不能回答 Pro 是否明显优于 Flash。

## 2. Reduced-sample limitation and starting status

- 起始：E1 COMPLETE；E2 BLOCKED；E3 NOT READY；PRODUCTION NOT READY。
- 本轮实际：1 次无用户数据 S0 compatibility completion；6 个正式 smoke observation，其中 5 个上游 completion。
- 未产生 selection、Blind、浏览器或质量结论。

## 3. Git baseline and version reconciliation

- tag：`v2-e2-7-blocked` → `9c86661e9320a182f3043115cd50389514a508f6`
- branch：`codex/e2-9-v4-pro-small-benchmark`
- frozen worker：Prompt 2.4.1；Schema 2.0；Pipeline 2.2.1；Router 1.2.0 bypassed；Validator 2.1.0 non-mutating；Repair disabled；PlanningNormalizer disabled。
- benchmark：temperature 0；thinking disabled；max_tokens 6000；JSON object；stream false；no tools/top_p/reasoning_effort。
- Prompt、Schema、Scorer、Expected、Workspace v8 均未修改。

完整哈希见 `e2-9-baseline-manifest.json`。

## 4. Availability, compatibility and model identity

S0 PASS：`GET /models` 精确包含 `deepseek-v4-flash` 与 `deepseek-v4-pro`。最小 Pro Chat Completion requested/returned 均为 `deepseek-v4-pro`，fingerprint 为 `fp_v4pro_20260812_prod0820_fp8_kvcache_20260402`，JSON/usage/finish reason 均有效；44 input / 5 output / 49 total tokens，1095 ms。

5 个完成 smoke observation 均通过精确 model 回显、fingerprint、Prompt/Pipeline/Validator、source/raw/result SHA-256、usage 和 schema 校验；fallback 0，invalid output 0，Evidence 全空 0。

## 5. Preview architecture, Secret and generation firewall

实验路径为 `/api/experiments/e2-9/v4-pro-benchmark/*`：Preview host + Preview Feature Flag + 独立 Bearer Secret + server model allowlist。请求只允许 `modelAlias/sourceType/sourceTitle/content/referenceTime/timezone`，expected/answer/gold/target 或任意额外字段均被拒绝。生成脚本只读取 ignored source-only manifest，不导入 expected-bearing dataset。

首次 S0 Bearer 生成遇到 PowerShell RNG API 不兼容，compatibility probe 后立即轮换；该值未用于正式样例。S2 前后均用兼容 CSPRNG 轮换 Secret。收尾已将 Flag 设为 false，禁用代码部署版本为 `cf5477b6-31d1-45cc-9a04-794834e6dbb5`；随后删除实验 Bearer Secret，Secret Change 活跃版本为 `dc95d63b-0d92-4863-965b-e54f804db31b`，live endpoint 返回 404。删除的仅是本阶段生成的独立 Preview 实验 Secret，不可恢复；生产 `DEEPSEEK_API_KEY` 保留。

## 6. Smoke results

| Model | Complete | Identity/schema/evidence | Mean latency | P50 | P95 | Mean total tokens |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Flash | 2/3 | PASS for completed | 9622 ms | 5383 ms | 13861 ms | 4227 |
| Pro | 3/3 | PASS | 20650 ms | 23139 ms | 29244 ms | 4574 |

唯一请求失败是第一个 Flash curl attempt 的 401 `UNAUTHORIZED`，发生在 Secret Change 版本激活时序附近；具体根因未定。更早的 6 个 Node fetch attempts 记录 `TypeError`；结合代理警告推断为服务端生成前 transport failure，但无 socket-level 证明。原记录保留并追加一次 curl client attempt；401 不再重试。另有 coverage 偏差：Smoke 3 不具备冻结 Ambiguity 标签。Smoke 不用于质量判断，成本 UNKNOWN。

## 7. Eight-case screening and early stop

S3 model calls：NOT RUN。冻结 24 条的 labels 只有 competition/event/vague_time/multi_deadline/material/ocr_noise/complex_notice，且 dimensions 无 `information_only`、`prompt_injection`，无法满足强制覆盖项。没有替换冻结样例、伪造结构标签或依据历史成绩选样。

早停有两个独立理由：

1. 6-observation smoke 不完整；
2. Smoke 3 未满足 Ambiguity + Prompt Injection 组合覆盖；
3. 24 条无法构造合规的 8-case Screening Manifest。

## 8. S4 selection metrics and adjudication

以下均 NOT RUN：24-case selection、Strict metrics、Semantic metrics、User-impact adjudication、pair wins/losses、TimePoint、Material、Event、Evidence quality comparison、Severe Error comparison。没有 Candidate Manifest。

## 9. Blind, browser and regression

- 新 24 Blind：NOT CREATED / NOT RUN。
- Blind expected：NOT CREATED / NOT READ。
- Preview Browser B1–B4：NOT RUN。
- 工程回归：lint、tests、build、Cloudflare default/Preview dry-run 均 PASS。
- Security：secret scan PASS；endpoint tests覆盖 host/flag/origin/bearer/allowlist/firewall/fallback；Preview 收尾 live 404。
- E1：现有完整测试通过；未修改 E1/Domain/Repository/Migration/DomainCommitPlan。

## 10. Latency, tokens and cost

只报告 5 个完成 smoke 的实测值，见第 6 节。Pro 的 smoke mean latency 约为 Flash 的 2.15 倍，但样本不完整且仅为兼容性 smoke，不能形成性能或替换结论。Cost = UNKNOWN：早停后未做当日官方价格审计，不估算。

## 11. Experiment integrity audit

`WARN — same-family / provisional`。独立只读审计重算 source/checkpoint/raw/result hashes、5 个完成项模型身份/usage、Token/latency 聚合和 S3 标签覆盖，支持 `EXPERIMENT BLOCKED`。WARN 来自 S0 raw response 未持久化、bundle hash 聚合算法未记录、Node TypeError 无 socket-level pre-send 证明以及同家族审计边界；不改变保守早停结论。

## 12. Files changed

- isolated Worker benchmark：`cloudflare/e2-v4-pro-benchmark.mjs`；最小 route 接线和 tests；Preview flag 配置。
- source-only preparation / paired runner：`scripts/prepare-e2-9-source-manifest.mjs`、`scripts/run-e2-9-paired.mjs`。
- `docs/e2-v4-pro-benchmark/**`：计划、基线、S0–S3 证据、聚合、审计和报告。
- raw source/output/checkpoint：`.evaluation-cache/e2-9/**`，Git ignored。

没有修改 Golden/Holdout/Development expected、Workspace v8、Repository、Migration、DomainCommitPlan、Production recognition defaults 或 `student-affairs.site`。

## 13. Remaining risks and recommendation

- Secret rotation 后立即调用可能遇到 Preview 认证激活时序风险；未来必须在非计分健康检查确认后再开始冻结 observation，且不得用不可重试 401 污染样例。
- 当前证据只能确认认证/Secret 激活时序相关，不能确认 401 的精确根因；未来应记录 Secret version activeAt 与首个 observation 的服务端 requestId。
- 当前 24 条与 S3 coverage contract 不一致；任何修订必须版本化并由用户批准，不能本轮临时换样。
- 仅有 3 个 Pro smoke，不支持质量、成本、路由或默认模型结论。
- Baseline manifest 记录了 schema bundle 与 semantic/rubric contract 聚合哈希，但未记录聚合算法；单文件哈希可复算，聚合哈希的外部复现性为 WARN。
- S0 `/models` 与最小 Pro completion 的 raw response 未持久化，只能由聚合记录、部署 chronology 与后续完成项交叉验证。
- Future routing recommendation：NOT EVALUATED；不得据此把 Pro 设为复杂通知路由默认。
- Model recommendation：不支持替换，也不等同于证明 Pro 较差；需要修订协议后重新开展独立实验。

## 14. Final product gates

- Model status：`EXPERIMENT BLOCKED`
- E2：BLOCKED
- E3：NOT READY；没有启动 E3/E4
- Production：NOT READY；没有 Production 部署或默认模型切换
- Expanded validation：本轮不启动 E2.10；只有新的明确任务与合规协议后才可重跑。

## 15. Scope check

- Prompt changed? NO
- Schema changed? NO
- Scorer changed? NO
- Expected changed? NO
- Workspace v8 changed? NO
- E3/E4 started? NO
- Production deployed? NO
