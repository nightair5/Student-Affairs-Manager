# RCO-5-005-B0.1 零调用修补契约

## 目的与边界

本轮只修复 B0 已确认的提示词、输出结构、调用编排、计分与 checkpoint 缺陷，使下一轮新数据实验具备可解释性。它不重算 B0，不修改既有 Expected、freeze、dataset、checkpoint、result 或 cache，不接入稳定路径，不部署，也不调用模型。

- candidate model: `deepseek-v4-flash-vision-exp`
- candidate endpoint: `POST https://api.deepseek.com/responses`
- candidate API style: `Responses API + text.format.type=json_schema`
- candidate temperature: `0`
- current model calls / Repair / network dispatch: `0 / 0 / 0`
- new Development dataset: `NOT_CREATED / NOT_FROZEN`

DeepSeek 官方 Responses API 文档列出了该视觉实验模型，并说明 `text.format` 可使用 `json_schema` 约束输出；本轮只据此构造候选请求，没有做在线兼容性或认证验证。官方同时说明 Responses API 为无状态接口，所以每个独立调用必须携带自己的完整契约，不能再写“与上一臂一致”。

## 修补后的主链

1. facts-first、命题图、复核器三个独立提示词分别完整内联 actor、语气、极性、时态、状态、有效性、强制程度、推断等级和动作效果枚举。
2. 三种输出都使用 `additionalProperties:false` 的完整 JSON Schema；命题图用六种节点的 `oneOf` 区分字段位置。
3. 本地再次逐字段校验：原文范围、字符位置、节点类型、关系端点、证据顺序、指纹和 producer run 绑定都必须成立。
4. 命题图不合格时，复核器标记为 `skipped_upstream_invalid`，请求数保持 0；不能把“跳过”伪装成复核器自身失败。
5. 模型 Schema 任何层级都没有 `selected`。命题图单独结果永不默认勾选；只有复核完整、无遗漏动作、动作及其关联节点全部一致，并通过确定性安全策略时才生成默认勾选。
6. 计分直接读取 facts 顶层 `requiresAction`；无效案例的质量指标为 N/A；漏掉安全默认项进入 Complete Case、汇总和决策；未匹配假任务携带的时间、材料、事件、地点也计错。
7. 候选决策同时检查 Task Precision/Recall、requiresAction、effect、time、materials、event、location、Evidence、Complete Case、Major Correction、Forbidden 和 Safe Default，不允许只靠 F1 晋级。

## Checkpoint 规则

- 一条 `case × role` 只有一次 attempt；存在任何状态后均不得自动重试。
- `reserved`、`dispatched`、各终态分别使用严格字段集合，额外字段直接拒绝。
- 发出前记录 request SHA-256；成功回执必须同时记录 HTTP 200、Provider response ID、返回模型和 response SHA-256。
- “已发出但没有回执”保留为 `dispatched`，算真实请求且不可重试，不能被下次启动当作未调用。
- graph 不合格导致的 verifier 跳过没有 dispatch 时间或请求哈希，不计模型调用。
- checkpoint 绑定 run、dataset、freeze、plan、runner、三份 prompt、三份 response schema、provider、endpoint、模型、temperature、输出上限、计划调用数和创建时间。

## 运行入口

```bash
npm run eval:rco5:b01:verify
```

此入口只运行本机契约与对抗测试并打印候选哈希。传入 `--run` 或其他参数会失败；脚本自身没有网络调用原语。

## 晋级条件

本轮技术通过只允许进入“申请新冻结数据与新付费预算”的状态。它不证明模型正确率、图片/文件识别率、真实材料泛化、真人修改时间、浏览器体验或上线资格。
