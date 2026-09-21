# 当前交接：candidate11 独立支线与计划

## 本轮授权与目标

- 当前用户要求：读取 HANDOVER_CONTEXT_BRIEF.md，重新建立独立支线并交付详细推进路线。
- 本轮只有C11-P0分支/规划文档；candidate11代码、scorer v2、模型调用、真实材料/真人试验和部署均未执行。
- 下一建议阶段是C11-P1评分与只读复算，需要当前用户明确启动该实施包。计划中的调用不是许可。

## 工作区与基点

- 新工作区：C:/Users/Winner/.codex/worktrees/student-affairs-candidate11/比赛。
- 新分支：codex/e2-candidate11-blind-eval。
- 父提交：c9ed5ea673487b99d6a537795e3c873803a961da；原分支codex/e2-multimodal-recognition-exp及其原工作区保持。
- 本轮交付提交请用git log -1 --oneline和远端核对，不能把父提交当最新提交。
- 没有复制.env、浏览器库或用户Downloads，没有装依赖、启动服务或新建另一条Codex任务。
- Windows检出将83个保护文件转为CRLF；核实与父Git blob完全一致后，只在新worktree恢复原工作区的精确字节。84个保护文件的hash见基线；未改Git内容。
- 后续工具必须显式使用这个新路径，不能在旧cwd原地修改。

## 历史状态校正

- HANDOVER_CONTEXT_BRIEF.md的9f4128e/290次/candidate10 NOT_RUN为历史快照；后续24次已经完成，累计314次。
- 原评分：A10/12、B12/12；响应后有限审计：A9/12、B11/12，B3胜/A1胜/8平。
- 审计者是全新同系列模型代理，不是独立人工标注者；审计后比例不是预注册盲测或真实用户转化率。
- candidate10在OS04把核验完成扩大为核验通过；严格实验审计FAIL，未采用。
- 证据目录：mainline-real-input-01/runs/opensource-methods-20260920a/。
- 旧原答、Expected、scorer、binding与报告不可覆盖；新评分另存为已见诊断结果。

## 预算与保护

- 账本644行，实际reserve计数314；SHA256 dc52d9cd04b809be9d22d5298bd45d0e6f0a01307017d48a91aaa91a45e8e597。
- 历史已审报告费用上界14.042543元，原硬限20元；服务商实扣NOT_OBSERVABLE。
- 当前314次调用许可已用完，本轮新增0。候选分支内ledger只是快照，不得形成并行写账本/新预算。
- 后续派发前必须明确唯一权威ledger目录、跨进程锁、最新计费和逐次预留。不可直接运行继承的历史runner。
- 现有6632用户库、公开Preview、RC.4/Production保持；未进行线上验收。

## 路线与停止点

1. P1：新增版本化评分器v2、结构化一对一匹配、完成标准/时间/条件/修订检查、只读幂等复算及预算失败保护。>=30匿名工程夹具，24旧答另存复算，0调用。
2. P2：candidate11最小完成标准修正及新版对比例子；真实组件承接正确事实的工程上限，0调用。
3. P3：修正公共底座上6source×4变体=24次Development消融，元指令M/示例E开关，可见版本一致。待新授权。
4. P4：独立制作者的12个全新source×原candidate03/冻结最佳candidate11=24次。独立标签尚未落实；同作者换皮/模型审计不能冒充人工盲测。
5. P5：本机隔离真实App确认保存、刷新读回、本机观察事件；工程转化不等于真人。
6. P6：另批用户研究和商业验证，仍由未批准商业契约决定范围/阈值；48次不代替商业Holdout，不自动批准Preview。

## 产物与核验

- 详细计划：refine-logs/EXPERIMENT_PLAN.md；包含实施路径、消融矩阵、判定规则、预算和P1可复制指令。
- 任务表：refine-logs/EXPERIMENT_TRACKER.md。
- 基线与审计：docs/recognition-optimization/candidate11/BRANCH_BASELINE.json、BRANCH_SETUP_AUDIT.md。
- 受保护文件84个；原分支Git内容及原工作区未变。
- 本轮仅文档检查、diff和密钥扫描；不重跑模型、完整代码测试或网页验收，不把历史测试成绩算本轮。
- 旧RCO-5-007锁文件冻结hash失败仍在；后续代码阶段不得改旧断言或以定向通过声称全套全绿。
- 恢复顺序：AGENTS/PRD相关章→本短交接→日志末尾→计划→基线核对→当前获准包。
