# D12 验证记录

日期：2026-09-28。起点 HEAD：a4bb253d7973052488949fbed4d2b381d4178d26。
本地改动范围：活动治理文档、旧正文存档、新历史校验与诊断/工作流工具。没有修改产品运行时、冻结候选、旧评分、锁文件或用户数据库。

| 命令/检查 | 实际结果 | 解释 |
|---|---|---|
| node --test scripts/recognition-d12.check.mjs | PASS 10/10 | 零预测、零匹配、12个合法 wire 真实适配、关键时间反例、全部24份录制回答、引用失败保留、阻碍范围、篡改、清单与证据联动篡改、Git历史绑定及账本追加 |
| node scripts/diagnose-recognition-d12.mjs --verify | PASS | 可重复构建新诊断；3个旧异常恢复，其余21份分数不变 |
| node scripts/recognition-progress-policy.mjs --verify | PASS | 工作流状态与争议队列一致；没有授予调用/真人/发布权限 |
| node scripts/verify-recognition-history.mjs --verify | PASS | 84份原保护、119份冻结文件、7份原字节存档、D7组件、840行账本及完整链 |
| npm run lint | PASS，0 errors / 8原有warnings | 7个 Fast Refresh 文件组织提示、1个已有 ref cleanup 提示；新脚本定向 lint 同样通过 |
| npm run test | FAIL | Vitest 141文件通过/3失败/1跳过；1486测试通过/3失败/1跳过。见下方分类；不能声称全量PASS |
| npm run build | PASS | TypeScript与Vite成功；保留大chunk提示，未发布产物 |
| npm run security:scan | PASS | 未发现Secret；未读取环境Secret |
| node --test scripts/rco-5-007-replay.node-test.mjs | 历史FAIL，3/4通过 | FREEZE_HASH_MISMATCH:package-lock.json，未改旧锁或断言 |
| node scripts/verify-governance-protection.mjs --verify | 旧版本断言FAIL | ACTIVE_DOCUMENT_DRIFT:AGENTS.md；本轮有授权的规则换版，原文已存档，新保护通过，旧工具未改 |
| git diff --check | PASS | 活动文件无新增空白问题；原字节存档按历史字节保留 |
| 新浏览器工程回放 | NOT_RUN_D12 | 本轮没有产品交互改动；没有将旧D10证据冒充本轮验收 |

全量失败与 D11 同类：scripts/verify-candidate15-d9.test.mjs 是 Node 测试却被 Vitest 收集为无套件；realInput01 acceptance/runtime 两处默认5秒超时；candidate02 launcher裸测试缺 REAL_INPUT_CARRIERS_MANIFEST，落到 undefined 路径。npm test 在 Vitest 失败后，后续串行 Node/server/Worker 阶段没有执行，不写成通过。

本轮新增工具的定向测试通过。旧活动文档哈希失败是本次授权换版造成的预期不兼容，单独报告，不能混称本轮零失败或偷偷更改旧断言。新工具保护原始84份、D7组件、D8—D11证据，并拒绝篡改；不改变旧冻结批次结果。

权威账本本轮无写入，840行，SHA-256：ca5bb4f57d011bcf8f583d48d637076a8c76d380d98b3f5b46b0ea6f6c9f17ea。新业务模型调用0，grant/reserve/settle新增0。

本次 fresh same-family 审查为 provisional；历史 D11 的证据审查为 WARN（评分器缺陷），非独立人工真值。详情见 EXPERIMENT_AUDIT.json。四项真人指标全部 NOT_OBSERVABLE。

提交前检查 staged diff；提交后立即推送当前分支并核对 HEAD/upstream/远端，精确交付 SHA 见本次最终回复和 Git 历史。不能为了让文档包含自身 SHA 反复新增空审计提交。
