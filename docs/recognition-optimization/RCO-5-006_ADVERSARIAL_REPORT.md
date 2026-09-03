# RCO-5-006 属性变形与新鲜对抗审查

## 审查身份与边界

- 日期：2026-09-03
- 分类：`anonymous synthetic contract fixtures / same-author provisional review`
- 业务模型调用：0
- Secret：未读取
- 真实材料、真人研究、浏览器验收、部署：均未运行
- 审查对象：隔离的 scope index、严格候选/复核 Schema、validator 与本机 composer
- 结论边界：只能证明已登记攻击按预期失败关闭，不能外推为模型或产品正确率

## 最终结果

- 核心契约：13/13 PASS
- 属性变形：9/9 PASS
- 完成实现后新增对抗：14/14 PASS
- 合计：36/36 PASS

## 覆盖的主要攻击

1. source ID、version ID、前后空格、标点和换行任一变化后重放旧候选。
2. 伪造 scope ID、乱序 scope、重复引用、漏记新增句子、把 ignored scope 同时当证据。
3. 从相邻命题借用地点、时间或对象；在同一 scope 内引用重复出现而不唯一的词面。
4. 在任意层级偷塞 `start/end/text/quote/evidence/selected`。
5. 偷塞看似合法的 `relations/fromId/toId`，试图让模型决定关系记录。
6. 自我复核、未知/重复复核对象、只复核部分命题范围、复核结果与候选哈希不一致。
7. 输出自称独立复核器但不在本机可信 run ID 集合中。
8. 自修订、指向不存在的修订目标、修订 scope 不完整或乱序。
9. “完成回执单邮寄”伪装成 local change，试图得到默认勾选。
10. 否定指令、第三方已完成事项和纯信息事件被误做用户任务。
11. 纯事件 `requiresAction=false + explicit event`：事件保留为未勾选观察，不制造任务。
12. Unicode 代理对字符和 source 字节变化下的本机 offset/quote 复算。

## 审查中发现并修复的主线问题

### 1. 复核器身份不能由输出自证

初版只要复核 JSON 写 `independent_semantic_verifier` 就可进入默认选择判断。这等于让被审查对象自己发证书。最终版要求调用方本机预注册 verifier run ID，并拒绝 producer 与 verifier 使用同一 run ID；没有本机信任绑定时保持未勾选。

### 2. 任务地点关系不能静默丢失

初版只为事件地点生成关系，像“在本机核对报名表”只有地点字段而没有 task-location 关系。最终版增加本机构造的 `task_location`，不让字段存在与关系存在分裂。

### 3. 纯事件不能冒充任务，也不能完全丢失

初版只能把没有用户动作的活动通知列为 ignored。最终版增加事件/信息观察命题：它可以保留时间、地点和逐字证据，但始终 `selected=false`，不会将 `requiresAction` 提升为 true。

## 未被本轮证明的事项

- 模型是否能稳定引用正确 scope ID。
- 模型对主体、否定、时态、修订、动作效果和字段归属的真实 Recall/Precision。
- 独立语义复核器在真实调用中的净收益。
- OCR、图片、扫描 PDF、跨页表格或噪声文本下的范围质量。
- 真人修改时间、Chrome/Edge/手机验收、隐私安全和商业上线资格。

## 裁决

`TECHNICAL_PASS_ZERO_CALLS / BINDING_AND_LOCAL_DERIVATION_ONLY / QUALITY_NOT_RUN / NO_PROMOTION / RCO-6_BLOCKED / DO_NOT_LAUNCH`

本轮修掉的是“模型不该做却被要求做”的机械工作，不是宣称语义已经解决。下一轮若获授权，必须用新的冻结数据测模型能否正确选择引用和语义标签；不能拿本轮 36/36 当识别正确率。
