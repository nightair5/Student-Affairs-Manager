# MAINLINE-01 测量设计（仅设计，不采集真人数据）

目标：分别回答“首次建议好不好”“确认后对不对”“用户到底花了多少精力”。本轮人工工程响应、浏览器自动化时长均不能冒充真人成绩。现有反馈记录不改；以下字段须后续独立授权接入。

## 记录单位与来源

- `runId/sourceVersionId/draftId/itemId` 绑定同一来源版本；文件页码、提取范围、遗漏页、OCR质量另记，不把残缺来源算完整输入。
- `fixtureKind` 区分 engineering / seen-replay / model-development / human-study；本轮只有 engineering。
- 首次建议：在第一次可见前保存不可变快照及内容哈希、组件/契约版本、实际模型标识（人工则manual）。修改后的快照不得覆盖首次版本。
- 最终正式实体另存快照与引用；事实对照由独立评分器完成。评分答案不进入识别、选择或确认逻辑。
- 原文/逐字依据留在本机来源记录；事件流水默认只记录匿名ID、字段名、类型和时间，不重复放全文、图片、文件、个人信息或Secret。

## 事件流水

| 事件 | 本机记录 | 用途 |
|---|---|---|
| capture_started / source_saved | 操作ID、来源版本、输入种类、字符/页数量 | 识别前来源是否安全保存 |
| extraction_finished / suggestion_ready | 覆盖范围、首次建议快照ID、状态 | 区分读取失败、结构失败、语义失败 |
| review_visible / evidence_opened | 可见状态、对应item与evidence ID | 阅读与核对动作，不直接当编辑时间 |
| edit_started / field_changed / edit_ended | 字段枚举、修改前后快照引用 | 动作、对象、时间、材料、条件、修订、归属、依据、纯措辞修改 |
| focus_changed / visibility_changed / idle | 单调时钟、窗口是否前台 | 排除离开页面和长时间不操作 |
| confirm_clicked / commit_succeeded / commit_failed | 同一operationId、选择ID、事务结果、安全错误码 | 点击不等于保存成功；重试不得重复计数 |
| deferred / rejected / manual_completed / abandoned | 最终处置、可选原因 | 不把放弃、全不选排除出成功率分母 |
| restored_after_refresh | 原runId、新sessionId、持久化版本 | 恢复同一记录，不重置首次建议 |

`Major Correction`：需要新增漏掉的行动、删除错误行动，或改正动作/对象/执行人/关键时间/材料归属/条件/修订。改标题措辞与调整耗时单独记，不能与语义大改混算。复合动作拆合由独立审查按事实增删判别，不因点击“拆分”自动算模型错。

## 计时与分母

- `time_to_first_suggestion`：capture开始→首次可见；分别记录解析、排队、识别等待、渲染。
- `active_edit_ms`：用户处于前台、编辑状态且有近期输入时累积的区间并集；建议30秒无操作即暂停，阈值正式研究前预注册。不能把键盘空闲阅读都算编辑，也不能声称这是认知耗时。
- `active_review_ms`：前台主动核对区间，编辑时间为其子集；与等待区间不重叠。
- `waiting_ms`：本机/服务忙碌造成的不可操作区间并集；不要与后台idle重复相加。
- `wall_elapsed_ms`：首次可见→最终处置的墙钟时长，跨刷新用分段单调时钟累加；时钟倒退/数据缺失显式标记，不能补0。
- 最终处置枚举：confirmed_unchanged / confirmed_modified / partially_confirmed / rejected / deferred / manual_completed / abandoned / failed。部分确认仍保留未处理数量，不叫完整成功。
- 首次任务Recall、Precision、requiresAction、时间/材料/依据准确与完整性、Complete Case、Major Correction、Forbidden、错误默认勾选各自报告。安全的“不确定”仍计入覆盖不足，不算正确完成。
- 正确确认率分母包含全部启动且满足预注册输入范围的来源；人工补录与放弃单报，不能删去难例。缺真人独立真值时写未测量。
- 单位成功成本＝全部试验实际可审计费用÷正确完整确认的来源数；分母0时未定义；Token/费用不可观测写NOT OBSERVABLE，不用估算替代。

## 隐私与后续准入

本轮没有埋点上线、服务器接收器、真人或真实材料。后续需分别批准字段表、保留周期、匿名化、撤销/导出/删除办法、参与者同意和人工真值流程；图片仍逐次显式授权且只送选定内容。研究授权、付费模型授权和部署授权互不替代。
