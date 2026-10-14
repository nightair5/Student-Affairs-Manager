# 本批新录制在普通产品路径的实际验收

2026-10-03，official Computer Use / Codex in-app browser，全部ENGINEERING_REPLAY。唯一推荐http://127.0.0.1:6798/，新库rco-mainline-01-02-i1-d27-plan-recorded-actual16r6。构建7ce9fa204a5b / source cbf17bf22cd8，[manifest](BUILD_MANIFEST.json)与[提交源码绑定](CODE_BINDING.json)。最终代码构建后完成以下操作，未触碰旧入口/用户库。无真人、网页模型请求0；原回答来自本次授权实际16份。

路径：普通首页快速粘贴→Source/SourceVersion/RecognitionRun/Draft先存→录制provider/转换→普通核对→DomainCommitPlan原子事务→独立Repository读回→刷新→D27已有安排。不是独立演示保存链。

| 场景/操作 | 实际结局与关键值 | 证据 |
|---|---|---|
| C18 S01初次显示，直接确认信息/事件 | 0Task/0Project/1Event/1Time；完整原文事件标题；周三晚null/vague/needsConfirmation，依据保留；无需人工补事件 | [首屏](browser/final-s01-first-display.jpg)、[文字](browser/final-s01-first-display.txt)、[独立库](browser/final-s01-canonical.json) |
| C17 S07精确截止/PDF，耗时改20分钟，注入正式事务失败 | 真实RECORDED_INJECTED_FORMAL_SAVE_FAILURE；新增Task/Material/Time为0，仅此前S01已存；编辑及待核对来源保留，不显示假成功 | [失败页](browser/final-formal-failure.jpg)、[提示](browser/final-formal-failure.txt)、[独立库](browser/final-formal-failure-canonical.json) |
| 关闭重开S07，手动确认重试 | 仅1Task/1Material；20分钟修改保留；PDF、实验编号-负责人、2026-10-19T16:30；来源commit/readback一致；不重复任务 | [库](browser/final-s07-canonical.json) |
| C18 S03 null缺事实拒绝 | REAL_INPUT_FACT_COVERAGE_MISSING_FACT；Source failed/原raw及SHA保留；没有新正式事实、未静默fallback | [提示](browser/final-s03-rejection.txt)、[库](browser/final-s03-rejected-canonical.json) |
| 上述拒绝后C17 S05加载 | 仍实际Candidate17录制；资格unknown受阻，加入任务disabled；“暂定下周二下午”待核对，原9月22推理基准未变成10月6日；没有新正式任务/时间 | [页](browser/final-s05-blocked.jpg)、[文字](browser/final-s05-blocked.txt) |
| 刷新已保存及待核对状态 | S07 20分钟、截止与S01事件不丢；S05待确认保留；D27安排建议10/4 09:00–09:20与原截止分列，未自动接受planned_start | [刷新库](browser/final-refresh-canonical.json)、[最终首页](browser/final-home.jpg) |
| C18 S02已有维护事件，注入提交后读回失败 | 实际“已提交，读回尚未验证”，提交记录保留；全库1Task/0Project/2Event/3Time，周四晚null；不是正式事务失败 | [提交状态](browser/final-readback-failure-status.txt)、[页](browser/final-readback-pending.jpg)、[独立库](browser/final-readback-pending-canonical.json) |
| 点击“重新读回并核验”，随后刷新/独立读回 | 仅重读，无再次commit；S02同commitId得到readback；全库仍Task1/Project0/Event2/Time3/Material1，无重复 | [最终独立库](browser/final-canonical.json) |

数量是同一全新工程库累积结果，不能把S02全库Task1误说它生成任务。两份无任务来源各Task0/Event1/Time1。事实类别和值及来源关联在JSON可查；保存成功不表示已获语义裁决。

## 页面测量实录

[最终报告和trace](browser/final-measurement-all.json)含5来源：S01、S07、失败S03、受阻S05、S02。已正式提交并读回3；失败/未提交2不删除。首次/最终语义正确均NOT_ADJUDICATED，四项真人NOT_OBSERVABLE。

- S01阅读wall14,574ms/read14,552ms/wait22ms，主动编辑0；阅读超过10秒没有编辑成本。是程序工程时间，不报告真人速度。
- S07 editId 6f404fea-cb93-4969-8f93-77734b748ee4 → checkpointOperationId 19658fd3-4442-45d2-800c-2d6c9ed4ad9d → revision b752752e-73d8-4b0d-b04e-cc050fb3f9bf → commit source-review:source:7a33d1df:draft:1:fnv1a32:0a99f37f →同commit独立readback。estimatedMinutes一项/一episode，failure1；手动重试不重复纠正。关闭重开存在time discontinuity，active/wall为null/MISSING，不补0。
- S02 readback恢复后无人工字段编辑，active0；操作等待期间wall318,732ms不能拿来推算常规处置时间。系统等待与阅读记录分开，未称在线服务速度。
- S03/S05未完成、开区间或缺commit/readback明确缺失；不把它们计入低修改成功。测量3.2/low-edit-v2/语义版本及D27安排计量未更阈值。

隐藏/空闲非零、检查点故障和双身份/双标签完整矩阵本轮未新测，复用未改既有隔离/恢复代码及当前产品测试；不是宣称本轮重新验完旧A—L。此次变更影响的首次生成/路由、正式失败、读回失败、刷新及页面edit链已实际回放。未验浏览器项不冒写PASS。

## 过程失败如实保留

6793工程库前缀被D20隔离器拒绝；6794未重绑定scope导致依据失效；6796错误draft变量使页面崩溃；6797来源拒绝污染provider状态而fallback。均在最终6798构建前定位修复，未用过程构建冒充验收。最终6798浏览器console未见error；日志内旧6793/6796错误不能伪称从未发生。过程日志/r5 fallback证据仍在本机.data，工具locator超时后检查实际DOM重新定位，未盲点重发。

最终录制入口不发布、不换默认；旧正式用户库未加载。负责人、范围、参与者本人同意和裁决仍缺，未开展真人。
