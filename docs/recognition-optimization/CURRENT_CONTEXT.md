# 当前交接：D8 W1/W2 工程已交付，W3 等待完整参照

## D8 最新状态（2026-09-27）

本支线新增 Candidate15 Prompt 15.1、v6 参照/评分、真实 UI 事件计时 v3 和独立 6635 工程回放；默认 Candidate03、D7 冻结文件、旧结果、旧库和权威账本均未改。事件时间六字段与关联错误不再容易被评分放过；无当前任务的 informationScopeIds 与 Prompt 对齐。D8 浏览器实际核对了编辑写入失败后恢复、两事项部分确认、无截止任务确认、独立读回与刷新。详细结果与不足见 [D8 结果](candidate15/d8-development/D8_RESULTS.md)。

新 Development 包复用 12 份完全已见的 D5 合成来源；v6 完整参照目前 **0/12**，故 **24 个配对请求仅为计划、实际身份 0**，全部 `NOT_RUN` 且不可派发。停止状态为 `W1_W2_ENGINEERING_DELIVERED_W3_WAITING_FOR_COMPLETE_REFERENCES`，并非 `D8_DEVELOPMENT_READY_FOR_NEW_AUTHORIZATION`。下一步在已见开发资料上逐份完成可表达参照与实际 Schema/adapter/scorer 正反例，再冻结 24 身份、重核官方价格/账本及申请新的调用授权；独立人工 Holdout 与真人指标仍需后续独立证据。四项真人主指标仍 `NOT_OBSERVABLE`，不宣称 Candidate15 已提高识别转化率。

以下 D7 与治理复查为历史快照，保留原结论；其中“D8 尚未执行”的语句只说明该快照当时状态。

日期：2026-09-27。工作区：`C:/Users/Winner/.codex/worktrees/student-affairs-candidate11/比赛`。分支：`codex/e2-candidate11-blind-eval`。停止状态：`D7_BLOCKED_ON_REFERENCE_CONTRACT`。

## 最新复查（2026-09-27）

后续规划已按用户要求展开为 [完整执行路线](../governance/PROJECT_EXECUTION_ROADMAP.md)：当前先连续执行 D8 的 W1/W2/W3，再按结果进入新授权 Development、独立人工 Holdout、真人效用和发布准备。文末有可直接发送的启动指令；本轮仅交付计划，D8 尚未执行。

已修正 README、PR 模板、RUNBOOK 和旧总计划的适用范围，新增 [项目入口](../PROJECT_ENTRYPOINTS.md)。PRD 1.0 / AGENTS 2.0 与其哈希不变。保护工具单测改为纯内存夹具，CI 增加独立治理单测，原 verify job 与发布门保留。

只读工程复现发现 measurement 2.4 把阅读计作主动修改，且 edit 与批量保存 ID 不同可能漏计纠正。旧冻结代码未改；下一版需修复。20 项外部资源已按优先级筛选，优先借鉴证据定位、行为反例测试、标注隔离和交互恢复。详见 [复查与行动表](../governance/review-20260927-r2/REVIEW_AND_ACTIONS.md)、[资源目录](../governance/review-20260927-r2/RESOURCE_CATALOG.md)；[D8 提示词](../governance/NEXT_STAGE_EXECUTION_PROMPT.md) 已加入具体反例验收。

本次没有新增产品模型调用、grant/reserve/settle、Secret 明文读取、账本/旧库写入、依赖、Schema 变更、默认候选替换、真人或部署；未执行 D8 产品实现，不宣称识别率提高。验证见 [复查验证](../governance/review-20260927-r2/VALIDATION.md)。

## D7 交付证据快照

以下测试与“84 份原位一致”是治理改版前的 D7 记录；当前保护状态与后续执行规则以下方“治理更新”为准。

Candidate14 仍为独立完整 Prompt，默认候选未变。D6 的 24 次配对结果和 `REJECT_CANDIDATE13_DEVELOPMENT` 原样保留；D7 没有新增业务模型调用、Secret 读取、grant、reserve、settle、账本写入、真人试用、合并或部署。旧 Expected、raw、结果、锁文件与 84 份保护文件未改。

