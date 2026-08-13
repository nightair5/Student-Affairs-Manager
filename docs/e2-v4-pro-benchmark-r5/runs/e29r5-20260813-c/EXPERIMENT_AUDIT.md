# E2.9-R5 实验完整性审计

## 审计身份与结论

| 项目 | 结论 |
| --- | --- |
| Run | `e29r5-run-20260813-c` / `e29r5-20260813-c` |
| 审计类型 | **fresh same-family provisional integrity audit** |
| 生成完整性 | **PASS** |
| 揭盲后协议完整性 | **FAIL** |
| 模型质量 | **NOT_AVAILABLE** |
| Overall verdict | **FAIL** |
| Final status | **EXPERIMENT_BLOCKED** |
| 生成时间 | `2026-08-13T16:20:24.9404407Z` |

本结论只评价冻结材料、生成链、盲标链和协议执行完整性。32 次已发生的模型生成在证据层面完整，但揭盲脚本对标签文档的扫描发生协议自身造成的 false positive，且按冻结 stop rule 正确停止。因此实验整体完整性为 `FAIL`，不等于生成失败，也不产生任何 Pro/Flash 质量结论。

审计全程只读：未调用 DeepSeek 或其他模型，未补跑 observation，未执行 Selection、Blind、Production、score 或 gate，未部署、未修改 Secret、未读取 Secret 值。唯一写入是本报告及同目录 `experiment-audit.json`。

## 结论矩阵

| 编号 | 状态 | 独立结论 |
| --- | --- | --- |
| C-01 | **PASS** | 代码、配置、R5 prepare/run/preview/finalize/reveal/score/gate 路径及冻结公共材料与 ignored 原始证据已逐项只读检查；协议把 provider 调用、单次 attempt、ledger reservation/finalization、四向模型 lineage 和 phase stop rule 分离。 |
| C-02 | **PASS** | Run 自哈希、source-only、三 phase manifest、bundle manifest 及五类 bundle 均与独立复算一致。 |
| C-03 | **PASS** | 观察计划为 32 个唯一 observation ID，原始顺序与冻结计划逐项一致：readiness 6、smoke 10、screening 16；Flash 16、Pro 16。 |
| C-04 | **PASS** | 32/32 `complete`，每 observation 恰好 1 个 protocol attempt；无 retry、fallback、overwrite、lineage mismatch。26 个业务 observation 的 `semanticRole`、source/input/result/raw hashes 均匹配；6 个 readiness probe 的空 source/role 符合计划。 |
| C-05 | **PASS** | 三 checkpoint、三 ledger、activation、phase 和 bundle bindings 一致；ledger 记录数按 6→16→32 追加，前序记录保持一致，最终 32 条均为 `COMPLETE`。 |
| C-06 | **PASS** | Token 与 provider/client latency 汇总逐条重算后与现有 screening report 完全一致；这些仅是使用量/性能证据，不是质量证据。 |
| C-07 | **PASS** | packet preview 与正式 packet 字节相同，8 个匿名 pair 的顺序、side hash、commitment 唯一性、manifest bindings 及 packet leak scan 均一致。 |
| C-08 | **PASS** | Labels 创建时间晚于 preview/review/formal-open；labels array hash 为 `7acb98fe…05e2b`，8 项唯一，匿名计数 `X=2/Y=2/TIE=4/INSUFFICIENT_INFORMATION=0`；只扫描 labels 数组时泄露数为 0。 |
| F-01 | **FAIL** | `reveal-e2-9-r5-adjudication.mjs` 在写 mapping key 之前对整个 labels 文档调用 `scanPathMaskedPacket(labels)`；文档必填值 `$.protocolVersion = e2-9-v4-pro-protocol-3.3.0` 命中通用 `FORBIDDEN_VALUE`。复算得到唯一失败路径正是 `$.protocolVersion`，属于协议 false positive，但不能绕过冻结协议。 |
| C-09 | **PASS** | stop rule 被遵守：`private/mapping-key.json` 未创建；`path-masked-result.json`、`screening-aggregate.json`、`screening-gate.json` 均缺席；expected/scoring/gate 未运行。 |
| W-01 | **WARN** | 冻结 `promptSha256=c925f1dc…e6fd` 是 `recognition-prompt.mjs` 整个源文件经 LF 规范化后的 hash，不是 `recognitionSystemPrompt()` 运行时字符串 hash；后者为 `382fa23a…150e`。代码与 bundle 未漂移，但现有字段名及“Prompt canonical”措辞不够精确，而且响应只是回显常量，不能单独证明运行时 prompt bytes。 |
| W-02 | **WARN** | `scan-secrets.mjs` 的 assigned-secret 规则未覆盖 `E2_R5_BENCHMARK_TOKEN` 与 `E2_R5_PATH_MASK_REVEAL_SECRET`。现有 scanner 仍通过，另行只读字面赋值扫描在 564 个候选文本文件中命中 0 个文件，但正式 scanner 覆盖缺口仍存在。 |
| W-03 | **RESOLVED** | 原 `SCREENING_REPORT.md` 的“未揭盲映射材料均保留”可能被理解为 mapping key 已存在；执行侧现已明确改为 packet/commitments 保留而 mapping key 从未创建。刷新后的报告 raw SHA-256 为 `d697c2ae…bc3b8bc3`；数值、标签计数、核心 hash 与阻断状态仍无算术错误。 |
| W-04 | **WARN** | path-mask 报告已正确披露 deterministic side hash/输出形状仍可能带来残余关联风险；本审计确认扫描器未发现显式模型/路径泄露，但不能把此工程检查等同于完美盲法。 |
| L-01 | **NOT_VERIFIED** | 无 reveal secret 与 mapping key，故只能验证 8 个 commitment 的格式/唯一性，不能独立恢复 X/Y→模型映射或验证 commitment 身份。此缺失是 stop rule 的预期结果。 |
| Q-01 | **NOT_AVAILABLE** | 未揭盲、未生成 expected/scored/aggregate/gate 材料；禁止从匿名偏好、规划分或 latency/token 反推 Pro/Flash 优劣。 |

