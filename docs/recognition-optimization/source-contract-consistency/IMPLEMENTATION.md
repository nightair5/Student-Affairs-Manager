# 三类证据根因及代码路径

代码 `69c7baff71b59f0df8e48ffab4ccf264e8865d7d`。旧 C18/sourceFactsV3/scorer 原字节不改；本轮不是新候选成绩。

| 根因与用户场景 | 原错误层 | 本轮机制 | 反例与边界 |
|---|---|---|---|
| coverage null 混合“没有”和“尚未交代”，已有事实仍被拒绝 | wire 定义/生成约定/转换 | `src/recognition/sourceContractV4.ts` 新 Schema 与生成说明使用四态、实体 ID、scope 证据；新 Schema 不允许 null；legacy 有关联实体才 present，否则 unknown 局部冲突 | null 无实体不生成事件；unknown 不改 not_stated；明确没有需原文依据；同原文的错对象/漏事实仍不能因结构通过被判正确 |
| 主实体与材料/时间引用挤在同一列表，合法附属引用触发整份拒绝 | 原 accounting/compiler | `primaryEntityIds/secondaryEntityIds` 分开，主实体必须真实、类型正确、引用该片段；附属实体须同片段且有显式归属边；信息/未决索引从权威逐片段表生成 | 假 ID、scope 当任务、错类型、跨来源/片段、不相关附属时间、缺主实体、旧全局索引与表任一方向矛盾均拒绝。无补事件/关系 |
| 前置完成/资格/可开始、任务截止/事件端点混淆 | 生成事实/普通表示/确认提示 | 新契约 true 前置须另有已完成证据，“完成后”不能证明已完成；普通卡说明等待，资格未知继续冲突。`sourceReviewD26.ts` 事件端点类型局部校验；`OrdinarySourceFacts.tsx` 编辑用原 result.createdAt | 未完成不写 true；保存待办不等于可立即开始；错误事件端点不接受，也不改掉任务截止。材料格式、命名、完成标准保存并独立读回。取消/替代完整语义仍受普通表示限制 |

这些结构与确定性检查不能穷尽自然语言真值。例如 false/unknown、材料对象和 S08 争议仍需原文语义判断；没有修改 scorer 或让程序推测缺失答案。true 证据检查是有证据的保守阻断，不声称覆盖所有合法完成表述。

## 生成、转换与产品链

`buildSourceContractRequest` 使用实际新 Schema、版本化系统说明、已有 referenceTime/timezone，返回 `dispatchAuthorized=false`。这是生成机制组件草案，不是冻结候选或派发身份。本轮未分配候选编号；编号检查未发现 Candidate19/20，但没有用它们。任何后续候选都须另查当前占用情况、版本化并在新输出前冻结。

`decodeSourceContractRecording` 对 C18 只读声明投影→新契约校验→原 assembleSourceFacts→公用 wire/schema/adapter→普通事实桥。C17 原 wire 通过同一普通事实桥，并保留其 unknown 覆盖阻断。差异化声明转换有审计，不声称两种原 wire 相同或原答独立裁决。`declareLegacyRecordingV4` 不修改输入对象或 raw 文件，不消除缺实体/矛盾。

`scripts/report-source-contract-replay.mjs` 固定 16 单元，核 request/response/source SHA 和原 raw 文件 SHA；原评分、新可展示性、已转换内容、原公共适配、争议分别保存。`--verify` 只读重建比对，不访问 provider、账本或授权写入口。

`scripts/serve-d26-recorded.mjs` 的显式新模式复用录制服务；默认旧模式保留。新的普通环境只注入固定录制 provider，底座仍是 CapturePersistenceService/App/ReviewSession/DomainCommitPlan/CanonicalWorkspaceRepository。最小安排不变，默认生产候选不变。5 种工程夹具明示非模型输出，不能混入 16 个模型分母。

录制原文/原响应/SHA/原时钟先存 RecognitionRun；可逆 scope 映射、转换/覆盖/首次显示审计存 sidecar，用户修改存 ReviewSession/草稿及领域历史。确认使用单一 IndexedDB 事务与 CAS；独立 reader 重新实例化 store/repository。读回失败保留 receipt，只重读，不重复提交。故障注入先克隆事务前值，否则被 callback 修改的对象可能令故障判断失真。

`DraftReviewPanel` 保留旧 recognitionDescription API，普通环境另供版本说明；事件数量与待办数量分列，等待/阻断与“下一步”分开。`App` 不再把未明确的时间覆盖显示为原文没有截止。没有重建平行保存或安排算法。

## 独立写法与风险证据

`sourceContractV4.test.ts` 18 例包含 5 个来源作者构造的正例、同义/顺序变化、最小引用/类型/条件反例、真实 Schema→adapter→普通页面 SSR→正式确认→独立 repository 读回。数据是 provisional 工程材料，不是独立人工真值。固定模型 raw 全部只读；对两臂保留来源、错误、未知和固定分母。

已知仍未修：C18 S04/S08 两份重复覆盖表达矛盾，S05 主实体依据错，S06 缺事件；S03/S07 的无实体 null 未能证明原文无此类事实。C17 自身材料/条件/办理时间错误不因为可展示而消失。普通正式字段尚无法无损表示全部取消/替代及事件-任务语义关系，相关项保持阻断。下一步需改生成契约的效果验证，而不是把这些项转成默认成功。
