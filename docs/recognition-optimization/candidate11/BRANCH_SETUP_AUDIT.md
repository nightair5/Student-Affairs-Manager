# C11-P0 独立支线与计划交付审计

日期：2026-09-21。阶段性质：文档与Git隔离；非候选实现、模型质量或产品发布验收。

## 当前任务与完成范围

用户提供旧交接文件，明确要求新开支线并说明详细规划。
本轮从已核对的c9ed5ea建立Codex管理的独立worktree及codex/e2-candidate11-blind-eval，写入版本化计划、任务表、基线、短交接和追加日志。
后续P1—P6均为计划；本轮没有实现candidate11、运行新增模型调用、访问用户浏览器库或部署。

## 旧交接校正

长交接核验于9f4128e，保留原文件不覆盖。最新CURRENT_CONTEXT、日志和运行报告记录了24次已完成对照，累计314次。
旧评分器A10/12/B12/12；响应后审计A9/12/B11/12，审计主体是全新同系列模型代理，不能称为独立人工真值或盲测。
旧75.0%/91.7%不作新候选成绩；严格审计FAIL和OS04错误继续保留。

## 隔离与证据初始化

- 原工作区C:/Users/Winner/student-affairs-multimodal-exp，父分支codex/e2-multimodal-recognition-exp；创建前远端与本地均c9ed5ea673487b99d6a537795e3c873803a961da且干净。
- 新工作区C:/Users/Winner/.codex/worktrees/student-affairs-candidate11/比赛；没有.env、用户导出或依赖复制。
- 首次字节检查发现Windows检出换行转换：原ledger519152字节/LF，检出副本519796字节/CRLF。该次检查失败已保留记录，没有产生模型或账本事件。
- 逐个核对84份保护文件的新旧Git blob与父提交一致，差异仅换行；随后只在新worktree恢复其中83份的原工作区字节。原工作区未写入，Git内容不变。
- 账本恢复后644行、314次reserve，SHA256 dc52d9cd04b809be9d22d5298bd45d0e6f0a01307017d48a91aaa91a45e8e597。
- 字节hash、Git blob、最初checkout hash均在BRANCH_BASELINE.json；后续CLI不能把检出后的任意行尾转换视为可忽略的原始证据。
- 子工作区账本仅为历史快照；后续发送必须核对唯一writer和预算，不自动继承旧次数许可。
- 未重新读取临时收据目录或用户Downloads；不把历史644收据验收当本轮逐份收据检查。

## 计划的关键决策

- 先scorer v2与只读复算，后candidate11实现，再有限消融与新数据验证，最后产品和真人。
- 6×4=24的2×2消融固定修正公共底座与可见版本，只切换元指令和例子；没有把V00称为原candidate03。
- 12×2=24是另一个拟议小批验证；标签人选/独立性尚未落实。48次总量不能满足商业质量/真人/发布门。
- 商业契约保持0.6.0-draft；原两批九格式及真人要求没有被新路线降级。
- 计划采用experiment-plan技能；共享协议引用在安装目录未找到，已按技能正文明确的“时间戳版本+固定入口+manifest”方式交付，不影响计划主体。

## 本轮检查

- Markdown人工检查通过：阶段、2×2矩阵、调用数、分母、独立标签与商业边界保持一致。
- 机器检查通过：84个保护文件SHA256、2对时间戳/固定入口字节、5份主文档结构、8个本机Markdown链接；短交接54行/4186字节，低于约定上限。
- Windows行尾恢复后再次核对Git blob一致，刷新新worktree索引stat；没有产生任何受保护文件的暂存内容变化。
- git diff --check通过；仅存在Git行尾提示，不是内容错误。最终暂存检查限于本阶段9个文档/JSON路径。
- npm run security:scan通过，共检查2412个source/build文件；该结果不是供应链或依赖漏洞审计。
- 原工作区干净、HEAD仍为父提交；本轮新增模型调用0，账本字节SHA保持。
代码lint/test/build、模型、浏览器及线上验收均NOT_RUN，本轮无相应实现变更。
历史代码失败（RCO-5-007旧package-lock冻结hash）仍保留，非本轮修复。

## 交付状态

本阶段的文档与隔离检查完成。提交主题为docs(product): plan isolated candidate11 evaluation；最终提交号由Git记录，远端同步结果在交付回复中提供。
下一阶段为C11-P1，进入条件和可复制指令见refine-logs/EXPERIMENT_PLAN.md第10节。当前没有后台任务、定时运行或模型预约。
