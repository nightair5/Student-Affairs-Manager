# E2-MM 多模态实验完整性审查

**审查日期**：2026-08-31（Asia/Shanghai）
**审查对象**：`codex/e2-multimodal-recognition-exp`，审查起点 `607c2a2efabac37933b01fbd5d99f5b8c80afdca`
**审查方式**：fresh `gpt-5.6-sol` ultra 对抗性只读复核 + 独立确定性哈希/聚合重算
**独立性**：same-family，结论为 provisional，不冒充外部独立审计
**审查技能**：`experiment-audit`

## Overall Verdict: FAIL

本实验**未通过实验完整性审查**。`FAIL` 不表示现有上线结论过于保守；相反，结果报告中的 **DO NOT LAUNCH 是正确且必须继续保持的结论**。失败的是实验本身尚不能形成可接受的性能证据：21 次留存观测全部是请求失败、有效预测为 0；评分器仍存在真空高分反例；I 臂只在上游模型消息层面排除了 OCR，而没有在 HTTP/Worker/后处理全链路隔离；冻结时间与逐例清单不完全自洽；失败分类、配对推断、结果 Git 绑定和浏览器 A–J 均未闭合。

该结论不授权修改稳定模型、合并 `release/v2-beta`、移动 RC tag、重部署 RC.4 或 Production。审查没有修改产品代码、计划、冻结清单、结果文件或原始缓存。

## 最高影响发现

### F1 — 没有任何性能或用户收益证据（阻断）

三个留存 Run 合计 21 次请求，完成预测为 0；正式 36 × 3 质量运行不存在。当前报告把质量指标写为不可计算，并明确不能推断任一臂更优，这一部分是诚实的。证据：`2026-08-31_EXPERIMENT_RESULT.md:21-31`、`SYNTHETIC_UNSEEN_V1_RUN_RESULT.json:32-72`、`.aris/traces/experiment-audit/2026-08-31-e2-mm-audit.md:68-74`。

### F2 — 空完成输出仍可获得真空高分（阻断）

`safeF1(0,0,0)` 返回 Precision/Recall/F1 全为 1；聚合层在完成输出没有任何 evidence 时也把 `evidenceValidity` 设为 1。于是一个 truthy 的空结果在无动作样本上可获得实体 F1=1、Complete Case=1、Correction Operations=0、Evidence Validity=1。现有测试只覆盖“所有请求失败时聚合为 null”，没有覆盖“请求成功但结构为空”。证据：`scripts/multimodal-evaluation-lib.mjs:59-63`、`:94-124`、`:141-170`；`scripts/multimodal-evaluation-lib.node-test.mjs:25-64`。Smoke A 的历史 summary 已真实留下“完成数 0 但得分 1”的陈旧产物；当前报告没有采用它，但它证明缓存不能被笼统称为全量一致，见 `.evaluation-cache/multimodal-unseen-v1/runs/synthetic-unseen-v1-smoke-20260831a.summary.json:10-13` 与 trace `:68-74`。

### F3 — I 臂不是端到端 image-only（阻断）

Runner 在分臂前统一把冻结 OCR 写入 `content`，所以 I 臂 HTTP 请求体仍包含 hidden OCR；Worker 的确没有把 OCR 拼入 I 臂上游模型消息，但随后用同一 OCR 执行 normalization/evidence 过滤。故可支持的表述只有“**上游模型消息未含 OCR**”，不能表述为“端到端图片版不接触 OCR”。证据：`scripts/run-multimodal-evaluation.mjs:167-193`；`cloudflare/worker.mjs:837-856`、`:896-914`；`cloudflare/worker-tests.mjs:252-321`。这也与日期计划对 I 臂“不提供 OCR 正文”的宽泛表述存在边界差异，见 `2026-08-31_EXPERIMENT_PLAN.md:24-30`。

### F4 — 冻结证据不是完全自洽的 pre-call freeze（阻断）

