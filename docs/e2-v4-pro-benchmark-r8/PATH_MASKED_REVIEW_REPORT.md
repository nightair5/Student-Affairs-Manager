# E2.9-R8 零模型匿名盲评报告

## 结果

有效第四轮状态：`R8_REPLAY_ADJUDICATION_FAIL`

新 Screening：`NOT REQUESTED`

## 实验范围

- 输入：R7 已冻结的16个 Screening observation。
- 对比：旧规范化结果与 R8 隔离 Planner 回放结果。
- 新增生产识别/生成模型调用：0；匿名标签由同族 LLM-as-judge 生成。
- Expected：未读取。
- 每个 observation 独立随机分配至 X/Y。
- 标签审阅者只读取匿名业务包，不接触映射、历史分数或模型身份。

## 匿名完整性

- Packet canonical SHA-256：`dec24a3191b9e0e79c8d063710062d16f741c8f72830353af5b9db79aeafa019`
- Labels canonical SHA-256：`03759c58f63c0f049e0514d9b29b8e5805a27bbd07f6196947a69e5b4ac4833f`
- A轮：固定 quality 值与内部 ID 前缀导致路径关联，作废。
- B轮：字段顺序、日期格式和描述风格导致路径关联，作废。
- C轮：内部歧义字段代码导致路径关联，作废。
- D轮：统一语义展示层，机器扫描与独立匿名审计均 PASS。
- 直接身份泄露：0。
- 确定性关联器：0。
- 16组标签完整且唯一，标签先冻结、映射后揭盲。

## 有效 D 轮揭盲统计

| 指标 | R8候选 | 旧流程 |
| --- | ---: | ---: |
| Preferred | 9 | 1 |
| Major Correction | 3 | 10 |
| Planning Error | 6 | 10 |
| Fact Loss | 0 | 0 |
| Over-splitting | 1 | 0 |

另有 TIE 6，INSUFFICIENT_INFORMATION 0。

## D 轮冻结 Gate

通过：

- 16组完整。
- 至少14组可判定。
- R8胜出差值至少3组。
- 旧流程胜出不超过3组。
- R8 Major Correction 不更差。
- R8 Planning Error 更低。
- 标签冻结早于揭盲。
- 无新增生产识别/生成模型调用、无 Expected 读取；审阅者调用单独披露为同族 LLM-as-judge。

未通过：

- R8 Fact Loss 必须严格更低：实际0对0，出现零损失天花板。
- R8 Over-splitting 不得更差：实际1对0。

## 解释边界

D轮有效盲评明显偏向 R8候选，但冻结 Gate 仍失败。不能事后把“严格更低”改为“不更差”，也不能忽略1例过度拆分，所以仍不能申请新模型 Screening。

## 下一步

只读分析唯一一例候选 Over-splitting；同时为下一轮预注册能处理 Fact Loss=0 天花板的新 Gate。若确有通用 Planner 修复，再使用全新包和标签复评。

Selection 未运行，Blind 未创建，Production 未部署。
