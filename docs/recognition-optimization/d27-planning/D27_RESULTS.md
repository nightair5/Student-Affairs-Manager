# D27：最小自动安排已接入普通产品，首次比较仍未运行

2026-10-02。状态 `D27_LOCAL_SHARED_PLAN_DELIVERED_D26_COMPARISON_NOT_RUN`。本轮承接当前执行文件，不创建新候选或新请求批。实现提交 `104e7a85efa60b2798c2e566c059018ce91cdf24`，耗时说明修正 `3c56a7cb8e87c96f6348f59eb2851b4e11992533`；结果另提交，以最终 Git 为准。

用户现在可以在普通首页粘贴匿名通知，一次接受同来源任务、材料和独立事件；首页自动生成多项任务共用的个人时段，再一次接受安排。可以只改需要改的耗时或时间、锁定、以后再安排或撤回。原文截止始终另列。不是要求每个正确字段逐一重审。

唯一推荐内部入口：**http://127.0.0.1:6792/**。库 `rco-mainline-01-02-i1-d27-plan-final10`；构建 `104e7a85efa6 / source 191bcb02ddd6`，表示构建前 HEAD 和实际源码摘要。它对应本轮代码提交的相同源码，JS/CSS SHA 见 [最终构建](evidence/BUILD_FINAL.json)。这是普通 App 加匿名工程输入和折叠诊断，实时模型关闭，非真人。旧 6777 及旧用户库未动。

| 产品目标 | 已交付的实际行为 | 证据及限制 |
|---|---|---|
| 不必自己逐任务找空档 | 多任务共用容量，按截止/优先级/依赖稳定排序；避确定事件、课程和用户锁定时段 | [浏览器](BROWSER_EVIDENCE.md)；有限窗口、每任务一个连续段，不是全局最优算法 |
| 不把建议写成原文 | canonical `planned_start` 与原文 deadline 分开；时长/估计来源/锁定保存在受校验的版本元数据，结束由开始+时长推导 | 原 deadline `2026-10-06T16:00` 与模糊事件 `null` 未改变；[独立核对](evidence/CANONICAL_AND_MEASUREMENT_CHECK.json) |
| 不为了排满而编答案 | 无可靠耗时且拒用估计、容量不足、过期、循环/缺失依赖、资格未知、修订待核对均给未排入原因 | 确定时间不从“周三晚/未公布”猜出；锁定冲突保留并提示 |
| 失败时不用重填或反复确认 | 检查点手动恢复；事务失败无半份安排；已提交读回失败只重读；刷新恢复；CAS 差异、幂等、撤回 | 两标签无关备注可共存；关联稍后状态变化拒绝覆盖，保留输入 |
| 能看到真实使用成本 | 独立计划计量串 editId、检查点、commitId 和 readback；缺失不补0 | 仅工程操作；不是识别纠错率或真人四指标 |

最终工程库有 Task 3 / Project 0 / Event 2 / Material 1 / TimePoint 7，其中原文时间4、个人计划起点3，最终10构建有一笔明确安排接受历史。过程09构建两次明确接受产生两笔计划历史，每次读回恢复不重复提交、不加任务。固定活动10月6日10—11点，模糊停机时间保留 `rawText=周三晚 / normalizedValue=null / precision=vague / needsConfirmation=true`。另一全新隔离库的两任务、两材料场景独立验收，不能把跨库累计数冒充单来源结果。

首次正确率主线没有改成“排程做完就算准确”。D26 `D26-C17-C18-DEVELOPMENT-R1` 仍为 C17/C18、8已见来源×2、**16/16 NOT_RUN**，每臂0/8观察、8未知。原答首次正确、转换后首次显示正确、人工最终正确仍必须分列。目前不能给新候选正确率或提升幅度。D17原v7 C03 1/12、C17 2/12及 MIXED_PROGRESS 保留，旧诊断不是新模型成绩。

业务模型/探测/重试/repair/verifier **0**；grant/reserve/settle **0**；usage `NOT_RUN`，供应商实扣 `NOT_OBSERVABLE`。D26历史最坏内部上界 US$5.190464、建议硬上限 US$5.30 仅为旧卡，付费前须重核价。无本批新授权，不能复用D17许可。安排改动涉及D26旧组件图，因此旧活动验证器拒绝派发是正确保护；[只读快照核验](evidence/D26_SNAPSHOT_VERIFY.json)证明原145组件、7冻结产物、16请求仍可在原Git快照重建。不得回写Manifest追随新App。

四项真人指标全部 `NOT_OBSERVABLE`。只阅读的实际工程记录约29.8秒墙钟、29.8秒阅读、0主动编辑；手动重试恢复后的语义计划配置变化计1，刷新造成时间缺口为 `MISSING`、墙钟 `null`，没有伪造0成本。计划计量不回写measurement3.2/low-edit-v2，也不能把计划偏好变化当AI事实纠错。

验证：新增12条有正反例的领域/保存/测量测试通过；最终当前产品9组通过，Vitest 927 pass / 1旧skip；lint/build/security通过。全量34组30PASS/4既有历史FAIL，未宣称全量绿；audit仍5 high / 2 moderate。完整版本和日志见 [验证](VALIDATION.md)。84保护/119冻结/7归档、账本938行及 SHA `e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9` 不变，旧98行合法追加提示保留。

本轮实现和结果均本地提交。`PUSH_BLOCKED_AUTODEPLOY_BINDING_UNVERIFIED`：按[当前执行文件](../../governance/NEXT_STAGE_EXECUTION_PROMPT.md)“确认无副作用后普通推送”，Cloudflare Worker Builds 对当前仓库/分支的自动发布绑定尚不能只读核实；未推送、未部署，remote/upstream仍 `7b90b1e806919ea9a8fb02e6c62a9657499ee94a`。不把 Pages列表或手动Worker发布历史当作无自动部署的证据。

下一步直接接续首次比较：只读确认部署绑定，再将真实安全执行宿主绑定原D26快照和16身份，离线危险分支通过后，以新的明确批次许可执行并逐来源报告。无需再造候选、24身份或一套准备系统。真人探索可并行保留，负责人/范围/本人同意缺失不阻挡本地优化。长任务分块、增量重排、偏好学习及原生语义演进后续按真实场景推进；账号、提醒渠道、合并、默认替换、Holdout和部署不在本轮。

关联：[实现](IMPLEMENTATION.md)、[浏览器及复用边界](BROWSER_EVIDENCE.md)、[验证](VALIDATION.md)、[保护/许可状态](INTEGRITY_STATUS.json)、[证据原字节索引](evidence/EVIDENCE_INDEX.json)。