## 独立复算摘要

### 冻结 hash 链

| 对象 | 复算 SHA-256 | 状态 |
| --- | --- | --- |
| Run manifest 原始文件 | `5b28ef69099199865259089c08e0b28785905dea69ee6ed516f3e024657d6a46` | PASS |
| Run canonical self-hash | `5511e58b7754480caa97d47548289b6e67459e47d5e32dd7d2fd2b6af1656a0e` | PASS |
| Source-only canonical | `5a83d7c4da7378c0caf7088f1b6e0bb5a113492f80dab152b7214ca71106d0a1` | PASS |
| Readiness manifest canonical | `b620bf447c2c17ffb02a1a79ab2723d3deaca544c7d947c0401e6c752c075869` | PASS |
| Smoke manifest canonical | `211e8a015fed364509d3311b06e1de7f761fc286216f9e9c2635dbfe65a2191d` | PASS |
| Screening manifest canonical | `869a495b587c15f1e73a8aad161bf69bced8c247385963a5759238cb4b1d63e8` | PASS |
| Bundle manifest canonical | `559f905cfa3605d9b39822495bd0c7c0fbd2816bbc67ccaeb67fea382e826618` | PASS |
| Schema bundle（2 files） | `bb78d92662e5039668f0f739074c83402500cda6170aa231b30ae26b6e58857f` | PASS |
| Prompt/pipeline bundle（4 files） | `b23ea83ab214e3f0c74a7fcfb8f7806f512cb86f2130ab3ca185fbdee3e48be8` | PASS |
| Scorer semantics bundle（3 files） | `b548468400d0a8917215caa6e4040402cde1d80873f821cf569bbaed1c78a56a` | PASS |
| Dataset bundle（3 files） | `acc4c4784eb1c80263bd64625cef98c2bbc25f09448069d5629c8df3292e086b` | PASS |
| Protocol/deployment bundle（50 files） | `ef6962b903da41f1131d92c7752b0112111e9a1dd848693d9a2e1798872e6501` | PASS |

Source-only 含 13 条 source record、10 个唯一 case；source/input hashes 全部匹配，未含 expected/gold/score/labels/mapping-key 路径或字段。五个 bundle 的 entry path、entry hash、byte length 与 aggregate 均逐项一致。

### 生成、lineage 与 ledger

- **PASS** — 32 个 observation ID 及顺序均由冻结 seed/plan 独立复现；完整有序列表写入 `experiment-audit.json`。
- **PASS** — 四向 lineage（requested model、returned model、execution model、result metadata model）在全部 32 条记录中与 alias 一致。
- **PASS** — 所有记录的 deployment version 均为 `580d151b-9be5-4c26-8ce6-2405629c9827`。
- **PASS** — 32 个 response/body/output/result 哈希可复算且无覆盖；32 个 attempt 均为 attempt 1。
- **PASS** — activation 证据顺序为 ledger `15:32:50Z` → disabled code `15:33:19Z` → Secret change `15:34:56Z` → enabled main `15:35:19Z`；run/protocol/source、`featureEnabled=true`、`productionUnchanged=true` 均绑定。

### 使用量与耗时

