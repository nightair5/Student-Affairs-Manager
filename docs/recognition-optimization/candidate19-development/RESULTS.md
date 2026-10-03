# 新生成契约、普通产品修复与最小配对冻结

2026-10-04。状态：`NEW_GENERATION_CONTRACT_LOCAL_DELIVERED_WAITING_FOR_BATCH_AUTHORIZATION`。本地产品与实验冻结已交付，**新比较12/12 NOT_RUN，不能报告Candidate19首次准确率提高**。本批业务模型/grant/reserve/settle均0，账本只读，未开展真人或发布。

工作区candidate11/比赛，分支codex/e2-candidate11-blind-eval。代码三次提交均立即普通推送：`030276d51f394d8b5bb918fe90b7637fa0be7f8d`、`23e7b24b5ead72d6663451e26c8d17330b767b06`、最终代码`ce97b325f38897e87a55b63ddaea9470e8ea4156`。文档/冻结交付HEAD由最终现场Git核验，运行构建不与后续文档HEAD混用。

## 用户现在少卡在哪里

Candidate19实际请求使用explicit-source-contract-4.0.0的生成Schema、四态coverage、主实体/附属引用与单份scopeAccounting，更新candidateVersion和promptVersion；不是只追加Prompt提醒。已有实体不能再靠null或重复声明表达；未知资格、前置完成、可开始状态分开，缺主实体、错类型、跨scope或图冲突仍拒绝。材料格式、命名及办结标准回归。旧C17/C18和默认候选不变。[实际代码与边界](IMPLEMENTATION.md)。

普通App的收件箱、待确认队列、首屏按canonical处理身份同时显示任务和事件。纯事件刷新后仍显示“核对0项任务、1个事件”，不会被当作已处理的纯信息。未选择的事件保持待确认，部分确认不自动拒绝其余事项。实际浏览器发现恢复后的事件输入会被重新打开编辑覆盖，已修复：共享buffer存在时先保存或明确放弃，接管恢复后无需再改字即可保存。原子事务、CAS和独立读回继续复用。

RecognitionRun记录实际录制候选、原Prompt、构建、来源referenceTime与工程角色。模型原答、候选转换、第一次展示、用户修改分别保留，工程夹具不冒充Candidate19模型输出。现有D27最小安排、原截止/个人计划分离不改，没有扩大为全局计划器。

## 首次准确率：现在能说什么

| 证据层 | 分母与结果 | 可以得出的结论 |
|---|---|---|
| 原D26实际模型比较 | C17确认整份0/8，7错1UNKNOWN；C18原冻结管线8拒绝；EVIDENCE_INCOMPLETE | 原结果不动，原许可耗尽 |
| 16份旧raw新转换诊断 | C17可展示8/8，其中4待核对；C18可展示4/8，其中2待核对、4拒绝 | 程序兼容证据，不是新模型准确率 |
| 本轮普通页面回放 | 6个新工程oracle；另回放旧C18 S01/S02，保留S05拒绝 | 已有事件/时间可直接展示、保存；缺主实体仍拒绝，不替模型补事实 |
| 新C17/C19配对 | 6来源×2臂=12，全部NOT_RUN；各臂整份正确率NOT_OBSERVABLE | 还不知道新生成契约是否改善实际首答 |
| 真人四指标 | 没有真实范围、负责人接受、同意与裁决 | 全部NOT_OBSERVABLE，不称真人省时或成熟上线 |

[机器可检查零调用报告](ZERO_CALL_REPORT.json)分列冻结解析/编译后的原答契约、人工前首次展示、人工最终处置。原答契约分数不是独立人工原答真值；参照为single-author/model-assisted/provisional。争议、未知、失败保留固定分母，标题/自由描述/泄漏未经实际核对不写0。

## 实际页面与保存证据

唯一推荐内部入口：**http://127.0.0.1:6813/**。固定录制/匿名夹具，实际构建`ce97b325f388 / source e2c33d4806d9`，新隔离库`rco-mainline-01-02-i1-d27-plan-recorded-c19final1004c`。实时请求机械关闭、仅回环；旧6809等入口和库未动。

