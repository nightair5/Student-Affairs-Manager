# 下一工作入口：完成 D21 尚未验收的来源核对路径

当前事实见 [D21 结果](../recognition-optimization/d21-review-session/D21_RESULTS.md)、[逐项浏览器证据](../recognition-optimization/d21-review-session/BROWSER_EVIDENCE.md)和[路线](PROJECT_EXECUTION_ROADMAP.md)。本文件是后续计划，不自行授权模型调用、真人试用或发布。

~~~text
继续“学生事务管家”识别优化独立支线，完成 D21 遗留的来源级核对验收，可记为 D22 收口包。
工作区：C:\Users\Winner\.codex\worktrees\student-affairs-candidate11\比赛
分支：codex/e2-candidate11-blind-eval

先核实际 HEAD、upstream、远端和用户改动；以 D21 最终结果为基线，不回滚历史。读当前 AGENTS、PRD 相关章节、CURRENT_CONTEXT、PROGRESS_POLICY、路线和 D21 三份结果证据。运行只读历史、冻结文件、账本与 D19 诊断校验，记录实际账本哈希。旧 D17 原成绩和旧 Expected/raw/身份/锁文件不改。

目标是完成 D21 浏览器 A—L 中仍缺的真实路径，而不是再生成候选或准备 24 个请求：
1. 在最终隔离构建中注入检查点写失败、正式提交后独立读回失败，核对输入保留、准确状态、手动恢复和幂等。已有正式事务失败/重试证据也在最终构建回归。
2. 两标签不同字段都能在保留 CAS 的条件下提交；同字段、关系和真实 SourceVersion 冲突展示编辑前、最新、我的输入。过期清理和过期选择不能删除较新或异作者输入；相关事实重新核对，无关项可保存。
3. 材料、动作对象、条件、依赖、修订、事件起止时间逐类完成“编辑→关闭/刷新→恢复→正式提交→独立读回”；未知时间保持 null 和 rawText。双匿名身份分别核对来源、草稿、历史、任务/事件全图隔离。
4. 页面测量需把真实 editId、检查点版本、草稿操作、commitId、独立读回连起来；对失败、退出、未闭合区间、缺 commit/readback、阅读/编辑/等待/隐藏做正反例。旧 D20 与当前路径仅在同一匿名场景实测后报告必要步骤差；没有旧路径数据就写未测。
5. 用当前构建完成 A—L 表逐项验收，保存页面和独立库事实值、数量、失败证据。浏览器工具若不可用，记录原始阻碍与 NOT_RUN，不能用单测替代。

授权本地实现、匿名夹具、隔离库、旧录制回答只读回放、离线故障注入、实际浏览器、测试、必要文档、Conventional Commit 后立即普通推送。普通工程问题自行修复。业务模型 0 调用、grant/reserve/settle 0、账本只读；不读 Secret 明文、不动旧用户库、不新增依赖或升级 Workspace v8、不做真人、不换默认、不合并不部署，不改历史冻结件。

运行定向测试、lint、test、build、security、隔离和历史保护至确定退出；旧 D9/C11/RCO-5-007 失败单列，不改旧断言凑绿。更新一个结果入口、短交接、路线与现有索引，代码和结果按清晰交付边界各自提交推送并核对远端。

只有保存安全、冲突、恢复、测量和最终构建 A—L 均有证据，才标 REVIEW_SESSION_READY_FOR_AUTHORIZED_EXPLORATORY_TRIAL。否则列具体代码位置、用户影响、失败证据与最小剩余动作，不把工程回放冒充真人指标。受限真人探索仍需独立的负责人、范围授权与参与者同意；本包不开展。
~~~
