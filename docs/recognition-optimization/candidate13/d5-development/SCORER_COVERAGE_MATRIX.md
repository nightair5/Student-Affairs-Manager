# D5 v4 评分覆盖矩阵

`candidate13-scoring-4.1.0`是新的 Development 评估器。D4 Candidate13 的 Prompt、请求构造和原v3绑定均不改；D5 Manifest 会另行记录新评估绑定。

| 参照义务 | 预测投影 | v4判定 | 严重度 | 已见回归 |
|---|---|---|---|---|
| 动作+对象及别名 | `action.surface` + `object.surface` | 只允许预先登记别名；多个最大匹配直接待裁决 | 任务层 | 同名义务歧义 |
| 状态、有效性、actionable、条件 | `semantics` + `condition` | 精确相等 | Critical Major | true/false/unknown |
| 完成标准 | `completionCriteria` | 严格集合相等，无据增加也失败 | Major | 凭空增加另行审批 |
| 材料名、必需性、格式、命名 | `materials` | 按任务归属的结构化严格集合相等 | Major | PDF→DOCX、required反转、无据材料 |
| 时间原文、归一值、类型、精度 | `timePoints` | 按任务归属的结构化严格集合相等 | Major | 精确/模糊/未给出 |
| 依赖 | `dependencyTempIds` | 端点转换后严格集合相等 | Major | 凭空增加依赖 |
| 修订、取消、替代 | `revisions` | 类型+新端点+旧端点+effective严格相等 | Critical Major | 多端点与跨对象 |
| 禁止推断 | 匹配任务的结构化字段 | 真正执行`equals/contains/setEquals` | Forbidden | 无据审批要求 |
| 空任务 | `tasks=[]` | 只有完整参照、0 FP、checks通过才完整正确 | 整份 | 正确无任务 |
| Schema/解析失败 | adapter后结果 | 必须显式传入`schemaValid=true`；失败保留预期任务FN | Severe | 不传Schema验证 |

参照合同尚未表达材料数量和提交渠道的可接受变体，而现有模型输出时间实体不表达独立`actionable`字段，因此v4不对这三项做伪精确评分；限制进入能力缺口，不通过改生产Schema规避。
