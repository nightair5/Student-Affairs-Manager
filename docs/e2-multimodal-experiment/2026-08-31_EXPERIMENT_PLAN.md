# E2-MM 多模态识别实验计划

**应用基线**：`v2.0.0-beta.1-rc.4` / `2a95dba23e18ea2fcde8e1e0dd9754db4f79fce8`  
**实验分支**：`codex/e2-multimodal-recognition-exp`  
**状态**：方案冻结；Preview 工程与验收进行中；真实未见材料评测 `NOT RUN`  
**日期**：2026-08-31

## Claim Map

| Claim | 最低可信证据 | 对应模块 |
|---|---|---|
| C1 图片+OCR 文字能比文字版和图片版更准确地恢复截图/扫描件的任务、时间和材料对应关系 | 两批独立未见材料中，图片+文字版均通过预注册核心门槛并优于另外两臂 | B1、B2、B4 |
| C2 显式逐次授权的多模态路径能降低用户修改成本，同时不削弱隐私、可追溯性和人工确认 | 配对用户修改时间下降；隐私、安全、浏览器 A–J 全 PASS；正式任务仍为零直写 | B3、B5 |

要排除的反解释：

- 收益只是把文本换到视觉模型，而不是图片信息带来的；因此必须有图片版和图片+文字版，并保留稳定文字模型基线。
- 收益来自对已见样本调参；因此 Development、Unseen-1、Unseen-2 必须分离冻结。
- 小样本筛选偶然胜出；旧 Vision Exp 的 8 例筛选与 108 例文本失败不得计入本实验正证据。
- 准确率提升来自放宽证据或上传更多用户数据；因此 evidence、发送范围和单次授权必须独立验收。

## 三臂冻结

| Arm | 模型 | 输入 | 产品可见性 |
|---|---|---|---|
| T 文字版 | `deepseek-v4-flash` | 同一份冻结 OCR/解析文字 + 同一限量上下文 | 默认产品路径 |
| I 图片版 | `deepseek-v4-flash-vision-exp` | 同一原图/选定页面 + 必要参考时间/时区，不提供 OCR 正文 | 仅评测消融；不得放入默认 UI |
| IT 图片+文字版 | `deepseek-v4-flash-vision-exp` | 同一原图/选定页面 + 与 T 完全相同的冻结 OCR 文字 + 同一限量上下文 | 仅逐次显式授权的 Preview 路径 |

I 臂需要独立的评测入口和证据规则，目前为 `NOT IMPLEMENTED`；不得用 IT 路径删掉 OCR 文字后临时运行并冒充冻结结果。

## 数据与隔离

- Development：最多 12 条匿名合成/公开许可材料，只用于工程与指标校验，不进入最终表。
- Unseen-1：至少 36 条冻结材料，截图、照片、扫描 PDF 各至少 12 条；在三臂、Prompt 和指标冻结后首次揭示。
- Unseen-2：另至少 36 条互不重叠材料；只在 Unseen-1 完成、缺陷修复冻结后运行，用于稳定性确认。
- 每条材料保存内容哈希、来源类型、页码选择、OCR 版本和冻结时间；不把真实学生身份、联系方式或原文件提交到 Git。
- Expected、评分规则与人工标签不得发送给模型；纠错只能进入 corrections log，不回写已运行批次。

## Experiment Blocks

### B1 协议与管线 Sanity（MUST）

- 证明 T、I、IT 的输入差异只有预注册模态，且请求、结果和失败可逐臂追踪。
- 成功标准：Mock/合成样例中路由、模型、Prompt、图片数量、OCR 哈希和失败状态全部可审计；正常 CI 不调用付费模型。

### B2 两批未见材料正确率（MUST）

- 主指标：Task Precision/Recall/F1、TimePoint Accuracy、Material Recall、Evidence Coverage。
- 安全指标：Major Correction、Severe Error、Invalid Output、Transport Failure、无依据事实数。
- Token/Cost：只记录上游实际 usage；缺失时写 `NOT OBSERVABLE`。
- 每条材料按三臂配对；Transport Failure 不得偷偷重试或从分母删除。

### B3 用户修改时间（MUST）

- 起点：待确认页首屏稳定可交互；终点：该来源全部建议被确认、编辑或拒绝。
- 同一参与者不得在不同臂看到同一材料，采用平衡顺序降低学习效应；中断超过 10 分钟单独标记，不静默裁剪。
- 报告中位数、IQR、配对/分层差值和 95% bootstrap CI；同时报告修改字段数、拒绝数与未完成率。
- 当前采集工具为 `NOT IMPLEMENTED`；实现前不得声称已测量用户修改时间。

### B4 失败与消融分析（MUST）

- 按截图聊天布局、照片透视/反光、扫描页、多栏/表格、OCR 顺序错乱、OCR 字符错误分层。
- 检查 IT 是否只改善版式对应，还是产生更多视觉臆测；所有视觉独有推断默认不可选中。

### B5 隐私、安全和浏览器 A–J（MUST）

- 使用 `PRIVACY_SECURITY_BROWSER_ACCEPTANCE.md`；任何一项 FAIL/NOT RUN 都阻止替换稳定模型。

## 预注册决策门槛

只有以下条件同时成立，才允许提出下一阶段替换评审：

1. Unseen-1 与 Unseen-2 中，IT 的 Task F1 均至少比 T 高 3 个百分点，且 Precision/Recall 任一项不得比 T 低超过 1 个百分点。
2. IT 的 TimePoint Accuracy 与 Material Recall 在两批中均不低于 T，并至少一项每批提高 3 个百分点。
3. IT 的 Major Correction 率每批至少比 T 低 5 个百分点；Severe Error 不高于 T；Invalid Output 为 0；Transport Failure 不高于 2%。
4. IT 的 Evidence Coverage 不低于 T，且显著高于 I；无 OCR 逐字依据的视觉推断不得成为默认选中项。
5. IT 的用户修改时间中位数至少比 T 下降 15%，且 95% bootstrap CI 的方向不跨 0；未完成率不得上升。
6. 隐私、安全、桌面/手机、键盘和浏览器 A–J 全部 PASS；独立 Preview 稳定观察完成。

任一门槛失败：结论为 `MULTIMODAL NOT PROMOTED`，稳定模型、RC.4 和 Production 不变。不得针对 Unseen-1/2 expected 反向调参。

## Run Order

| Milestone | 内容 | Stop/Go |
|---|---|---|
| M0 | 固定 RC.4、分支、Preview、Prompt/模型/发送范围 | 隔离失败立即停止 |
| M1 | Mock、限额、证据、失败回退、导出不含图片 | 任一隐私/安全 FAIL 停止 |
| M2 | Development 12 条以内，完善评分器与三臂入口 | 不产出推广结论 |
| M3 | 冻结并运行 Unseen-1 | 核心门槛失败则不进入用户试验 |
| M4 | 平衡顺序用户修改时间试验 | 隐私或完成率恶化停止 |
| M5 | 冻结并运行 Unseen-2、浏览器 A–J、稳定性汇总 | 仅全 PASS 才可提出替换评审 |

## 当前事实

- RC.4 与其 48 小时监测仍在 `release/v2-beta`，本实验不修改。
- Preview 产品路径已设计为 T 默认、IT 显式开关；I 仅为后续评测消融。
- 未见材料、真实模型三臂结果、用户修改时间和推广结论目前均为 `NOT RUN`。
