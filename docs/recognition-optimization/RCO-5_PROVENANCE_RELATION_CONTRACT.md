# RCO-5-003 原文位置与归属关系契约结果

## 结论

`RCO-5-003 FAIL / REJECT_CANDIDATE / ZERO MODEL CALLS / NO_PROMOTION / DO_NOT_LAUNCH`

本轮建立了隔离的候选实现：每个动作、时间、材料和事件事实携带本机可复算的字符位置，跨字段关系携带类型与最小关系片段；没有可靠关系的事实不自动勾选。该实现没有接入 Worker、浏览器默认路径或正式任务提交。

字符位置契约通过了机械验证，但新鲜对抗审查证明它仍不能可靠判断完整句意。最终反例“想确认一下，家庭经济困难认定表为必交？”可以只截取“家庭经济困难认定表为必交”，遗漏前置疑问语气和句末问号，进而把疑问错误变成已勾选的必交材料。因此本候选不得进入 RCO-G5 质量配对或稳定路径。

## 实现边界

- 新增 `facts-1.5` 至 `facts-1.7` 隔离候选和确定性 composer；未修改既有候选冻结。
- 字符 `start/end/text/segmentId` 必须与原文逐字一致。
- action-time、action-material、action-constraint、event-time、event-location、material-attribute 使用类型化关系与最小 assertion span。
- `sourceId` 在组合时必填；Evidence 输出精确 `textStart/textEnd`。
- 来源标题和类型仅接受可信调用方元数据；候选账本不得自动命名项目。
- 无可靠 required 关系的材料不得标为必交；取消、更正、范围数量、重复角色、非具体地点等已知情况 fail-closed。
- 所有任务仍要求用户确认；不创建正式任务。

## 对抗轮次

1. `facts-1.5`：27 个已登记用例通过；新鲜审查复现遗漏取消/更正、材料必交泄漏、重复事件角色、错时间类型和来源元数据洗入，拒绝。
2. `facts-1.6`：38 个已登记用例通过；新鲜审查复现疑问/暂定被裁掉、完成态与第三方动作、范围数量、事件开始结束错配和独立动作进入约束，拒绝。
3. `facts-1.7`：52 个已登记用例通过；最终新鲜审查用前置疑问语气复现 `validate=true + selected=true` 错误材料，拒绝。

这些输入均为手写匿名 `contract_fixture / simulation_only`，不是模型输出、真实材料或真实正确率样本。52/52 只能证明已登记断言，不推翻测试外反例。

## 第一性原理判断

产品需要的是“这个事实在原文里是否被作者明确断言，并且属于哪个动作/材料/事件”，而不是“这些字是否出现过”。字符位置只能证明词在哪里；最小首尾包络也只能证明若干词位于同一片段。否定、疑问、时态、主体、暂定和更正的作用域可能位于包络之外。因此，继续增加黑名单或正则会在漏识别与错识别之间来回摆动，不能形成商业级可证明的语义归属门。

后续若重新设计，应把完整命题范围、语气/极性、主体、时态与修订关系作为解析器可验证的结构；在此之前，所有模型产出的关系默认保持未勾选并由用户确认。该方向需要新的单独授权，本轮不继续。

## 验证事实

- 定向：Vitest `52/52 PASS`，最终 fresh audit `FAIL`。
- 全量：Vitest `395 passed / 1 live OCR skipped`；server `8`、Worker `25`、time parity `1`、multimodal evaluator `23`、Functions `5` 均通过。
- `lint`、`typecheck`、`build`、Schema/time drift check 通过。
- 安全扫描通过 `302` 个源码/构建文件；`npm audit --audit-level=high` 为 `0 vulnerabilities`。
- Cloudflare default、preview、multimodal_preview 均仅 dry-run 通过；未部署。保留既有大于 500 kB chunk warning。
- 旧受保护输入当前 `10/10` 匹配已知哈希，且保护路径无 Git diff；这只证明当前无净字节漂移，不声称期间从未写入。
- model / Repair calls `0 / 0`；Secret `NONE`；真实材料 `NOT_USED`；真人测试、浏览器验收和部署 `NOT_RUN`。

## 门状态

- technical contract: `REJECT_CANDIDATE`
- RCO-G5 quality: `NOT_RUN`
- RCO-6: `BLOCKED / NOT_STARTED`
- Production / RC.4 / stable path: `UNCHANGED`
- authorization: `CLOSED`
