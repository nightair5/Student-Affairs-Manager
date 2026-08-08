# E2-F Complexity Router

`recognition-router-1.0.0` 使用正文长度、时间表达数量、动作词数量、列表结构、更正语义和条件适用语义进行确定性分级。相同输入始终得到相同 simple / medium / complex 结果与理由。

simple 和 medium 使用单次 Recognition；complex 的候选策略是 `fact_then_plan`。两段式第一步只能产生逐字事实清单，第二步才生成 RecognitionResult 2.0。为避免未经证据增加延迟与费用，`twoPassEnabled` 默认关闭，当前 Worker 继续选择 `single_pass`。只有 E2-I Holdout 对照证明复杂样例净收益后，才能显式开启。

路由结果作为响应元数据返回，不写入 Domain，不修改用户确认结果。本阶段没有更换模型、没有部署，也没有进入 Project Matching 或 Follow。