冻结文件字节已在 `6bbf510`（01:40:34+08:00）提交，早于最早留存 checkpoint（01:41:18.918+08:00），因此“早于最早留存请求”有本地证据。但清单的 `frozenAt` 为 01:26:30，而 OCR bundle 在约 01:33:49 才生成；`mmu1-23.sourceSha256` 还少了一个字符。Runner 只比较顶层 dataset/OCR digest，没有逐条对照 freeze manifest，所以未发现该错项。证据：`SYNTHETIC_UNSEEN_V1_FREEZE.json:4`、`:80`；`.evaluation-cache/multimodal-unseen-v1/ocr.json:5`；`scripts/run-multimodal-evaluation.mjs:241-256`；trace `:48-64`。此外 scorer/runner 在 Smoke A 后的 `c6ae34e` 才修订，三次运行并非同一最终实现，见 trace `:51-53`。

### F5 — 请求失败、模型输出错误和语义错误没有完整分离（阻断）

Runner 把非 2xx、缺少 `payload.result`、上游鉴权、Worker 的 invalid-response/schema 失败都收敛为 `request_failure`；成功但语义错误才会进入实体评分。预注册的 Transport Failure、Invalid Output、Severe Error、无依据事实数因此不能逐类从 scorer 汇总得到。Checkpoint resume 又把所有既有 observation（包括失败）视为已完成并跳过；这能防止隐藏重试，却没有显式的 retryable/final 失败政策。证据：`scripts/run-multimodal-evaluation.mjs:195-239`、`:268-297`；`scripts/multimodal-evaluation-lib.mjs:105-124`；计划要求见 `2026-08-31_EXPERIMENT_PLAN.md:47-52`。

### F6 — 最终结果存在但尚未形成耐久证据链（重大限制）

Markdown 结果、机器结果、三个 checkpoint 与三个 summary 均真实存在；逐项重算确认当前报告的 0 完成、失败码、顶层哈希与 CER 一致。但审查起点下最终 Markdown/JSON 仍是 untracked，原始 checkpoint 仅在 ignored cache；Smoke A summary 又是旧 scorer 产物。因此结果尚未由 commit 绑定，不能作为可复现发布证据。证据：`.gitignore:15`、`MANIFEST.md:9-12`、trace `:30-37`、`:68-74`。

### F7 — A–J 和 live release 隔离证据未闭合（阻断）

验收清单中 E 为 `FAIL`，其余 A–D、F–J 为 `NOT RUN`；文件本身也正确声明静态检查、Mock 和 HTTP 200 不能替代真实浏览器证据。独立 Worker 配置确实使用独立名、workers.dev 与空 routes，但本审查未取得 Cloudflare control-plane 或 provider 日志的新鲜外部证据；仓库正式 release report 仍停在 RC.2。证据：`PRIVACY_SECURITY_BROWSER_ACCEPTANCE.md:3-16`、`:28-41`；`wrangler.jsonc:65-75`；`docs/release/v2-beta/FINAL_RELEASE_REPORT.md:3-13`。

## A–O 逐项审查

