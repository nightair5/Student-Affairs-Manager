# S1 Preview-only Endpoint

## Outcome

PASS。实验端点仅部署到 `student-affairs-manager-preview.nightsdell.workers.dev`，未部署 Production。

## Boundary

- Feature Flag：`E2_V4_PRO_BENCHMARK_ENABLED=true` 只存在 Preview env；Production/default 未配置，默认关闭。
- Auth：独立 `E2_V4_PRO_BENCHMARK_TOKEN` Cloudflare Secret；未写入本地文件或 Git。
- Host：hostname 必须包含 `preview`。
- Origin：必须与 Preview endpoint 同源。
- Client model input：只接受 `flash` 或 `pro`；服务端映射为精确模型 ID。
- Generation firewall：只接受 `modelAlias/sourceType/sourceTitle/content/referenceTime/timezone`，任何 `expected/answer/gold/target` 或其他字段均拒绝。
- API：仅 Chat Completions；temperature 0、thinking disabled、JSON object、max_tokens 6000、stream false，不发送 tools、top_p 或 reasoning_effort。
- No fallback：HTTP `response.model` 必须精确等于请求模型，且 `system_fingerprint` 和 usage 必须存在。
- Retry：仅网络/超时/429/502/503 最多一次；429 遵守有界 Retry-After；不替换失败 observation。
- Runtime：Router bypassed、Validator 2.1.0 non-mutating、Repair disabled、PlanningNormalizer disabled。

## Verification

- lint：PASS
- tests：50 Vitest files / 213 tests；Node dataset/baseline 12；server 8；worker 31；functions 5，全部 PASS
- build：PASS
- Cloudflare production/default dry-run：PASS，未部署
- Cloudflare Preview dry-run：PASS
- secret scan：PASS
- live Preview deployment：`780a12fc-47d8-46e6-aad7-cab12f2b386e`
- live S0 compatibility：PASS
- active Preview version after bearer rotation：`383119dd-0c44-434e-8154-bd71b8c066d2`

## Security note

首次 Bearer 生成使用了当前 PowerShell 不支持的静态 RNG API，因此未获得预期随机字节。该 Bearer 只保护了一次无用户数据的 S0 compatibility probe，随后立即用 `RandomNumberGenerator.Create().GetBytes()` 轮换；它不会用于 S2 或后续正式样例。

## Production check

没有运行 `wrangler deploy` 默认环境，没有修改 `student-affairs.site`，没有把实验路径设为生产默认。
