# P5 Path A Prompt Candidate RC2

状态：`CANDIDATE_NOT_YET_EVALUATED`。

## RC1 证据

在冻结的 108 条 Generalization Development 上，RC1 将 Task Recall 从 75.71% 提高到 81.43%，但 Task Precision 从 82.17% 降至 79.17%，Event Accuracy 从 93.94% 降至 64.71%，TimePoint Type Accuracy 为 76.77%。因此 RC1 不满足 Candidate 内部门槛。

## 唯一改动

Prompt 从 `recognition-2.5.0-rc.1` 更新为 `recognition-2.5.0-rc.2`。模型、Schema、ModelGateway、temperature、max tokens、Router、Validator、Repair 与 E1 Domain 均不变。

RC2 只补强原则化 Planning Contract 中的 Task/Event 完成标准：

1. 产生、填写、提交、携带或确认可交付结果属于 Task；
2. 在约定时间发生或参与的日历过程属于 Event，即使它具有强制性、条件性或由外部主体执行；
3. Event 时间必须使用 `event_start` / `event_end`，且不再复制为 Task；
4. 为 Event 准备明确产出仍是独立 Task；
5. 公示期、开放窗口、维护时段或结果发布时间本身不是 Event。

这些是跨样例的实体边界，不包含 caseId、完整固定句子或针对单条失败的补丁。

## 预注册判断

RC2 是 P5 允许的第二轮，也是最后一轮 Prompt 候选。它必须在同一 108 条 Development 集上真实运行并完整保留失败；无论结果如何，不得进行第三轮 Prompt 调优。
