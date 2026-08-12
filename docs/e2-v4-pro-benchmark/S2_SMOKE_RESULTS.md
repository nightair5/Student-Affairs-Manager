# S2 Smoke Results

## Outcome

FAIL：6 个冻结 observation 中 5 个完成、1 个失败。按 E2.9 提前停止条件，三条完整配对冒烟未全部通过，不能进入正式筛选。

覆盖也存在一项明确偏差：Smoke 3 使用的是 Prompt Injection + trust-boundary 样例，但该 source 没有冻结的 Ambiguity 结构标签，不能宣称完整覆盖“Ambiguity + Prompt Injection”。因此即使没有 401，S2 manifest 仍不足以证明规范要求的组合覆盖。

Pro 本身 3/3 完成，均满足：精确 `response.model=deepseek-v4-pro`、非空 `system_fingerprint`、合法 JSON、RecognitionResult 2.0、Prompt/Pipeline/Validator 版本一致、thinking disabled、usage 可观测、Evidence 非空、无 fallback。

失败项为第一个 Flash observation：Secret Change 版本激活时序附近返回 HTTP 401 `UNAUTHORIZED`。401 被协议列为不可重试，因此没有补跑或替换。后续 5 个 observation 成功；现有证据只支持“与认证/Secret 激活时序相关”，不能证明具体根因，也不能证明失败请求与后续成功请求看到的是同一已激活 Secret 版本。它不是 Pro 模型输出失败，但仍使 S2 整体不完整。

## Transport chronology

初次 Node `fetch` 在当前代理环境下对 6 个 observation 均记录 `TypeError` transport failure。结合代理警告推断失败发生在服务端生成前，但 checkpoint 没有 socket-level 证据，不能把“发送前”表述为已证明事实。原失败完整保留；依据该有界 transport 诊断追加一次 curl client attempt，没有删除原记录。第二次 attempt 产生 5 个成功和 1 个不可重试 401。

- formal observations：6
- client attempts：12（6 个 pre-send transport failure + 6 个 curl attempts）
- observed upstream model completions：5
- raw checkpoint：ignored cache
- checkpoint SHA-256：`2757859f116e83cc87ebcb5c2d333c0bf39e9277ac0e3b9b41aa65bf82aa7834`

## Identity

- Flash fingerprint：`fp_a18b46594c_prod0820_fp8_kvcache_20260402`
- Pro fingerprint：`fp_v4pro_20260812_prod0820_fp8_kvcache_20260402`
- model fallback：0 in completed observations
- invalid JSON/schema：0 in completed observations
- Evidence completely missing：0 in completed observations

## Latency and tokens

这些只是兼容性冒烟，不构成质量或成本结论；Flash 只有 2 个完成 observation，不能作为配对性能估计。

| Model | Complete | Mean latency | P50 | P95 | Mean input | Mean output | Mean total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Flash | 2/3 | 9622 ms | 5383 ms | 13861 ms | 2379 | 1848 | 4227 |
| Pro | 3/3 | 20650 ms | 23139 ms | 29244 ms | 2380.67 | 2193.33 | 4574 |

## Cost

UNKNOWN。本阶段因早停未进行官方当日价格审计，不根据记忆估算。

## Gate

`FAIL_INCOMPLETE_SIX_OBSERVATION_SMOKE_AND_COVERAGE`。不运行 S3 模型调用。
