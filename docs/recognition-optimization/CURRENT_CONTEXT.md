# RCO Current Context

## 当前结论
- 当前工作包：MAINLINE-REAL-INPUT-01 candidate08 证据角色实验。
- candidate08 已完成实现、40次配对请求、分析和工程检查。
- 最终结论：candidate08 `NOT_ADOPT`，不接入6632隔离入口。
- candidate03继续作为可靠基线；03/05/06/07历史不改。
- 本批没有提高可证实的首次识别准确率或确认转化率。
- 原因：candidate08有17/20份被证据角色契约拒绝。
- 只有3/20份进入原评分器，不能据此宣布质量改善。
- 6632既有独立库、unverified材料及已确认任务全部保留。
- 因未达到采用门槛，本批真实产品旅程为NOT_RUN_NON_ADOPTION。

## 仓库
- 唯一仓库：C:\Users\Winner\student-affairs-multimodal-exp。
- 分支：codex/e2-multimodal-recognition-exp。
- 本轮起点：de017e5bfb759263ec24270ae85d624ffcb88471。
- candidate08执行期间，另一项已授权任务将分支和远端推进到ca4e3a7dca52698bf3b8be0318095aac5b9eba63。
- 两个并行提交仅涉及独立HTTPS访问修复，与candidate08未提交文件无重叠，已完整保留。
- 实际提交和远端状态见candidate08-20260913a/DELIVERY.json。
- 不回切、不变基、不强推，不动生产入口。

## 新实现
- candidate08.ts：单请求证据角色优先候选。
- candidate08.test.ts：请求身份、参数和来源隔离测试。
- evidenceRoleWire.ts：角色校验、引用校验和反向索引。
- evidenceRoleWire.test.ts：不补造、不吞错的8个正反例。
- runner/gateway/budget/checker接入S/T新单元和168次上限。
- 总人民币上限20元；现行单请求滚动预留3.30元。
- 新路线仍使用既有语义结构，不建第二套仓储。
- 自动默认选择保持NOT_ENABLED。

## 输入与冻结
- 候选、Schema、依赖先冻结，再创建8份新匿名通知。
- 12份旧材料为已见开发回归；8份为首次开发验证。
- 每份candidate03/candidate08各一次，共40请求。
- 相同正文、参考时刻、时区和模型；顺序固定平衡。
- 参考事实只进评分，不进请求、转换或产品决策。
- 文件/图片/工作区未外发；只发送授权匿名文字和scope索引。
- 没有Repair、verifier、自动重试或补调用。

## 模型结果
- 40/40 HTTP 200并结算，0传输失败。
- 请求模型和返回模型均记录为deepseek-flash。
- candidate03：20/20可评分，0/20无需重大纠正。
- candidate08：3/20可评分，17/20被确定性契约拒绝。
- 拒绝：任务角色7、材料角色7、时间1、事件1、覆盖1。
- candidate08没有证明多余任务、漏任务或材料归属减少。
- candidate08不写入产品，不用浏览器旅程包装成功。
- 完整逐例结果见candidate08-20260913a/COMPARISON.json。

## 根因与后续
- Prompt允许同片段多个角色，实体又只能引用同类角色。
- JSON Schema不能直接约束字符串引用指向哪种角色。
- 模型经常把动作、材料、时间角色一起挂到同一实体。
- 转换器拒绝这些结果符合不补造、不隐藏遗漏的原则。
- 看结果后没有放宽转换器、改候选或改评分器。
- 下一次唯一优先：把角色拥有者压缩为Schema可表达的单一字段。
- 其他来源依据改为不参与角色类型判断的独立引用。
- 新契约先零调用承接已有正确响应，再决定是否开下一批。
- 本轮不创建candidate09，不追加模型调用。

## 费用和账本
- 本批40请求等待累计258222ms。
- 本批费用上界1067565微元，即1.067565元。
- 全账本费用上界7197982微元，即7.197982元。
- 服务商实际账单不可观测，记NOT_OBSERVABLE。
- A01未知3300000微元永久保留，不退款式释放。
- 账本345行、累计168次，旧264行前缀逐字保持。
- 当前账本SHA和尾hash见CHECKS.json。

## 工程检查
- candidate08和wire定向测试12/12通过。
- TypeScript app/node通过；lint 0错误、4既有warning。
- 安全Vite构建通过，根.env禁读，使用临时env/cache/out。
- 全量Vitest最终1345个不同测试有通过证据，3跳过。
- contract、time AST、server、worker、parity、lib、functions通过。
- 运行中6632只读探测通过，模型POST保持405。
- 旧RCO-5-007仍为3/4，原因是历史package-lock冻结SHA差异。
- 本轮未改package-lock、旧断言或历史结论。
- Secret scan 1951文件通过。
- 944保护、607旧静态证据和旧候选/评分/回答保持。
- 当前ca4e3a7 HEAD重新通过app/node类型、lint、安全Vite构建、独立预览访问测试及1960文件Secret scan。
- 最终当前HEAD证据见FINAL_IMPLEMENTATION_SNAPSHOT.json和FINAL_CHECKS.json；旧快照仅代表开始HEAD。
- 独立审计为PASS_WITH_WARNINGS；未发现阻止NOT_ADOPT交付的问题。
- 未触发的parentTempId目标存在性缺口已登记；candidate08不得直接复用为产品契约。

## 交付边界
- candidate08代码与失败证据可审计交付，但路线不采用。
- 本批确认任务0；用户编辑操作和保存比例NOT_RUN。
- 6632现有任务未覆盖、未清库、未迁移。
- 不接真实用户库、稳定入口或生产部署。
- 最终独立实验审计见EXPERIMENT_AUDIT.md。
- 主报告见candidate08-20260913a/AUDIT.md。
- 完成提交推送后停止，不自动继续候选或付费实验。