最终独立Repository读回：10来源/10执行/10草稿，**Task5、Project0、Event6、TimePoint10、Material1**。包括6工程场景、2旧C18合法录制、1旧C18真实拒绝及1额外检查点失败工程回放；不是10个模型样本。资格未知的第三任务仍未确认，额外事件草稿未正式确认，拒绝来源保留failed。[浏览器逐场景与失败恢复](BROWSER_EVIDENCE.md)、[完整匿名canonical](evidence/final-canonical.json)。

三类故障实测：检查点失败保留输入、手动重试；正式事务失败没有半份正式事实、手动重试；提交成功读回失败保留commit并禁重复提交，只重新读回，数量不增长。刷新恢复、依赖部分确认、材料/时间关键值均核对。

真实页面editId→checkpoint history→commit→独立readback已串通，恢复/重试不重复记纠正。完成的只读场景主动编辑0；刷新/未闭合区间保留null及缺失原因。保存成功不算语义正确；measurement3.2/low-edit-v2原样，工程回放不进入真人指标。

## 新比较确实冻结了什么

批次`C19-C17-C19-DEVELOPMENT-R1`，Candidate17 vs Candidate19，6个新匿名Development来源/12身份，3AB/3BA。模型deepseek-flash、Responses、temperature0/reasoning.none/stream.false、8192输出上限；固定原文、referenceTime/timezone、公共首次层、v11评分和分层选择规则。Expected不进请求，身份保持dispatchAuthorized=false、NOT_RUN。

覆盖：2份无任务事件/不同精度时间；2份资格/前置/否定与有效控制；1份精确截止+材料+办结标准+独立事件图；1份普通无时间任务。不同表达、顺序不变性、主实体遗漏/已完成假值/错对象/错时间类型等最小反例先通过Schema→adapter→评分→首屏→Repository。对两臂对称，不输出后挑样本。词面重合检查无逐字相同，最高trigram Dice约0.136，工程已见合成Development，不能称独立Holdout。

- Manifest SHA：`794f0949a3342f0fbad6a70cb5916e69bf7f447757260bf2aae78398fef47c79`。
- 身份文件SHA：`7d969f0aeb216bd158fc2a32346a5b1863fa189e5b206386be2205bd5708a5e0`。
- 生成代码锚点：`ce97b325f38897e87a55b63ddaea9470e8ea4156`。
- [Manifest](MANIFEST.json)、[12身份](PREPARED_REQUEST_IDENTITIES.json)、[provisional参照](REFERENCES.json)、[正负往返](ROUNDTRIP_RESULTS.json)、[预注册](PRE_REGISTRATION.json)。

执行器只做版本化批次/数量参数提取，复用D26持久锁/receipt/发送前状态/raw/usage/settle协议。离线假传输12单元与13个故障位置验证一次发送及封存；实际无授权prepare/dispatch均在任何凭证读取/建目录/账本写入前拒绝。本批本地execution目录不存在，raw/receipt/锁/grant均0。

## 最少下一动作与剩余边界

本轮官方核价快照的保守最坏预算**US$3.892848**，建议新批硬上限**US$3.90**；不是实扣。新调用usage和供应商扣费NOT_OBSERVABLE。[具体预算与唯一授权文字](BUDGET_AND_AUTHORIZATION.md)。若随后明确授权，重核价/身份/链/同步HEAD后直接执行该12单元并逐来源比较，不另造准备阶段。状态不确定停后续，保留现场与分母。

新生成效果尚未测出；普通取消/替代完整语义仍有表示限制并局部阻断，S08原材料争议未决。实际回放保留零任务事件，但首页/日历精确与模糊事件展示、持续偏好/增量安排尚不在本轮完整验收范围；不暗示已接通知/日历外发。

[验证](VALIDATION.md)：定向53项通过，最终产品9组通过，954测试通过/1跳过；完整39组33通过6历史失败，lint0错误8既有警告，build/scan通过，audit5high/2moderate未修。84保护/119冻结/7归档、原D26 145/7/16与raw16原样。账本前后971行，同SHA`7b1d1935254a7d7830e1d03892d12895707b71107dfc1bfb611f3459e839367d`，没有新行。没有真人、Holdout、默认替换、合并或部署。
