# RCO-5-007 新鲜对抗审查

## 结论

`TECHNICAL_PASS_ZERO_CALL_REPLAY / NO_PROMOTION / RCO-6 BLOCKED / DO_NOT_LAUNCH`

本轮的职责拆分是正确方向：模型只交候选锚点，本机决定任务边界、语义、`requiresAction` 和默认勾选；12 个 B1 旧结果均能通过新契约，Forbidden Default 为 0。它只允许申请一批新的未见数据验证，不能作为识别率提升或上线证据。

## 主线检查

1. **是否仍让模型作最终决定：否。** `reduceModelCandidate` 丢弃模型的 requiresAction、semantics、inferenceLevel、effect、revisionRefs 和 selected；最终输出记录 `modelAuthorityFieldsUsed=[]`。
2. **是否把复合动作一律粗暴合并：否。** 只合并同 scope 的本地“主动作+保存”、携带+核验或完全重复锚点；同 scope 的“核对+发送”对抗样例仍拆开，发送不得默认。
3. **是否统一否定、条件、时态和修订：是。** 否定统一取消且不选；未触发条件不形成当前任务；命令统一 future；旧要求保留为 superseded/cancelled 并指向新项。
4. **说明是否冒充任务：否。** 共享材料只附着任务，引用、事件、征询、未发布和限制保持 observation。
5. **评分器是否可能静默漂移：已加硬门。** 预测器、评分器及本地传递依赖、B1 输入和保护件共 23 个路径写入 SHA-256；预测和评分开始前复核，任一不一致即停止。Expected 从 source-only 预测输入中物理移除，只由后置评分器读取。

## 主动寻找的反例

- 伪造模型 semantics/effect/requiresAction：缩减层输出不变。
- 调换同 scope 动作顺序：主动作仍按原文顺序确定。
- 否定动作对象引用了前一 scope：不借用前文自由证据，退回当前动作表面且保持不选。
- 同 scope 同时出现本地核对和外部发送：不合并，发送不选。
- 篡改外部任务 selected 或 requiresAction：本机校验报错并停止。
- source-only 输入夹带 Expected、runner 出现 fetch 或 DeepSeek Secret：零调用审计测试直接失败。

定向契约/变形测试 `12/12 PASS`，运行完整性测试 `4/4 PASS`。

## 仍未解决的主风险

- **已见数据偏差：** 规则就是针对 B1 暴露的问题制定，再在同一 B1 回放；100% 任务 F1 主要说明修补方向覆盖了这些已知故障，不说明新通知也有 100%。
- **答案来源偏弱：** B1 是匿名合成、单一 Codex 作者 Expected，不是独立双人标注，也不是真实学生材料。
- **模型漏锚无法补救：** 本机层能重组错误锚点，但模型完全漏掉一个动作或 scope 时，仍可能漏任务。
- **有限动作表：** 未知同义词会失败关闭、不得默认，安全上较稳，但可能降低召回；不能继续靠补词表自称根治。
- **回指只覆盖确定模式：** 复杂跨段材料、地点、例外和修订链仍需新的未见对抗集验证。
- **口径差异：** 新政策与旧 Expected 有 3 个完整语义组合差异，因此 Complete Task Case 为 83.3%，不是 100%；差异已透明保留，未改 Expected。
- **指标不可直接相减：** 旧 B1 是 fail-closed 图评分，新回放是任务形成评分；两套数不能用来宣称“提升 31.5 个百分点”。

## 下一门

下一步不是接 RCO-6，也不是部署，而是冻结一批从未用于定规则的匿名 Development/挑战集，预先锁定 Expected、政策版本、scorer、模型调用上限和人民币上限。用相同模型只产候选锚点，再比较“旧编排”与“RCO-5-007 本机层”的任务 Recall/Precision、requiresAction、语义、Complete Task Case、Major Correction、Safe Default 和 Forbidden。只有新数据仍稳定获益且安全不退化，才有资格讨论 RCO-6。

