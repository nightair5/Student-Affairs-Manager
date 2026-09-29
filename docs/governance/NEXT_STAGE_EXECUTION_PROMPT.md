# 下一工作入口：D21 核对会话收口与可测量探索前置

本文件是工作计划，不授权业务模型调用、真人试用、默认替换、合并或部署。具体已完成/未完成见 [D20结果](../recognition-optimization/d20-review-session/D20_RESULTS.md)。

~~~text
继续“学生事务管家”识别优化支线，执行 D21。工作区 C:\Users\Winner\.codex\worktrees\student-affairs-candidate11\比赛，分支 codex/e2-candidate11-blind-eval。先核 HEAD/upstream/远端/工作区，保留用户改动；不要回退 D20。

目标是把 D20 的 PARTIAL 用户路径收成真实可操作、可验收的来源级核对：材料、动作/对象、条件、依赖和修订关系编辑接入同一持久 ReviewSession，刷新/双标签冲突选择不丢输入；事件冲突显示可读字段和即时恢复；正式事实仍经原 DomainCommitPlan 单事务保存、独立读回和 CAS。重点验证双任务等待前置、坏修订相关项阻断且无关项保存、无任务归档、拒绝多余项、保存失败手动重试、双身份隔离。每项在新隔离端口/数据库实际浏览器走通，失败如实记录；不要用 D19 旧证据冒充 D21。

把页面实际 editId→未确认检查点→commitId→readback 接通，语义字段与内部联动变化分开，manual 与 assisted 分组，保留失败/退出/缺失和中位数。冻结探索脚本、来源 SHA、辅助刺激 SHA 与负责人空白裁决记录；没有真人授权与真实材料时四项真人指标继续 NOT_OBSERVABLE。

只读保护历史与账本，不改 D17 冻结结果或旧锁；本包不新增模型调用、grant、账本写入、真人试用、默认替换、合并或部署。运行定向反例、lint/test/build/security、隔离检查与完整浏览器验收；旧 D9/C11/RCO-5-007 失败单列，新失败修复。更新一个 D21 结果入口、短交接/路线/索引，Conventional Commit 后立即普通推送并核远端。只有关键浏览器与测量链都通过，才写 READY_FOR_AUTHORIZED_EXPLORATORY_TRIAL；否则继续明确 PARTIAL、代码位置、用户影响与剩余步骤。
~~~
