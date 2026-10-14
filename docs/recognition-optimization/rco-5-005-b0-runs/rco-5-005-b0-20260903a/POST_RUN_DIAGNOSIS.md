# RCO-5-005-B0 运行后诊断

## 结论

本轮按预注册规则判定为 `INVALID_RUN / NO_PROMOTION / DO_NOT_LAUNCH`。

36/36 次 API 调用都返回了可解析 JSON，但完整命题图 0/12 通过冻结 Schema，导致独立语义复核臂也为 0/12 可计分。它不能回答“命题图是否比 facts-first 更准”，更不能把命题图与复核臂显示的 0% 当成模型真实正确率。

## 已确认的运行事实

- 模型返回名称：36/36 均为 `deepseek-v4-flash-vision-exp`。
- checkpoint：36 个唯一 `case × role` 条目，facts-first、命题图、复核各 12 个；全部 `completed`。
- temperature：冻结执行器请求值为 0；API 响应不回显 temperature，因此只能证明客户端发送值，不能独立证明供应商内部采样实现。
- Repair / retry：0 / 0；每个逻辑调用只有一个 checkpoint 条目。
- 模型原始输出携带 `selected`：0。
- Token：input 25,535、output 8,954、total 34,489。
- 费用：Provider 账单 `NOT_OBSERVABLE`；按冻结峰值单价和 10 CNY/USD 保守换算为 0.2305468 元，低于 10 元上限。
- dataset 和 runner 当前 SHA 与调用前 freeze 一致；result 中的 checkpoint SHA 与实际文件一致。

## 失效的第一性原因

### 1. 两次独立调用之间存在不存在的“共享上下文”假设

命题图提示词没有列出 actor、speechAct、polarity、tense、status、validity、modality、inferenceLevel 的实际枚举，只写“与紧凑事实抽取一致”。但命题图是一次独立 API 调用，看不到 facts-first 的 system prompt。

模型因此在 12/12 命题图中稳定使用了自然但不合约的值，例如：

- `学院 / 就业中心 / 用户`，而 Schema 只允许 `addressee / addressed_group / issuer / third_party / unknown`；
- `positive`，而 Schema 只允许 `affirmative / negative / uncertain`；
- `active / valid / obligation`，而 Schema 分别要求 `pending / active / required` 等固定值；
- `question / assert / request / cancel / inform / declare`，而 Schema 使用另一套 speechAct 枚举。

这不是中文语义识别本身的 0% 证据，而是提示词没有把机器契约完整交给本次独立调用。

### 2. 命题图的字段放置规则缺少结构化约束

冻结契约要求时间、材料、事件、地点分别建立独立节点，再用关系连接；directive 节点不得直接填 `timeRaw/material/location`，event 节点也不得同时填时间或地点。模型却普遍把时间、材料和地点直接写在动作或事件节点上。

提示词虽有一句文字说明，但没有 JSON Schema 强制、最小/反例示例或本地预调用协议握手。`json_object` 只保证“是 JSON 对象”，不保证符合这套深层 Schema。

### 3. 复核器继承了无效词汇，而不是验证统一契约

复核提示词要求“其他语义枚举与候选一致”，因此复核器复制了候选中的非标准枚举。12/12 复核结果的 source/candidate fingerprint 均匹配，很多还报告 `graphCoverage=complete`，但 fingerprint 只能证明它审查了哪份候选，不能证明候选符合 Schema 或语义正确。

### 4. 执行器在命题图 Schema 失败后仍发起复核调用

当前执行顺序只要求命题图返回可解析 JSON，就立即把候选交给复核；Schema 校验发生在 36 次调用全部结束后的计分阶段。因此 12 次复核调用审查的是结构无效候选，无法形成预注册的可比较复核臂。按照“禁止 Repair/重试”，这些调用不能被补做或替换。

### 5. facts-first 也暴露了格式稳定性不足

facts-first 只有 10/12 通过 Schema；案例 05 和 07 漏掉了必填顶层 `ignored` 字段。其聚合数值可作为失败关闭的 Development 诊断，但由于整轮预注册条件要求三臂均 12/12 合格，不能拿 facts-first 的 90.91% Task F1 与无效命题图臂作胜负比较。

即使只看这 12 例的诊断数值，facts-first 也只有 5/12 Complete Case，动作效果 66.67%、时间 62.50%、材料 42.86%、事件 0%、地点 33.33%；“Task Precision 100%”明显不能代表端到端正确率。

## 独立审计发现的计分订正

- 自动报告中的 `requiresAction` 不是模型顶层字段正确率，而是评测器从 active task 是否为空重新推导。facts-first 的真实顶层字段为 11/12 正确，即 91.67%；自动报告显示的 83.33% 标签不准确。
- 命题图与复核臂显示的 `requiresAction=25%` 是 Schema 无效后空任务恰好撞对 3 个负例的假象，应解释为 `N/A`，不是 25% 模型能力。
- `missedSafeDefaults` 已计算为 facts-first / 命题图 / 复核 `3 / 9 / 9`，但自动报告漏列，而且冻结执行器没有把它纳入 Complete Case 或诊断决策；这是潜在漏选被低估的计分缺陷。
- time/material/event/location 只在匹配到的 Expected task 上评分，未匹配假任务携带的错误附属字段不受罚；Evidence 又先被 Schema 强制为原文子串，因而其 100% 主要是结构门结果，不是充分语义依据率。
- 自动结果里的复核 Schema `0/12` 是 `graphValid && verifierValid` 的复合值，不能单独归因于复核器。独立离线检查发现复核输出自身也为 0/12 合约有效，但原结果没有把两层失败分开报告。

这些缺陷不改变预注册的 `INVALID_RUN`，但意味着自动表中的局部百分比只能保留为原始诊断输出，不能作为正确率结论。

## 哪些结论成立

- 成立：当前 B0 提示词/Schema/调用编排无法产生有效三臂比较；独立复核并未被证明有净收益。
- 成立：必须先修正“每次独立调用都拿到完整机器契约”，并在复核调用前做 Schema 门控。
- 不成立：`deepseek-v4-flash-vision-exp` 的命题理解正确率为 0%。
- 不成立：facts-first 已达到 90.91% 产品正确率。
- 不成立：多模态、真实文件、真人修改时间或浏览器能力已经得到验证。
- 不成立：可以接入稳定路径、启动 RCO-6 或上线。

## 下一步建议（尚未授权）

若继续，应新开 B0.1，而不是修改或重算本轮：

1. 每个独立 system prompt 内完整列出所有枚举，不再跨调用引用“同上/一致”。
2. 优先使用供应商支持的严格 JSON Schema；若只能使用 JSON object，则增加本地协议握手和最小合法样例。
3. 命题图通过本地 Schema 后才允许发起复核；失败即停止该案例的复核并计入失败，不浪费调用。
4. 复核器使用自己的固定 canonical 枚举，并能明确拒绝 `candidate_schema_invalid`，不能照抄候选词汇。
5. 先用 0 次模型调用做 prompt/schema 静态一致性、属性变形和 mock 端到端测试；再另行冻结新数据与新调用预算。
6. 修正 scorer：直接评分顶层 `requiresAction`，无效臂质量指标显示 `N/A`，Missed Safe Default 纳入 Complete/decision/report，并分别报告 verifier-own 与 pipeline Schema。
7. 加固 checkpoint 恢复校验和实际请求计数，并在结果中绑定 freeze、plan、请求哈希及可用的 Provider request ID。

本轮原 dataset、freeze、checkpoint、result 和自动生成报告均保留原样，不做事后改题、放宽 Schema 或重算追分。
