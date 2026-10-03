# 验证与未解决项

2026-10-03。代码 `69c7baff71b59f0df8e48ffab4ccf264e8865d7d`；验证日志本机 `.data/candidate11/checks/`。没有业务模型/账本写入。所有旧断言/锁/Expected/raw/评分保留。

| 检查 | 实际结果 | 范围 |
|---|---|---|
| 新契约定向 | 18 PASS；连同确认/测量定向 32 PASS | shape/四态/真假主附属/来源范围/前置证据/事件端点/真实正式链及独立读回 |
| 最终 current-product | 9 组 PASS；Vitest 94 文件通过、1 skip，945 测试通过、1 skip | timezone、原生成契约、原时间 AST、Vitest product、Node server/worker/worker-d26/functions/time-parity 均确定退出 |
| 完整现行 test | 37 组：31 PASS /6 历史 FAIL | 各独立组全部执行；最终新增双向声明检查/等待文案/事件时钟后复跑受影响产品组，通过；不冒称完整组是在最终源码重跑 |
| lint | PASS，0 error/8 既有 warning | 主要为旧实验入口 Fast Refresh 与旧 realInput01 effect 引用警告；未靠排除文件消除 |
| TypeScript/build | PASS | 原 500KB chunk warning 保留，主 chunk 658.49KB；没有升级依赖或提高警告阈值 |
| security scan | PASS | 扫描 secret/不允许数据；纯声明双向校验后未重复无关扫描，文档边界再扫描 |
| history/host readonly | 84/119/7 原样；原145组件/7产物/16请求一致 | raw16/receipt33，全部 SETTLED，audit CONSISTENT，无新 dispatch/grant |
| 浏览器/隔离/读回 | 实际 PASS，剩余语义阻断如实保留 | 新端口/新库、默认外部路线403、正式链；完整 A—L 未声称重跑 |
| npm audit | 5 high /2 moderate，未修复 | 不称审计 PASS/可发布 |

完整历史失败精确入口：

- d19-diagnostic、vitest-d17-history：`D17_SCORE_LEDGER_DRIFT`。旧验证把 D17 当时全账本 SHA 与合法追加后的账本比较；本轮账本前后不变。旧分数/断言不改，若后续维护需另版本只读校验历史前缀，而非改旧 Manifest。
- d9-historical：`D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs`。
- rco-5-007：`FREEZE_HASH_MISMATCH:package-lock.json`。
- c11-history、c11-gateway：`C11_HISTORY_PROTECTED_CHANGED:AGENTS.md`。

后四组为已有活动文件与当时旧哈希不一致，本轮没改这些文件。旧 Node/Vitest 发现、carrier 环境和 5 秒问题现行入口已分组/匿名 carrier/限并发；本轮未出现新收集/carrier/超时失败。没有排除旧套件、改旧断言或全局延长 timeout。精确日志片段/日志 SHA 在 [历史失败](evidence/HISTORICAL_FAILURES.json)，完整原日志保留本机。

## 依赖风险与维护建议

只读 npm audit 的 7 项均在当前 lock 标 dev=true：Vitest3.2.7/@vitest-mocker3.2.7、Wrangler4.120.0/Miniflare5.20260801.1-alpha、sharp0.35.2、undici7.29.0、brace-expansion5.0.9。当前浏览器产品/Node server/Worker/Functions没有直接导入这些工具链包；本轮纯回环静态录制服务没启用 Miniflare/Vitest UI/任意外部图像转换。不能由此声称风险不可达或生产已安全：开发/测试 runner 仍使用受影响工具，遇不可信 mock/图像/网络输入可有风险。

后续隔离维护验证：brace-expansion≥5.0.12、sharp≥0.35.4、undici≥7.29.1 的兼容版本，配套 Wrangler/Miniflare 修补；Vitest 同主版本若有修补优先核官方发布，audit 推荐5.0.3为 major，不能盲升。维护另分支/新版本 lock 和冻结基线，保留旧冻结文件，重跑 mock/capture/worker/functions/浏览器。当前用户禁止新增依赖和改旧锁，本轮只给出可检查建议，不执行 audit fix。审计 JSON [保留](evidence/NPM_AUDIT.json)。

## 尚未证实的产品与模型效果

新生成契约未调用模型，不能称 C18/新候选识别率变高。四态结构合法不证明原文确实未提/明确没有；材料对象、条件、时间类型和值仍需要语义证据。S08参照争议、标题/自由描述/泄漏未裁决，保持未知。

普通 v8/RecognitionResult 不能无损表达全部取消/替代/资格事实，相关项继续阻断；待办等待与资格未知的不同用户解释已有实际浏览器，但没声称解决所有关系语义。没有测真人省时、生产在线延迟、跨设备或全局最优安排。

关键验收没有以单元测试替代浏览器。两个过程空读回文件不当证据，最终非空 canonical 读回补齐。旧6792/6798库与默认候选不动；没有重复付费尝试。结果的可展示性分母16保持，原评分不变。
