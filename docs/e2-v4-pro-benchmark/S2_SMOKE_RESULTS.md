# S2 Smoke Results

## Outcome

FAIL：6 个冻结 observation 中 5 个完成、1 个失败。按 E2.9 提前停止条件，三条完整配对冒烟未全部通过，不能进入正式筛选。

Pro 本身 3/3 完成，均满足：精确 `response.model=deepseek-v4-pro`、非空 `system_fingerprint`、合法 JSON、RecognitionResult 2.0、Prompt/Pipeline/Validator 版本一致、thinking disabled、usage 可观测、Evidence 非空、无 fallback。

失败项为第一个 Flash observation：Secret 刚轮换后返回 HTTP 401 `UNAUTHORIZED`。401 被协议列为不可重试，因此没有补跑或替换。后续 5 个 observation 使用同一轮换 Secret 成功，说明这是 Preview Secret 生效时序问题，不是 Pro 模型失败；但它仍使 S2 整体不完整。

## Transport chronology

初次 Node `fetch` 在当前代理环境下对 6 个 observation 均发生发送前 transport failure。原失败完整保留；依据协议允许对发送前 TLS/transport failure 重试一次，随后用 curl transport 追加第二次 client attempt。没有删除原记录。第二次 attempt 产生 5 个成功和 1 个不可重试 401。

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

`FAIL_INCOMPLETE_SIX_OBSERVATION_SMOKE`。不运行 S3 模型调用。