| 范围 | 模型别名 | Input | Output | Total | Provider ms | Client ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 全部 32 observations | Flash | 31,014 | 23,838 | 54,852 | 127,706 | 139,959 |
| 全部 32 observations | Pro | 31,014 | 23,185 | 54,199 | 196,429 | 210,545 |
| Screening 16 observations | Flash | 19,008 | 15,340 | 34,348 | 80,151 | 86,493 |
| Screening 16 observations | Pro | 19,008 | 14,561 | 33,569 | 121,484 | 129,434 |

上述算术为 **PASS**，但质量含义为 **NOT_AVAILABLE**。

## 盲标、揭盲失败与缺席材料

Packet preview 与 formal packet 的原始 SHA-256 均为 `1cb3b0e4d50ef25ad178b608d9c79cef0cc6639d895cd0d6abe455d4e011dd03`，且字节完全相同。Labels 原始文件 SHA-256 为 `14444c13c289345cdd1dfe78552f0a8363fc7f8895b5fe069df9017cd594143b`；只对 `labels` 数组 canonicalize 后为 `7acb98fe74f7ab9326b9ff155f0390802a088e061c1ca2a37b515ab349605e2b`。

揭盲失败复算：

```text
scan target: whole labels document
leak count: 1
path: $.protocolVersion
category: FORBIDDEN_VALUE
value category: frozen protocol identifier (no secret value)
```

对 `labels` 数组本身执行同一扫描器，leak count 为 0。失败发生在 mapping key 写入语句之前。因此 `protocol-failure.json` 对失败原因的记录准确，且后续材料缺席证明 stop rule 被遵守；这仍然是协议完整性 `FAIL`，不能以“已知 false positive”为由补写 key 或继续 scoring。

## Cloudflare 实时只读快照

检查于本审计会话完成，网络可用：

- **PASS** — Preview Secret 名称集合仅为 `{DEEPSEEK_API_KEY}`，计数 1；未读取任何 Secret 值，临时 bearer 名称已缺席。
- **PASS** — Preview 最新 deployment version 为 `c7d80efe-1566-4a0a-b7b4-422dc13b1b9f`（`2026-08-13T15:47:43Z`），`E2_R5_BENCHMARK_ENABLED=false`。
- **PASS** — Preview `/api/experiments/e2-9/r5/benchmark/generate` 的未授权 GET 返回 HTTP 404。
- **PASS** — Production 最新 deployment version 仍为 `3b6d6ba2-e21f-495c-80e4-c4bac62366be`（`2026-08-08T08:55:40Z`），未发现 R5 Production deployment。
- **WARN** — Production 同路径由旧版静态 SPA fallback 返回 HTTP 200 HTML；因此“R5 endpoint 应 404”的实时断言仅适用于 Preview cleanup，Production 未上线 R5 的证据来自 deployment history/version，而不是该 HTTP 状态。

Cloudflare 状态是时间点快照，不保证未来不变化。

## 只读验证

- **PASS** — `node --test scripts/e2-9-r5-path-mask.node.mjs scripts/e2-9-r5-protocol.node.mjs cloudflare/e2-r5-tests.mjs`：56/56。
- **PASS** — `node scripts/e2-9-r5-entrypoint-preflight.mjs`：5/5 entrypoints。
- **PASS** — `node scripts/verify-e2-9-r5-activation.mjs --run=e29r5-20260813-c`。
- **PASS** — `npm run security:scan`：581 个扫描对象，0 命中；受 W-02 覆盖缺口限制。
- **NOT_VERIFIED** — 本轮未重跑 lint/build/npm audit，也未重跑任何会触发模型、observation、reveal、score 或 gate 的命令；现有报告对这些历史执行的陈述不作为本审计的新鲜运行证据。

## 限制与处置边界

1. 本审计为同模型家族的 fresh review，故验收级别仅为 **same-family provisional**，不是 cross-family acceptance。
2. `experiment-audit` skill 的 `shared-references/` 依赖在本机技能目录缺席；已按其核心完整性、双证据与 same-family/provisional 规则执行，并在 JSON 中记录限制。
3. 未持有 reveal secret，且 mapping key 按 stop rule 不存在，所以无法验证匿名 side 的真实模型身份；这不是授权继续揭盲的理由。
4. 本审计验证生成证据链、盲标链、算术和部署隔离，不验证模型输出质量、文化有效性或产品验收。
5. 本审计未修改 screening report；执行侧随后修正了 W-03 措辞，本轮仅刷新其输入 hash 并将 W-03 标记为已解决。W-01 的 prompt hash 语义警告仍存在。

**最终判定：生成完整性 PASS；揭盲后协议完整性 FAIL；模型质量 NOT_AVAILABLE；Overall FAIL；EXPERIMENT_BLOCKED。**
