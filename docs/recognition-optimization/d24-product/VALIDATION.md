# D24 验证与历史失败

2026-10-01。最终代码0b8a6e4；全量已确定退出，**11组PASS、4组历史FAIL，整体exit=1**。

| 验证 | 结果 |
|---|---|
| D24产品/Schema/adapter/Repository/分母正反例 + semanticView + factCorrections | 38/38通过：11+3+24；真实空白手动补时间、再编辑新材料、事件追加修订、来源保护与错误时间/对象等 |
| 权威npm run test | 15组均退出；Vitest157文件/1573项PASS，1文件/1项skipped；server/worker/functions和其余独立组均执行 |
| lint | 最后全量0错误/8原有warnings；测试变量prefer-const曾失败，随后修正并重新通过 |
| build | TypeScript严格检查+Vite通过；原有>500KB chunk警告保留 |
| security:scan | 通过；扫描数随必要证据文件变化，最终执行回执见validation目录 |
| 构建/隔离 | 主及补充实例verify-d23-study验证来源、刺激、16排程、4DB、source指纹及禁用model/API/文件/外域路由；不发探测请求 |
| 只读历史/账本 | 84保护/119冻结/7归档不变；938行、前后SHA相同；98行以前合法追加仍需按历史解释，不改旧基线 |
| D19旧输出诊断verify | 保持D17 A1/B2及旧24分母，不是新候选成绩 |
| 浏览器 | 实际工程点击、故障、手动恢复、独立canonical读回及刷新见BROWSER_EVIDENCE |

通过组：contract、time-contract、vitest、server、worker、d19-diagnostic、time-parity、multimodal-lib、functions、c11-scoring、c11-preview。

| 历史失败组 | 原始错误 | 本轮处理 |
|---|---|---|
| d9-historical | D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs | 不改冻结Manifest、旧断言或活动代码回滚凑绿 |
| rco-5-007 | FREEZE_HASH_MISMATCH:package-lock.json | lock及旧冻结数据原样保留 |
| c11-history | C11_HISTORY_PROTECTED_CHANGED:AGENTS.md | 活动规则在此前合法升级，新版历史保护通过；旧断言仍报告失败 |
| c11-gateway | C11_HISTORY_PROTECTED_CHANGED:AGENTS.md | 同一前置失败；没有调用网关或写账本绕过 |

本轮新增已修故障：出处检查点字段key不合法、空白手动精确时间被当未知、新材料再次编辑没有模型原始实体、精确截止摘要误待定。真实反例和浏览器复验保留；没有新增未解释的产品测试FAIL。安全扫描通过不等于npm audit零漏洞，本包未新增依赖/升级锁。

权威账本唯一位置：C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl。938行，SHA e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9。model/grant/reserve/settle/human均0；本轮不读取Secret明文。

完整测试汇总、原日志、lint及最终历史/隔离校验保存在本目录validation；浏览器/构建/证据各SHA列于EVIDENCE_INDEX.json。结果文档与活动规划不是新的历史冻结Expected，不修改旧原答/成绩。

本次新增证据目录使用Git的`-text`属性保留实际字节，避免Windows/Linux换行转换破坏读回和日志哈希；旧证据属性不改。索引验收同时核对工作区字节和提交索引字节。
