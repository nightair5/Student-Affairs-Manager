# RCO-5-007-B6 新鲜对抗审查

## 裁定

`PASS_LOCAL_P3_ONLY / ELIGIBLE_TO_REQUEST_SEPARATE_PAID_MODEL_TEST / NOT_RELEASE_EVIDENCE / DO_NOT_LAUNCH`

B6 在冻结提交 `ee7ffc9` 推送后才由 P3 首次读取，并且只运行一次。16 个案例全部可评分，任务 F1、`requiresAction`、Complete Task Case、三类修订关系、旧要求失效、新要求生效和歧义保守处理均为 100%；Forbidden、stale 和 selected stale 均为 0。

## 这次真正证明了什么

在上游已经准确给出原文 scope、动作和对象锚点时，冻结 P3 能够：

1. 把完整状态命题与具体旧任务建立 `cancels`、`supersedes` 或 `amends` 关系，而不是只搜索“无、未、取消”等孤立字词。
2. 保留旧任务用于审计，但将其明确投影为 `past + cancelled + superseded` 且不默认勾选。
3. 让替代任务独立保持 `active + pending`，不被旧要求状态污染。
4. 当两条旧要求都可能被“上述要求”指代，或取消的是非任务安排时，返回 unresolved，不擅自删除任务。
5. 保持动作表面词、对象、执行人和风险分类各自独立，不让修订分类改写原文动作。

## 对抗性核查

- **先冻结后运行**：B6 数据、Expected、门槛、P3 与依赖的 10 个路径已做 SHA-256 绑定，并在首次运行前提交推送。
- **标签泄漏检查**：Expected 的修订关系和未解析标签只用于运行后的评分，不进入 P3 candidate；candidate 的 `revisionRefs` 固定为空。模型权威字段由 reducer 丢弃。
- **单次运行检查**：结果文件存在时 runner 会拒绝再次运行；B6 从首次运行后立即标为已见 Development。
- **安全方向检查**：不仅检查总体 F1，还单列旧要求失效、新要求生效、三种关系、歧义、stale 与默认勾选，避免总体高分掩盖危险错误。
- **边界检查**：没有模型、网络、Repair、retry 或 Secret；未改稳定路径，未启动 RCO-6，未部署。

## 不能据此声称的内容

- 不是 DeepSeek、OCR、图片或文件识别正确率；本轮没有测试模型能否找对 scope、动作和对象。
- 不是独立人工真值。B6 是匿名合成、单一 Codex 作者的 Development 挑战集。
- 不是现实分布、真人修改时间、Chrome/Edge/手机验收、隐私安全验收或商业上线证据。
- 不能把 B6 再用于 P3 调参后声称“首次盲测”；它已经变成已见数据。

## 下一门

仅可另行申请一次付费模型实验：冻结全新匿名数据，让模型选择 scope、动作和对象，再把其输出交给已冻结 P3。需要预先锁定模型、次数、人民币上限、失败计费、无 Repair/retry、完整指标和停止条件。当前没有这项付费授权。