新工程链路已做：Reference/Scorer 5.5 分开检查动作、对象、条件前件/事实 scope、事件关联和候选结果；时间策略 1.1 保留不确定性；无任务处置 1.4 使用隔离本地锚点库与工作区历史核对，支持只归档信息、独立读回和失败闭锁；测量 2.4 要求独立授权真人试次并从原始事件重算。定向测试、lint、build、security scan 通过。上述是工程能力，不是识别正确率或真人转化率已提升。

冻结提交 `c1598c6` 已推送，冻结聚合 SHA-256 为 `603802b1d165b6e46645de5fda971977565b2e24a0c385f7b97e0fd94e27f0f7`。之后合成的 R5 曾有 12 来源、12 单作者参照和 24 个 `dispatchAuthorized=false / NOT_RUN` 身份，但同系列 provisional 审计发现公平评分阻断：Prompt 与信息 scope 评分不一致；独立事件时间的类型、精度、时区及确认状态漏检；个别来源的格式/完成标准和未知时间口径未裁决。R5 Manifest SHA-256 `3513b4f7842d7992b65d850057f18bac91424de77d773236d7c51ecb11c0bfed` 已在派发前失效，不能授权调用。R4 Manifest `00cf591998b6396ca4bbbbca61b4a0594cdb88f86b8879f02391bdea350a8866` 也因数据冻结顺序问题提前失效。R1–R3 失效记录保持。

问题与下一轮设计见 `candidate14/d7-blocked/ARCHITECTURE_DECISION.md`；R5 文字已转入仅用于排除的 `candidate14/d7-blocked/INVALIDATED_R5_SEEN_SOURCES.json`。完整下一阶段操作见 `../governance/NEXT_STAGE_EXECUTION_PROMPT.md`，预算仅有 `FUTURE_BUDGET_AUTHORIZATION_CARD_DRAFT.md` 草案。下一轮先在已见匿名工程资料上完成 Prompt→wire→adapter→reference→scorer→处置对应表与正反 wire 实例；开发调试允许复用资料，新正式批次派发前冻结。只有独立 Holdout 需要未见和独立人工隔离。所有新调用均须重新核价、核对账本和单独取得明确授权。不得复用 R4/R5 身份。

权威账本只读核验为 791 行、694807 字节、SHA-256 `efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a`；84 份保护文件一致。完整 `npm run test` 的 1468 项通过、3 项失败、1 项跳过：2 项旧回放默认 5 秒超时，定向重跑通过；1 项历史 `REAL_INPUT_CARRIERS_MANIFEST` 未定义，未改旧载体。`RCO-5-007 / FREEZE_HASH_MISMATCH:package-lock.json` 仍为历史失败。官方浏览器通道报 `Browsers: Error: nodeRepl.fetch request failed`，本轮浏览器点击、读回、刷新验收为 `NOT_RUN`；本地构建或单测不代替浏览器证据。四项真人主指标全部 `NOT_OBSERVABLE`。

## 2026-09-27 治理更新（当前规则入口）

用户已明确授权审查并重制 PRD/AGENTS，本轮只交付治理文档与必要只读校验工具。根 PRD 1.0 和 AGENTS 2.0 生效，历史阶段禁令按原范围归档，不再要求每个本地补丁重新授权。四项指标、无任务归档、分层验证与停止范围已澄清；详细决定见 docs/governance/GOVERNANCE_REVIEW_2026-09-27.md。

保护状态已变为 82 份历史文件原位不变 + 2 份旧根文档逐字节存档；两份新活动文档另锁哈希。运行 node scripts/verify-governance-protection.mjs。旧 84 份原位校验及依赖它的旧 D7 验证预期失败于两份授权文档变更，不能再称 84 份原位未变；旧清单、断言和冻结组件均不修改。账本仍只读、D7 仍未通过，新保护检查不授权派发。

下一任务按新 D8 提示词推进 W1 契约修复和 W2 确认/测量闭环；本轮尚未执行。原 R4/R5 身份仍失效；已见文字只能以公开已见程度的新回归/Development 用途使用，不称全新 Holdout。下一批业务模型调用、真人验证及部署均需相应新授权。验证记录见 docs/governance/VALIDATION.md。
