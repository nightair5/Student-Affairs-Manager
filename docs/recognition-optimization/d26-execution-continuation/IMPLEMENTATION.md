# D26 冻结比较执行接续

本轮只补执行和报告工具，不改变产品运行时、候选、请求、参照、v10评分或选择规则。用户首次准确率仍待真实新输出；本目录不是新批次，也不创造付费许可。

## 固定输入与隔离

- 主分支：`codex/e2-candidate11-blind-eval`，保留D27当前产品。
- 原比较快照：`4699d5cfdd6211299d9ab82ef7000d99fc8fe8f8`。
- 管理的快照工作树：`C:/Users/Winner/.codex/worktrees/student-affairs-d26-frozen/比赛`；仅现有node_modules目录联接，无安装、无依赖或锁变更。
- 批次：`D26-C17-C18-DEVELOPMENT-R1`，8份已见D25来源×两臂=16，4AB/4BA。原Manifest和身份SHA见[预算卡](BUDGET_AND_AUTHORIZATION.md)。
- 当前D27组件与原比较有6文件差异。宿主逐次校验原145组件、7产物、16requestSha和identitySha；不让Manifest追随当前App重写。

## 真实执行路径

入口为 `scripts/d26-execution-host.mjs`；复用原快照 `d26-executor.mjs`、既有受保护凭证/固定代理传输和Windows排他账本追加器。宿主仅在授权有效、HEAD已提交且远端一致、账本链与基线一致后，允许创建一个本批grant。

每次派发在跨进程锁内重读磁盘状态，按ordinal执行reserve→发送前状态→一次发送→原始HTTP正文、response SHA与usage→settle。重复启动、身份漂移、未知预留或发送/写raw/结算异常全部停发；保留HALT及锁，不自动删锁、不自动重试。缺usage按完整单元上界保守结算后也停发，不能继续消费后续许可。

本机执行目录固定为主工作树 `.data/d26/execution/`。未来获明确许可后才建立：`USER_AUTHORIZATION.txt`（原话）、`PRICE_EVIDENCE.json`（当次官方核价）与`AUTHORIZATION.json`（绑定原话/价格SHA、已推送HEAD、16identity/requestSHA、账本基线、费用硬上限、唯一grant）。当前没有建立这些授权文件、STATE或grant。

价格证据不仅核SHA，还逐字段核对实际计费参数。真实响应在落盘前检查正文和元数据中的凭证反射；只拒绝，不涂改raw后冒称原始回答。Secret仅由已有服务端环境机制在实际派发分支使用，核验/只读报告/离线假传输不加载凭证。

## 当前可直接运行的只读命令

在主工作树运行，PowerShell：

```powershell
$d26Snapshot = 'C:/Users/Winner/.codex/worktrees/student-affairs-d26-frozen/比赛'
node scripts/d26-execution-host.mjs --verify --snapshot $d26Snapshot
node scripts/d26-execution-host.mjs --resume-read-only --snapshot $d26Snapshot
node scripts/report-d26-execution.mjs --snapshot $d26Snapshot
```

`--prepare-authorized`和`--dispatch-next`是未来获准后的动作；当前无授权时机械拒绝，不建立执行目录或锁。每次只派发一个单元，无隐藏循环或补跑。中断后先`--resume-read-only`；它可在旧核价过期或HEAD已移动时取证，但不能据此派发。任何不确定由人核对原始证据，不自动把“没有raw”当作没发送。

## 只读比较报告

`report-d26-execution.mjs`先核宿主状态、完整权威账本和raw，再固定16单元/每臂8来源。无执行状态且无该批账本事件才报告NOT_RUN；孤立账本、锁、HALT或身份不一致保留未知。16个确定结局且无封存时，子进程在原快照cwd运行冻结评分器，前后只读状态一致才输出报告。

分别输出原回答评分、公共转换后首次展示评分和人工结果缺失。原回答评分仍经过原解析器/公共adapter，并非独立人工评审；C18实验组件还包含wire/单向关系转换，不能把整包差异只归因Prompt。标题、自由描述及教学例泄漏未经真实人工核对的部分另标NOT_ADJUDICATED。参照属于single-author/model-assisted/provisional，不能推出真实用户总体正确率或泛化能力。

失败和未知不删除分母；不新增净增2或100%门槛。未调用时首次正确率为null/NOT_OBSERVABLE，不是0%。实测usage、保守结算和供应商实际扣费分列。

## 产品复用边界

未改App、ReviewSession、DomainCommitPlan、Repository和D27安排；保留其[已验收浏览器范围](../d27-planning/BROWSER_EVIDENCE.md)。本轮没有新模型回答，故新录制→首次展示→确认保存→独立读回验收为NOT_RUN，不用旧录制或工具单测冒充新结果。获准生成后直接在同包接续该实际路径，不再建立另一套实验或产品底座。
