# D7 R5 同系列工程审计

结论：`FAIL_FOR_DEVELOPMENT_DISPATCH`。审计员未参与本轮实现，但仍为同系列模型；本报告不是独立人工真值。审计对象为冻结提交 `c1598c6` 与 R5 Manifest SHA-256 `3513b4f7842d7992b65d850057f18bac91424de77d773236d7c51ecb11c0bfed`。审计发生在任何新授权或模型派发之前。

结构检查通过：冻结的 14 个组件哈希、84 份保护文件、791 行只读账本一致。R5 有 12 份来源/参照、24 个唯一请求身份，两臂各 12，6 组 AB/6 组 BA；所有身份 `dispatchAuthorized=false / NOT_RUN`，请求体没有 Expected。生成器和候选先于 R5 作者文件冻结，重合检查最高 3-gram Jaccard 为 0.2099。上述只证明准备结构和来源时间顺序，不能证明参照语义或评分公平。

决定性反例：R5 S09 的独立事件时间在保留原文与 scope 后，改为 `event_end / 1900-01-01T00:00 / UTC / isAllDay=true / precision=vague / needsConfirmation=false`，5.5 评分仍给出 `complete=true / major=0`。另外，Prompt 对无当前任务来源要求全部信息 scope，但评分器只允许 `kind=information` 的 scope 进入 `informationScopeIds`。R5 S07 的包装限制与完成标准分类、S12 的待公布时间表达也未裁决。信息类事实仅核验 scope，不核验具体语义。

因此 R5 Manifest 和全部 24 个零调用身份均在派发前失效，不能通过调整分母、Expected 或门槛补救。R5 来源文字仅进入已见排除库；需要重新设计合同、审计和冻结，再生成新的来源。模型调用、grant、reserve、settle、账本写入、真人试次均为 0。