| 检查 | 状态 | 证据与判断 |
|---|---|---|
| A. Ground truth provenance | PASS_WITH_LIMITATIONS | `expected` 与源文本由同一作者编写的确定性模板同时生成，不是模型输出：`scripts/generate-multimodal-unseen.py:50-230`、`:320-390`。但没有独立标注者、双人复核、corrections log 或外部数据权威链；只能归类为 `synthetic_proxy`。 |
| B. Freeze before calls | FAIL | 文件提交早于最早留存 checkpoint，但声明冻结时间早于 OCR 生成，`mmu1-23` 逐例 hash 错，且无 provider ledger 证明不存在更早调用：`SYNTHETIC_UNSEEN_V1_FREEZE.json:4,80`；`scripts/run-multimodal-evaluation.mjs:241-256`；trace `:48-64`。 |
| C. T/I/IT actual isolation | FAIL | T 与 IT 使用相同 OCR 的代码路径清晰，但 I 的 HTTP body 仍含 OCR，且 OCR 参与 Worker 后处理：`scripts/run-multimodal-evaluation.mjs:167-193`；`cloudflare/worker.mjs:837-856,896-914`。 |
| D. Expected / hidden-OCR leakage to model | PASS_WITH_LIMITATIONS | 未在 inspected request construction/checkpoint 中发现 expected；I 上游 prompt 不含 OCR，并有 marker test：`cloudflare/worker.mjs:847-890`；`cloudflare/worker-tests.mjs:252-321`。但 hidden OCR 到达 Worker 且参与后处理，且无 provider-side log 可独立证明实际发送字节。 |
| E. Empty completion scoring | FAIL | `safeF1` 与 empty evidence 都存在真空 1 分：`scripts/multimodal-evaluation-lib.mjs:59-63,141-170`；现有测试只覆盖 all-request-failed：`scripts/multimodal-evaluation-lib.node-test.mjs:57-64`。 |
| F. Failure taxonomy | FAIL | 非 2xx/缺 result/鉴权/schema 输出错误被统一压为 `request_failure`；失败 checkpoint 被 resume 直接跳过：`scripts/run-multimodal-evaluation.mjs:195-239,268-297`。 |
| G. Paired statistics | PASS_WITH_LIMITATIONS | Bootstrap 的确按 case 配对并保留数值为 0 的差值：`scripts/multimodal-evaluation-lib.mjs:186-201`。但只在两臂都 completed 时成对，非对称失败被排除；36 例本质上是 12 个 scenario 在三介质上的派生，未按 scenario cluster 重采样；多指标 multiplicity 未预注册：`scripts/generate-multimodal-unseen.py:330-369`。当前未实际做显著性主张。 |
| H. Human modification time | PASS | 报告和机器结果都明确 `NOT_RUN`，并把增删改操作数限定为 proxy，未冒充秒数：`2026-08-31_EXPERIMENT_RESULT.md:29-31`；`SYNTHETIC_UNSEEN_V1_RUN_RESULT.json:69-72`；`scripts/multimodal-evaluation-lib.mjs:165-170,221-224`。 |
| I. Result/checkpoint consistency | PASS_WITH_LIMITATIONS | 文件真实存在；顶层 dataset/OCR hash、36 例计数、CER、三次失败数与失败码重算一致：`2026-08-31_EXPERIMENT_RESULT.md:9-27`；`SYNTHETIC_UNSEEN_V1_RUN_RESULT.json:14-67`；trace `:56-74`。限制为一条 freeze hash 错、Smoke A summary 陈旧、最终结果未提交。 |
| J. Runtime/dead code | PASS_WITH_LIMITATIONS | CLI package entry 调用 runner，runner 引用 scorer；Worker route 可达，UI IT path 也调用该 endpoint：`package.json:22-26`；`scripts/run-multimodal-evaluation.mjs:5,195-206`；`cloudflare/worker.mjs:994-1007`；`src/lib/deepseekExtraction.ts:101-116`。I 臂只属于 CLI 评测入口，符合消融定位；连接状态逻辑仍有已知误导。 |
| K. Secret/raw-image persistence | PASS_WITH_LIMITATIONS | Cache 被 ignore：`.gitignore:15`；Worker 只记元数据而不记 body/header：`cloudflare/worker.mjs:558-571`。静态扫描未见真实 DeepSeek key 或非ignored实验图片；但 A–J 的 IndexedDB/导出/控制台/Worker 现场检查仍为 `NOT RUN`：`PRIVACY_SECURITY_BROWSER_ACCEPTANCE.md:12-16`。 |
| L. RC.4 / Production isolation | PASS_WITH_LIMITATIONS | 独立 Worker name、workers.dev、空 routes 是代码级隔离证据：`wrangler.jsonc:65-75`；当前文档声称 RC.4/Production 未变：`PREVIEW_DEPLOYMENT.md:44-50`。本审查没有新鲜 control-plane 证据，仓库 release report 仍写 RC.2：`docs/release/v2-beta/FINAL_RELEASE_REPORT.md:3-13`。 |
| M. Browser acceptance | FAIL | A–D、F–J 均 `NOT RUN`，E `FAIL`；部分人工观察没有网络载荷、存储/导出、键盘、PDF 页码、多浏览器证据：`PRIVACY_SECURITY_BROWSER_ACCEPTANCE.md:3-16,28-34`。 |
| N. Launch decision | PASS | 0 有效预测、真实用户时间未运行、连接状态误报、A–J 未闭合，足以要求 `DO NOT LAUNCH`：`2026-08-31_EXPERIMENT_RESULT.md:3-7,44-58`。该决定正确且必须保持。 |
| O. Standard integrity patterns | FAIL | 无模型自有 max/min 归一化，也没有把本轮 null 指标包装为高分；但 synthetic proxy、真空 F1/evidence、逐例 freeze 错项、未提交结果、失败分类与样本簇问题使方法整体不可接受。证据同 A、B、E、F、G、I。 |

