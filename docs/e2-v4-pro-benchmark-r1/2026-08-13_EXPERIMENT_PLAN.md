# E2.9-R1 V4 Pro Protocol Repair 实验计划

日期：2026-08-13  
协议：`e2-9-v4-pro-reduced-protocol-2.0.0`  
基线：`b2ea4a4b27bf543f77a3c3a9cd5439b92a950720` / `v2-e2-9-protocol-blocked`

## Claim Map

| Claim | 最小可信证据 | 对应阶段 |
| --- | --- | --- |
| C1：只替换为 `deepseek-v4-pro` 能在复杂通知上产生足够大的质量收益 | 8-case Screening v2 通过；24-case Selection v2 至少命中一项主要收益且全部保护门槛通过；如继续 Blind，仅支持 small-sample candidate | S3–S6 |
| C2：观察到的差异只来自 modelName | 两臂 Prompt/Schema/Pipeline/参数/输入/评分 bundle 一致，response.model 精确、fallback=0，生成期不读取 expected，独立审计可复算 | S0–S8 |
| Anti-claim：结果来自认证污染、选择性重跑或不可复算 hash | 6 个 non-scored readiness 连续通过；正式 observation 单次上游调用；失败原样保留；bundle 算法和原始 S0 证据可复算 | S0–S8 |

## 冻结变量

- Prompt `recognition-2.4.1`；Schema `2.0`；Pipeline `recognition-pipeline-2.2.1`。
- Router bypass；Validator `recognition-quality-2.1.0` non-mutating；Repair/PlanningNormalizer disabled。
- temperature 0；thinking disabled；max_tokens 6000；JSON object；stream false；tools/top_p/reasoning_effort unset。
- Scorer、Semantic Equivalence Contract、User-impact/Severe rubrics、既有 Expected、Workspace v8、Repository、Migration、DomainCommitPlan 全部冻结。
- 唯一识别变量为 `modelName`：Flash 与 Pro。

## 阶段与调用预算

| 阶段 | 内容 | 上游 completion 上限 | Gate |
| --- | --- | ---: | --- |
| Auth readiness | Flash 3 + Pro 3，无用户内容 | 6 | 任一非 200/身份不一致：`AUTH_READINESS_FAILED` |
| S0 raw evidence | `/models` + Flash minimal + Pro minimal | 2 completion + 1 models request | 原始响应、header、身份、usage、hash 全部落 ignored cache |
| Smoke v2 | 5 条 × 2 | 10 | 任一认证、身份、JSON/Schema、安全或关键空输出失败：`SMOKE_V2_FAILED` |
| Screening v2 | 8 条 × 2 | 16 | Screening Gate 不通过即 `V4_PRO_SCREENING_V2_FAIL` |
| Selection v2 remainder | 16 条 × 2；保留 Screening 结果 | 32 | Selection Gate 不通过即 `V4_PRO_SELECTION_V2_FAIL` |
| New Blind | 24 条 × 2，仅 Candidate Freeze 后创建 | 48 | 即使通过也仅 `MODEL CANDIDATE PROMISING — SMALL SAMPLE` |

最大 completion 为 114（6 readiness + 2 S0 + 10 smoke + 16 screening + 32 selection remainder + 48 blind），另有 1 次 `/models` 请求。后续阶段不是预先承诺；每个 Gate 都可提前停止。

## 预冻结样例

- Smoke v2：5 条，分别覆盖多 Task/Material、多 TimePoint/Event、relative/vague+Ambiguity、pure-information、Prompt Injection。
- Screening v2：8 条 Exposed Screening，覆盖协议要求的八个结构维度。
- Selection v2：24 条 Exposed Selection；前 8 条由 Screening 复用、不重跑；无重复文本。
- 选样只使用冻结结构标签和来源集合，不读取模型历史分数。

## 隔离与审计

- 生成脚本只读 `.evaluation-cache/e2-9-r1/protocol-2.0.0/source-only-manifest.json`，禁止 expected/answer/gold/label/score 字段。
- expected 只在一阶段全部生成结束后由评分器加载。
- X/Y 人审 packet 不含 model、caseId、运行顺序、strict score 或 expected；labels 提交后才生成 reveal key。
- 原始请求/响应/checkpoint/packet 放 Git ignored cache；只提交匿名 manifest、聚合和审计。
- 独立审计为 fresh same-family provisional；不得据此宣称完全独立。

## Bundle Hash Contract

- UTF-8；路径统一 `/` 后按 JavaScript UTF-16 code-unit 升序。
- 文本 CRLF/CR 统一为 LF；JSON 递归排序对象 key，数组保序，无无意义空白。
- 每项 framing：`<pathUtf8Bytes>:<path>\n<contentUtf8Bytes>:<canonicalContent>`。
- 项目之间使用固定分隔符 `\n--E2-9-R1-BUNDLE-ENTRY--\n`；最终 SHA-256。
- 输入文件、单文件 canonical hash、字节数和 bundle hash 全部记录在 `bundle-hash-manifest.json`。

## STOP 边界

不得修改 main、Production、`student-affairs.site`、生产默认模型或正式 Capture/Commit 链路；不得进入 E3/E4。任何早停状态都必须完成 Preview Flag=false、endpoint 404、实验 bearer 删除/轮换、Secret 扫描和审计后 STOP。
