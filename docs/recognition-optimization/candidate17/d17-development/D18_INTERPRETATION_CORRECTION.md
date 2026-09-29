# D18 对 D17 结果解释的追加订正

日期：2026-09-29。性质：同系列模型辅助、只读、事后工程诊断，provisional；不是独立人工裁决或重新评分。依据用户全局审查请求，复核两臂原始回答、D16 来源/参照及 v7 实现。D17 原成绩 C03 1/12、C17 2/12、MIXED_PROGRESS 和所有原始文件保持不变；本记录不颁发晋级或调用许可。

## 需要纠正的描述

上一轮将 S08 直接称为“新增材料细节错误”、将 S10/S11 概括为“修订关系仍不正确”，没有区分评分失败与用户事实错误，表述过重。

- S08 C17 的“志愿服务签到证明”、PNG、数量、必需性和任务归属与参照一致。材料 scope 同时包含提交该证明的动作句和格式句，参照只允许格式句；不能据此说材料事实不准。C03 的 scope 较窄因而通过，不代表它提取了更正确的材料事实。
- S10 C17 的两个旧任务确实存在，取消类型、目标、from=null、effective=true 均正确；额外引用“两项都无需办理”被参照列入 contradictory，导致关系整体失败。C03 还把已生效关系记 effective=unknown；这一事实差异被 relationsPass 的单个布尔值掩盖。
- S11 C17 的两组新旧端点、方向、替代类型、生效事实也正确；多含“现调整为”“两项分别替代原要求”被 scope 白名单拒绝。C03 还存在 effective=unknown。C17 同时有 status=cancelled 与 validity=superseded，v7 优先取 cancelled；这属于生命周期表达/推导需裁决的问题，不能与端点不存在混为一谈。
- S04 已记录的匹配 ID 误报仍成立，见 [D17 事后诊断](POSTHOC_DECISION_AUDIT.md)。

## 原 9 个 Severe 标记的根因分层

这里数的是旧评分器的标记，不是九个独立事故，也不是修正后的错误分数。

| 诊断类别 | 旧标记数 | 证据 |
|---|---:|---|
| 确定的工程/事实问题 | 2 | S05 任务不引用时间、时间却引用该任务；S06 无事实依据将前置已完成写 true |
| 确定的契约/测量问题 | 3 | S07 Prompt 要 submission_deadline 而参照仅接受 task_deadline；S10/S11 正确关系被支持性补充 scope 拒绝 |
| 表示契约需裁决 | 4 | S08 将未知前置条件与派生 actionability 各罚一次；S11 两个旧任务 cancelled/superseded 优先级 |

不能用 9−3−4 生成“新 Severe=2”，因为新契约尚未冻结、其他真实风险还须覆盖。S09 C17 虽正确不建任务，却漏了“校车预约平台停机”事件和“周三晚”时间，只进入旧 auxiliary Major。这说明旧 Severe 总数也会漏反映实际用户风险。

两臂共 16 个 materialDetails 失败中，8 个仅 scope 不一致（C03 3 个，C17 5 个）。C17 另外 3 个是任务交付物是否同时作为材料实体的表示争议（机位安排表、摄影作品说明稿、数字版迎新路线图），不能直接算无据捏造。所有结论均为事后诊断，未产生新的整份正确率。

## 可复查定位

路径以仓库根为基准；行号对应 D17 结果提交 cba56be7d9a0b1940561d7560fe9a33067df1228。

| 证据 | 位置 |
|---|---|
| S08 C17 原始材料；C03/C17 关系原始值 | .data/candidate17/d17-execution/raw/15.json、19.json、20.json、21.json、22.json 的 rawHttpText → output 最后一条 → content[0].text；这些本机文件不在 Git |
| scope 白名单和关系总布尔值 | scripts/recognition-semantic-v7.mjs:33、46、114、119 |
| 材料对象名忽略与实体数严格相等的冲突 | 同上 :43、46 |
| 时间片段全文比较与单侧任务引用查找 | 同上 :38、42、58 |
| S08 材料参照；S10/S11 关系参照 | ../d16-development/REFERENCES.json:1759、2012、2188、2208、2579、2596 |
| S07 的 task_deadline 参照 | ../d16-development/REFERENCES.json:1333、1486；src/experiments/realInput01/candidate17.ts:15 要 submission_deadline |
| S11 生命周期优先级 | scripts/recognition-semantic-v7.mjs:11；candidate17.ts:11 只约束 validity |
| S09 真实漏事件/时间 | raw/18.json；../d16-development/REFERENCES.json:1812；原 SCORING_RESULTS.json 中 S09 firstOutputSummary |

原 SCORING_RESULTS.json SHA-256 仍为 559af444f357b1c2aed525b751d17603a6c821cd5a6b10aae98bdb8ee1c063dd。新路线应先统一事实、表示、依据与风险，再双臂离线重评分；真实条件错误、图不一致和事件漏提继续修。不得只放宽评分后宣布识别升级。完整原因与实现路线见 [D18 审查](../../../governance/d18-product-direction/REVIEW_AND_DECISIONS.md)。
