# S0 Baseline Freeze & Version Reconciliation

## Goal

冻结 E2.9 的唯一变量：`deepseek-v4-flash` 与 `deepseek-v4-pro` 的 model ID。模型可用性已通过 Preview-only 服务端端点验证。

## Git baseline

- Branch：`codex/e2-9-v4-pro-small-benchmark`
- Commit：`9c86661e9320a182f3043115cd50389514a508f6`
- Tag：`v2-e2-7-blocked`
- 起始工作树：clean

## BASELINE VERSION RECONCILIATION

E2.7 manifest 描述的是较早提交 `70dd976`，其中 Router 为 1.1.0。当前冻结 HEAD 的实际 Cloudflare 默认代码为：

- Model：`deepseek-v4-flash`
- Prompt：`recognition-2.4.1`
- Schema：`RecognitionResult 2.0`
- Pipeline：`recognition-pipeline-2.2.1`
- Router：`recognition-router-1.2.0`
- Validator：`recognition-quality-2.1.0`
- Repair：`recognition-repair-1.1.0`

E2.7 本地 Validator 2.2.0 和 PlanningNormalizer 1.0.0 是诊断原型，不在默认 Cloudflare recognition 路径中，本实验不会静默接入。

Production Path A 的真实 max_tokens 是 6000、temperature 是 0.1，而不是规范中的预计 8192。E2.9 按明确实验协议将两臂 temperature 同时冻结为 0，max_tokens 使用代码真实值 6000。Router 绕开、Repair 关闭、Normalizer 不接入，Validator 只做非变更检查，因此每 observation 只有一次模型调用。

## Dataset/hash

Golden 110、Exposed Holdout 40、Development 108 和复杂 Selection 24 均保持冻结。完整 canonical LF SHA-256、Prompt/Schema/Scorer/Router/Validator/Repair/ModelGateway 哈希见 `e2-9-baseline-manifest.json`。

## Security boundary

S0 只通过 Cloudflare Preview server Secret 调用 DeepSeek；没有 Secret 写入本地文件、日志或 Git，没有 Production 部署。首次 PowerShell 随机数 API 不兼容，导致新建 Bearer 未获得预期随机字节，但无用户数据 compatibility probe 已成功；发现后立即用兼容的 CSPRNG API 轮换 Secret。该首次 Bearer 不用于后续正式样例调用。

## Availability result

- Preview code deployment：`780a12fc-47d8-46e6-aad7-cab12f2b386e`
- Active version after Secret rotation：`383119dd-0c44-434e-8154-bd71b8c066d2`
- `GET /models`：同时包含精确 ID `deepseek-v4-flash`、`deepseek-v4-pro`
- 最小 Pro completion requested/returned model：`deepseek-v4-pro` / `deepseek-v4-pro`
- `system_fingerprint`：`fp_v4pro_20260812_prod0820_fp8_kvcache_20260402`
- JSON object：valid
- finish reason：`stop`
- usage：input 44 / output 5 / total 49
- latency：1095 ms；attempts：1
- raw output SHA-256：`4062edaf750fb8074e7e83e0c9028c94e32468a8b6f1614774328ef045150f93`
- S0 gate：PASS

## Scope check

- Prompt changed? NO
- Schema changed? NO
- Scorer changed? NO
- Expected changed? NO
- Workspace v8 changed? NO
- E3/E4 started? NO
- Production deployed? NO

## Next Gate

执行 S2 三条配对冒烟；任一模型身份、JSON、Schema、Evidence、fallback 或安全边界失败即停止。
