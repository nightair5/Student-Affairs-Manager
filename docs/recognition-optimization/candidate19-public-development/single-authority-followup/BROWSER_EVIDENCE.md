# 最终普通产品验收 A—J

2026-10-06。唯一当前入口：http://127.0.0.1:6869/ 。模式 ORDINARY_APP_FIXED_RECORDING / ENGINEERING_REPLAY；构建 `c780ebea52b9 / source 5f3eac81462d`，独立库 `rco-mainline-01-02-i1-d27-plan-recorded-authority-final6-1006`。随后提交只含证据和文档，不冒称浏览器构建是其后的文档HEAD。

12个匿名契约夹具为 ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT，另有原4份真实C19录制。夹具走真实Schema、普通App、ReviewSession、DomainCommitPlan和Repository；没有新模型输出或真人试次。旧入口和数据库未修改。GET /manifest.json=200；POST /api/deepseek=403 `C19_MODEL_AND_EXTERNAL_ROUTES_DISABLED`。

## 实际结果

所有下列路径在最终6869构建实际操作。`BROWSER_SUMMARY.json`保留源→run→draft→正式实体的真实关联及值；`EVIDENCE_INDEX.json`列本机原始AX、页面截图、独立canonical、测量、错误和日志SHA，完整数据库不进Git。

| 项 | 场景、操作与结果 | 独立数量/关键事实 | 证据与结论 |
|---|---|---|---|
| A | 单个数据工作坊，形式、分组互动和参与证明留在活动描述；一次确认 | source:bc6efa76：Task0 Project0 Event1 Time2；2026-11-12 14:00—16:00，同一owner | A-final6-first.png、A-final6-canonical.json；PASS，夹具不是模型第一次正确 |
| B | 工作坊和另一天报告厅颁发仪式，各自确认 | source:24187b5b：Event2 Time3；工作坊11/12 14—16，独立仪式11/13 09；不按名称自动合并 | B-final6-canonical.json；PASS |
| C | 原真实03录制仍有4事件；人工拒绝3个多余事件，正确活动部分确认 | source:f6526678：正式Event1 Time2、Task0 Project0；2026-07-06—07-10 date_only；draft rejected3，资格任务仍待核对 | C-final6-first/choices.png、C-final6-canonical.json；PASS兜底，原首答仍错误，3次结构纠正不计首次正确 |
| D | 错owner使甲/乙局部待核对，丙可保存；合法共享时间先存甲、乙暂缓，刷新后再确认乙 | source:b7a82497仅丙Event1 Time1；source:a0199b60甲乙Event2、共享Time1、sharedEventIds2；不猜接错误端点 | D-final6-first.png、D-G-final6-canonical.json、D-shared-final6-one.json、D-H-final6-shared-two.json；PASS |
| E | 开放窗口、精确截止和事件起止、模糊及未公布时间 | window source:2dea7b23：window_start 11/6 09、window_end 11/8 17，原deadline未说明；mixed source:1cb2f4e7：Task1 Material1 Event2 Time5，截止11/6 15:20、讲解会11/7 14—15、维护周五晚上null/vague、结束尚未公布null/unknown | E-final6-window.json、E-mixed-final6-canonical.json；PASS，原文/精度/证据保留 |
| F | 填写→提交借用记录，另有资格未公布的领钥匙 | source:481ddc75：2真实待办正式保存，依赖T1→T2；第三项资格unknown未自动确认；首页提交受阻，不把前置未完成写true | F-final6-first.png、F-final6-canonical.json；PASS，canonical partially_confirmed |
| G | 在坏关系来源保存无关联丙之前注入正式事务失败；页面保留选择，手动恢复 | 故障前后无新增半份实体；一次手动重试后仅新增Event1 Time1，甲乙仍待核对 | 288-G-final6-no-half.txt明确RECORDED_INJECTED_FORMAL_SAVE_FAILURE；G-final6-no-half.json、D-G-final6-canonical.json；PASS |
| H | 共享事件第二次确认，正式提交成功后注入读回失败 | 页面“已提交，读回尚未验证”，正式按钮禁用；恢复只重新读取；同一commitId核验成功，Event2共享Time1，无重复提交 | H-final6-pending.png、415/416 AX、D-H-final6-shared-two.json；PASS |
| I | 乙的处置检查点失败→手动重试→刷新恢复；未确认事件编辑关闭/刷新→接管→不改字保存草稿 | 检查点失败保留页面选择、说明刷新边界；刷新恢复暂缓；编辑接管后直接保存，提示“草稿纠正已保存，尚未正式确认”，正式事实数量不增 | I-final6-choice-failed.png、411 AX、I-final6-editor-recovered-ready.txt、I-final6-no-letter-saved.txt/png；PASS，最终构建实测，不用旧过程截图代替 |
| J | 独立仓储读回、刷新及最小安排 | 最终Task4 Project0 Event9 Time17 Material1；8来源5confirmed/3partially_confirmed。17时间含共享1个及单独个人计划1个；窗口之外不安排，11/6选择范围内生成09:00—09:30个人安排，原窗口不改 | J-final6-after-editor-canonical.json、J-final6-after-editor-measurement.json、J-final6-window-plan.json/png、final6-home.png；PASS |

工程过程出现官方浏览器控制 `js execution timed out; kernel reset, rerun your request`。重新绑定同一官方iab标签，读取实际页面/canonical后继续；某次超时实际提交已完成，所以先读回，没有盲目重发或坐标输入。工具最终恢复，以上均不是NOT_RUN。最终console error/warn=[]。

## 测量及未测范围

8逐来源报告、75条真实工程trace。原03三次拒绝有3个真实editId及3条correctionCheckpointLinks，关联检查点版本/草稿操作/commit/readback，按事件身份计结构纠正。检查点失败重试保留原editId；共享来源的暂缓→保留是两次不同选择，不是重试重复纠正。未改变字段的普通确认不制造editId，打开/恢复未改变值的事件表单不计事实纠正。

旧普通报告`ordinary.outcomes.partial=false`和通用`checkpointToEditId=NOT_DIRECTLY_LINKED`原样保留；不得把它们当canonical终态或否定新实际correctionCheckpointLinks。3个来源的canonical明确为部分确认。未闭合区间、刷新和未完成来源的时间为null/missing，保存失败成本不补0；工程时间不是真人省时。四项真人指标NOT_OBSERVABLE。

尚未实测：V5新真实模型输出、标题/自由描述独立裁决、真人指标、独立Holdout、跨设备、线上速度及部署。日期窗口只验证单一明确闭窗口；复杂多窗口/工作日/全局最优安排没有扩展。原真实02重复标题保留已知缺项，未为顺手文案重构扩大范围。A/B正确夹具可一次确认，无强制补录；原03仍需人工拒绝，不能称已减少模型实际多余事件。
