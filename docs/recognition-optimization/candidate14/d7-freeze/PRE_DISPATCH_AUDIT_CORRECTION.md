# D7 派发前审计订正

2026-09-22，同系列 provisional 审计在任何 D7 请求派发、grant、reserve 或账本写入前否决了 Reference/Scorer 5.1 及其准备包。

- 失效 R1 Manifest SHA-256：`8e3775dfcd9e2c30d1d7de1a53181306c0810c9ac9494c6f033e57e407c49887`。
- R1 状态：`INVALIDATED_BEFORE_DISPATCH`；24 个身份均为 `dispatchAuthorized=false / NOT_RUN`，模型调用为 0。
- 原因：子串评分、空期望不检查额外事实、无任务事实未评分、Schema failure 聚合漏报、时间全天误标、无任务归档未绑定首次输出、测量暂停和操作去重不完整。
- 处置：保留本记录和审计报告；以 Reference/Scorer 5.2、time policy 1.1、no-task disposition 1.1、measurement 2.1 重新冻结。R1 数据文件未进入 Git，不作为实验输入或结果。

随后生成的 R2 也在任何授权和派发前被同系列 provisional 复审否决：

- 失效 R2 Manifest SHA-256：`7da51e3710a5682d8c24db95b0c67321c3c93dbabe7e5170da15ee6b0f5dc554`。
- R2 状态：`INVALIDATED_BEFORE_DISPATCH`；24 个身份均为 `dispatchAuthorized=false / NOT_RUN`，模型调用为 0。
- 原因：5.2 仍会折叠有意义符号、接受悬空材料/时间引用和错误 evidence scope；无任务事实与 scope 未完全绑定；首次输出锚点可随当前草稿重算；测量缺少持久注册和严格提交→读回状态机。
- 处置：升级到 Reference/Scorer 5.3、no-task disposition 1.2、measurement 2.2，先重新冻结提交并推送，再生成 R3。R2 文件未提交，不作为实验输入或结果。

旧 D6 raw、Expected、评分、锁文件和 `REJECT_CANDIDATE13_DEVELOPMENT` 结论没有修改。
