# E2.9-R5 DeepSeek V4 Pro Screening Report

最终状态：**EXPERIMENT BLOCKED**。模型质量结论：**NOT AVAILABLE**。

## 1. 执行结论

全新 run `e29r5-20260813-c` 严格执行了授权的条件调用链，并且没有越过 32 次上游模型调用上限。

| 阶段 | 观察值 | 完成 | 实际调用 | 重试 | Gate |
|---|---:|---:|---:|---:|---|
| Readiness | 6 | 6 | 6 | 0 | PASS |
| Smoke | 10 | 10 | 10 | 0 | PASS |
| Screening | 16 | 16 | 16 | 0 | PASS |
| 合计 | 32 | 32 | 32 | 0 | — |

32 个 observationId 均预注册且唯一；Flash 与 Pro 各执行 16 次。所有观察值都在第一次尝试完成，没有 fallback、lineage mismatch、覆盖写入或选择性补跑。Screening 后 Ledger 为 `COMPLETE`，阶段停在 `PATH_MASK_PREVIEW_OPEN`。

## 2. 遮蔽盲评

8 对 Screening 输出成功生成 path-masked 包。自动扫描未发现模型名、provider、fingerprint、Token、延迟、request、deployment 或 raw output 泄露。全新只读审阅者在只允许访问 packet、Schema 和 rubric 的边界内确认无法识别 X/Y 对应模型。

审阅同时记录了一项剩余风险：包内 `sideXHash` / `sideYHash` 是确定性哈希；如果审阅者违规取得外部候选输出，理论上可重算关联。该风险未在本次限定输入中形成实际路径识别，但后续协议应把 reviewer-facing 包与完整性承诺进一步分离。

盲评标签在揭盲前完成并提交：X 优 2、Y 优 2、TIE 4；X/Y 的用户影响 Major 均为 0；匿名规划错误为 X 5、Y 6。因为映射没有揭示，这些数字不能归因到 Flash 或 Pro。

## 3. 揭盲完整性失败

冻结的 reveal 脚本在创建 mapping key 之前失败：它对整个标签文档运行模型身份扫描，必填的顶层 `protocolVersion` 值包含 `v4-pro`，从而在 `$.protocolVersion` 触发 `LABEL_LINEAGE_LEAK_DETECTED`。实际 8 条 reviewer 标签未包含模型身份。

这是 Harness 协议完整性缺陷，不是模型质量失败。修复 reveal 脚本会改变已经被 Protocol 3.3.0 bundle 冻结的代码，因此本 run 没有就地修复或绕过：

- mapping key：未创建
- expected：未加载
- strict scoring：NOT RUN
- model quality Gate：NOT RUN
- 映射后的胜负、Major、Planning Error：NOT AVAILABLE
- 失败后模型调用：0

不得使用匿名 X/Y 标签推断 Pro 优于、等于或劣于 Flash。

## 4. Token 与延迟

| 范围 | 模型 | Input Token | Output Token | Total Token | Provider 延迟 | Client 延迟 |
|---|---|---:|---:|---:|---:|---:|
| 全阶段 | Flash | 31,014 | 23,838 | 54,852 | 127,706 ms | 139,959 ms |
| 全阶段 | Pro | 31,014 | 23,185 | 54,199 | 196,429 ms | 210,545 ms |
| Screening | Flash | 19,008 | 15,340 | 34,348 | 80,151 ms | 86,493 ms |
| Screening | Pro | 19,008 | 14,561 | 33,569 | 121,484 ms | 129,434 ms |

这些是实际观测到的性能诊断，不是模型质量证据。

## 5. Preview 与安全清理

- 临时 `E2_R5_BENCHMARK_TOKEN` 已删除；Preview Secret 列表只保留 `DEEPSEEK_API_KEY` 名称，未读取其值。
- 普通 Preview 已恢复 `E2_R5_BENCHMARK_ENABLED=false`，R5 endpoint 实测 HTTP 404。
- 清理后的 Preview 版本：`c7d80efe-1566-4a0a-b7b4-422dc13b1b9f`。
- Production 最新版本仍为 `3b6d6ba2-e21f-495c-80e4-c4bac62366be`（2026-08-08）；本轮未部署 Production。
- 原始响应、checkpoint、ledger 与 packet 保留在 Git ignored cache；packet 内只有未揭盲的 commitments，mapping key 从未创建。Git 只记录匿名聚合和审计证据。

## 6. 状态与下一步

- V4 Pro quality：NOT AVAILABLE
- Selection readiness：NOT READY
- Selection：NOT RUN
- Blind：NOT CREATED
- E2：BLOCKED
- E3：NOT READY
- Production：NOT READY

建议：在新的 protocol 与新的 run 授权下修复 reveal scanner，只扫描 reviewer-authored `labels` 数组，并补充“顶层协议元数据不触发模型泄露规则”的回归测试。不得复用或重新解释本 run 的 observation 来形成模型质量结论，也不得自动进入 Selection、Blind、E3/E4 或 Production。
