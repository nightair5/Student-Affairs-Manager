# D7追加式订正日志

D6历史结论仍为`REJECT_CANDIDATE13_DEVELOPMENT`；本日志不改旧raw、Expected、评分、锁文件或结论。没有计算“订正后正确率”。

- **D7-CORR-001 / REFERENCE_ERROR / D5R1-S11**：旧参照把“登记现场展示场地”缩成“展示时段”，且虚构取消/历史端点完成标准。
- **D7-CORR-002 / CONTRACT_UNREACHABLE / D5 references**：旧参照使用historical/cancelled等当前wire不可达组合。
- **D7-CORR-003 / SCORER_ERROR / v4.1**：task_deadline未完整映射，字段窄等义未预注册，一项任务未对齐时发生多字段级联。
- **D7-CORR-004 / ADAPTER_ERROR / D5R1-S05**：raw保留“暂定…下午”，旧时间适配却生成确定全天且无需确认。
- **D7-CORR-005 / OVERATTRIBUTION / D5R1-S11**：Candidate13实际保留四个端点和两条方向正确的替代关系，不再称其合并端点。
- **D7-CORR-006 / PRODUCT_DISPOSITION_ERROR / D5R1-S09**：正确无任务结果含事件/时间，但旧确认流程无法完成归档。
