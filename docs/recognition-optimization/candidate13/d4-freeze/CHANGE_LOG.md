# Candidate13 变更记录

相对Candidate12：

- 增加当前性与言语行为联合准入，进一步阻断否定、禁止和附属事实冒充任务。
- 明确false/unknown的语义保留与不可执行边界，禁止生成“确认条件成立”任务。
- 把多端点取消/替代改为先列端点、再逐对连接的检查顺序。
- 明确跨对象合并禁止及同对象合并的证据条件。
- 增加材料、时间、依赖和完成标准的归属复核。
- 增加召回防规避规则，防止以漏项或全量unknown降低Forbidden。

未改变：模型、Schema、adapter、Workspace v8、candidate03、Candidate12、默认候选、D3契约、6633入口、Preview和Production。

所有变化只依据已见D2 Development错误族。D2来源与输出不能再次用于证明Candidate13提升。
