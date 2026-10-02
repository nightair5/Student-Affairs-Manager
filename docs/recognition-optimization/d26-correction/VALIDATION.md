# D26 验证：当前工程与历史复现分开

2026-10-02；[完整分组摘要](validation/SUMMARY.json)。本轮没有把全量失败写成 PASS，也未改锁、旧断言或冻结原件。

| 验证 | 实际结果 | 限制/日志 |
|---|---|---|
| Windows `npm test` 全部 34 个分组 | 30 PASS，4 历史组 FAIL；exit 1 | 当前产品 915 pass/1 旧 skip；安全 534、runtime 28、载体 78 通过。server/Worker/Functions/time parity 各自完整退出 |
| 当前 D26 机制、原答评分、仓储、普通确认/测量 | PASS | v10 描述、独立时间、错误对象/关系、source/CAS、读回回执、原答隔离、重试计量均有正负例；日志按组留存 |
| 最终冻结/执行器 follow-up | 17 PASS | 14 执行器 + 3 冻结反例；全 context 上界不能缩成请求粗估；CRLF 仅源码归一，语义变更拒绝，artifact/raw 原字节 |
| lint | exit 0；0 error，8 既有 warnings | `.data` 生成 bundles 使上一轮扫描无谓增长；停掉该次扫描，正式配置仅忽略临时产物，全部源 TS/TSX 仍检查。没有排除失败测试 |
| build/typecheck | PASS | 既有 >500kB chunk 提示仍在，不假称包体已优化 |
| security scan | PASS，3602 source/build 文件 | 最终文档与浏览器证据后已复核；模型/Secret/账本写均 0 |
| WSL/Linux 隔离 current-product（UTC） | PASS；当时 913 pass/1 skip | 无网络 bwrap、现有 Node22；随后新增两条 measurement 反例在 Windows 915 和最终 Linux 29 定向覆盖 |
| WSL/Linux current-safety（Asia/Shanghai） | 可运行组通过；整体 INCOMPLETE / exit 2 | 既有 D25 PowerShell OS-lock 原测试在 Linux NOT_AVAILABLE；Windows 完整执行。并非 Linux 全 PASS 或新云 CI 已运行 |
| 最终 Linux 回归 | 29 相关测试 + 2 render 检查、tsc PASS | `validation/linux-final-related.log`、隔离命令；UTC/Asia/Shanghai 经 wrapper 真实到子进程 |
| Linux 匿名 carrier | PASS | 102 字符、88 中文；固定字体 SHA/cmap/不同中文字形；不是 OCR 准确率或模型结果 |
| D19 diagnostic verify | PASS，原结果保持 | 旧诊断不等于新模型成绩 |
| 历史保护 | 84 protected/119 frozen/7 archives 保持；账本完整链未变 | [INTEGRITY_STATUS](INTEGRITY_STATUS.json)。938 行，SHA e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9；旧 98 行合法追加提示保留 |
| `npm audit` | exit 1；5 high/2 moderate | 7 包，见 [原 JSON](validation/npm-audit.json)。不改锁，非发布认可 |

## 四组历史失败原文

1. D9：`D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs`；4 用例中 3 pass/1 fail。[日志](validation/d9-historical.log)。
2. RCO-5-007：`FREEZE_HASH_MISMATCH:package-lock.json`；4 用例中 3 pass/1 fail。[日志](validation/rco-5-007.log)。
3. C11 history：`C11_HISTORY_PROTECTED_CHANGED:AGENTS.md`；1 fail。[日志](validation/c11-history.log)。
4. C11 gateway：同一 AGENTS 历史断言触发 5 fail，其余用例照常执行。[日志](validation/c11-gateway.log)。

它们已在 D25 前存在，当前原件由独立原快照保护校验。活动 App/治理代码变化不追写旧冻结 Manifest；历史运行时应在原提交复建。这 4 组本轮仍是 FAIL，不称“修掉旧失败”。本轮新增失败已修：源基线、初始事务、原文不可变/图保持、source-readback 状态、语义桥接、恢复写集、假 duration 纠正计数和逐来源 measurement 读回异常。一次高风险独立视角复核已处理，没有再新增全仓循环审计。

## 依赖风险与维护建议

audit 的包是 `brace-expansion`、`undici`、`sharp`、`miniflare`、`wrangler`、`@vitest/mocker`、`vitest`。Wrangler/Miniflare 路径为开发工具；Vitest mock 风险需要测试服务/mock 功能，不应暴露测试端口；brace-expansion 风险与恶意 glob 展开有关；sharp/undici 属工具链的图片/网络处理，不能因此宣布不可达或漏洞消失。

当前内部入口由 Node 静态服务仅绑定回环，真实外部/模型路由 403；没有运行 Miniflare 公网服务，也没有生产部署。上述库不是此次普通网页 bundle 的业务依赖；没有重测已部署云端，不能写生产无风险。

兼容维护另用新可回退提交及新锁版本：Wrangler 在当前 `^4.118.0` 主版本内评估已修复发布，重跑 Worker/本地工具；audit 声明的 Vitest 修复涉及主版本，先隔离验证 4.1.11/5.0.3 的配置兼容性，不能直接 `audit fix --force`。本轮锁保持，不以新漏洞为识别开发总停止理由；扩大对外范围前必须处理对应可达风险。

## 浏览器证据的限制

浏览器发现并修复：错误保存提示、原 duration 被当人工修改、模态遮罩下读回按钮未实际触发、重复导入提示、来源过期使整个测量汇总抛错。原始过程证据仍存，但在 EVIDENCE_INDEX 明确排除于 PASS 证明。最终只阅读至少 10 秒主动编辑 0；过期来源记 MISSING，正常来源仍可报告。见 [浏览器验收](BROWSER_EVIDENCE.md)。

OS 下载完成事件工具超时：已验 repository 生成合法 JSON、显示完整备份、真实文件选择导入新库及坏备份拒绝。没有声称浏览器原生下载落盘已可观察。

代码本地提交已验证。GitHub 云 CI 未运行；自动部署绑定不能核实时不推送，记录 PUSH_BLOCKED_AUTODEPLOY_BINDING_UNVERIFIED，不伪造远端同步。