## 确定性重算摘要

| 项目 | 重算结果 |
|---|---|
| Frozen manifest SHA-256 | `4e9fa0cdff324e1302f2ceb93d34597d51f428743e26855afccb0a114579dabf` |
| Dataset file / stable content hash | `5b9dfbf9...6724` / `015aff59...aae5`，匹配 |
| OCR file / stable bundle hash | `ecab0bd3...be2b` / `ad67306d...2491`，匹配 |
| 样本数 | 36；截图/照片/扫描各 12 |
| dataset 内部 source/image/expected hash | 36/36 匹配 |
| freeze 对 dataset 逐例 hash | 35/36；`mmu1-23.sourceSha256` 不匹配 |
| OCR text hash | 36/36 匹配 |
| CER | 总体 0.1938700327295；三介质分层与报告一致 |
| 留存请求 | 21 request failures；0 valid predictions |
| 正式 36 × 3 运行 | 不存在 |
| Final result Git state | 文件存在，但审查起点为 untracked |

完整哈希、命令边界和未展示敏感值的扫描记录见 `.aris/traces/experiment-audit/2026-08-31-e2-mm-audit.md:18-117`。

## Claim Impact

| Claim | 影响 |
|---|---|
| C1：IT 比 T/I 更准确 | **UNSUPPORTED**；0 条有效预测，没有比较数据。 |
| C2：IT 降低真实用户修改时间且不削弱隐私/确认 | **UNSUPPORTED**；human timing `NOT_RUN`，A–J 未通过。 |
| 36 条确定性 synthetic proxy 与 OCR bundle 存在 | **SUPPORTED_WITH_LIMITATION**；顶层 hash 正确，但 freeze 有 1 条逐例 hash 错。 |
| 冻结发生在首个模型调用前 | **NEEDS_QUALIFIER**；只证明早于最早留存 checkpoint，声明时间自相矛盾，无 provider ledger。 |
| Expected 未发送给 inspected model request | **SUPPORTED_WITH_LIMITATION**；代码与本地记录支持，无 provider-side 独立日志。 |
| I 是 image-only | **UNSUPPORTED end-to-end**；只支持 upstream-message-only。 |
| 所有留存调用失败、质量指标不可计算 | **SUPPORTED**。 |
| RC.4 与 Production 当前未改变 | **NEEDS_FRESH_EXTERNAL_VERIFICATION**；仓库配置隔离存在。 |
| DO NOT LAUNCH | **SUPPORTED AND MANDATORY**。 |

## 必需行动（本审查未执行）

1. 继续保持 **DO NOT LAUNCH**；不得把本轮当作小流量试验或替换评审依据。
2. OCR 生成后创建新的不可变冻结版本；修正 `mmu1-23`；逐例校验 freeze；绑定 runner/scorer/Worker commit，并保留可审计 provider request ledger。
3. 从 I 臂 HTTP body 与后处理彻底移除 OCR，或把该臂改名为“图片推理 + OCR 后验校验”，避免 image-only 误称。
4. 将成功但空结构定义为 invalid/semantic failure 或按预注册 denominator 处理；取消 empty-evidence=1，并补充空输出、选择性成功、非对称失败的对抗测试。
5. 独立报告 transport、auth、upstream、schema/invalid output、semantic、scoring 与 severe error；冻结明确的失败重跑和 checkpoint resume 政策。
6. 以独立 scenario family 为 cluster 做配对推断，统一 micro/macro estimand，预注册多指标 multiplicity；真实用户时间必须来自参与者流程。
7. 将结果及其来源 checkpoint hash/commit 绑定为耐久证据；保留 Smoke A 的历史版本标识，不以当前 scorer 静默覆盖旧产物。
8. 取得新鲜 Cloudflare control-plane 隔离证据，完成存储/导出/日志检查与 Chrome/Edge、手机、键盘、reduced-motion 的 A–J 全量验收。
