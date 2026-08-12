# S0 Baseline Freeze & Version Reconciliation

## Goal

冻结 E2.9 的唯一变量：`deepseek-v4-flash` 与 `deepseek-v4-pro` 的 model ID。模型可用性将在 Preview-only 服务端端点部署后完成验证。

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

S0 尚未创建或读取任何 Secret，没有模型调用，没有 Production 部署。未来 availability 只通过 Preview server Secret 完成。

## Scope check

- Prompt changed? NO
- Schema changed? NO
- Scorer changed? NO
- Expected changed? NO
- Workspace v8 changed? NO
- E3/E4 started? NO
- Production deployed? NO

## Next Gate

实现 S1 Preview-only endpoint，通过 `/models` 与最小 Pro completion 验证 availability 和模型身份；失败立即输出 `V4_PRO_NOT_AVAILABLE` 或 `V4_PRO_SMOKE_FAILED`。
