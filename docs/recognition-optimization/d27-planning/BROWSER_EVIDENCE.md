# D27 实际浏览器与独立读回

官方Computer Use/IAB，匿名假传输、普通App/Repository。真实浏览器操作，原始DOM、canonical和计量留于[evidence索引](evidence/EVIDENCE_INDEX.json)；未直接通过evaluate改应用数据。两标签用可见工程按钮经repository事务产生真实并发变化，非真人或远程鉴权。

最终推荐 http://127.0.0.1:6792/ ，`final10` 全新数据库，构建[source 191bcb02ddd6](evidence/BUILD_FINAL.json)。JS `5daa20cbc53dbfa1839f37051c47c96c12527c96a5356d95fbf1600376c2fe4d`；CSS `4f130c46c6675c582e5bfe7cd1735c56926818cc399f9d628903178e9a476922`。构建前HEAD只是身份组成，实际源码相同于最终代码提交3c56a7c；没有因提交改变重写旧构建证据。

| 实际验收 | 结果 | 原始证据、数量/关键值 |
|---|---|---|
| 精确截止+两材料一次接受，独立库隔离 | PASS | 09-isolated-empty / 10-two-materials：新库起始0；确认后Task2、Project0、Material2、源TimePoint2。与其他库独立 |
| 三任务、两个事件同来源接受 | PASS | 09-final-source-confirmation，最终40/41/44 canonical：Task3、Project0、Event2、Material1；4原文时间，不靠排程制造Task |
| 共用容量避固定事件及课程 | PASS | 15-final-capacity：10/6窗口10—12:30，事件10—11、课程11—12；填表12—12:25，其他容量不足。课程通过普通日历表单保存，首页实际canonical更新 |
| 前置未完成、无截止及未知耗时 | PASS | 16-final-unknown-duration：前置先排、后续条件保留；关闭暂估后无耗时任务DURATION_UNKNOWN，deadline仍无；最终活动“周三晚”null/vague |
| 锁定和用户调整 | PASS | 24-final-lock-conflict：锁定12点与改后窗口冲突仍保留，关联后续阻断；25手动13:30/15分钟；27—28明确解锁重排，原截止16点不变 |
| 容量不足、循环坏关系 | PASS（正确拒绝） | 15容量拒绝；12-cycle-failure-page/canonical：正式确认报DEPENDENCY_CYCLE，既有正确事实保持，坏来源接受0，不能说坏答案质量PASS |
| 检查点失败与刷新 | PASS | 17/18输入35保留及手动重试刷新；35—37最终计量基线修复后，editId保留、语义配置变化1、刷新时间MISSING/null，不假报0 |
| 正式事务失败 | PASS | 19-final-atomic-failure/canonical：安排0，3任务/2事件/1材料/4源时间仍在，无半份安排，手动恢复成功 |
| 已提交独立读回失败，刷新只读恢复 | PASS | 20—22及最终40/41/43/44：提交成功有3个人起点；刷新显示“已提交，独立读回尚未验证”；恢复不重新提交，1笔历史仍1笔。后续另一次明确调整才产生第2笔 |
| 撤回 | PASS | 14-undo-page：个人起点0，源事实未动；领域反例覆盖仅移除时的撤回、陈旧相关读集拒绝 |
| 两标签无关/关联变化 | PASS | 26无关description变更保留且接受成功；27关联snooze变化显示before/latest/mine、阻止覆盖；28明确重读后锁定/依赖正确重排 |
| 日历同一份正式安排 | PASS | 23-final-calendar：普通日历不再另算08—22独立建议；已接受列表同canonical起点，日期格仍源截止/事件，不把二者混淆 |
| 阅读与实际编辑计量 | PASS | 34-final08-reading-only：阅读29812ms、编辑0、等待26ms，commit/readback各1；37刷新恢复变化计1、wall=null；39/41/44读回恢复不重复commit计数 |
| 尺寸及控制台 | PASS（有范围） | 32-actual1024 / 33-actual390：官方CDP实际innerWidth/scrollWidth相等；已清除override。31截图viewport设置未生效，不能算尺寸PASS。42-console当前6790错误0，历史6778首次隔离前缀错误保留 |

受影响路径的最终复验边界：`final07`已含最终全部安排/Schema/CAS/课程/日历算法；`final08`只修计划测量的检查点初始基线和未知计数/刷新缺口，并重跑真实检查点/读回/计量；`delivery09`只改持久pending回执优先显示的状态文案，最终普通录入、接受安排、读回失败、刷新、恢复及独立canonical已重跑。未变化的领域/隔离/并发路径复用对应源构建证据，没有把过程构建称作最终全项重新点击。各构建SHA有单独Manifest。

40-final09-reloaded-committed-not-verified.txt为工具紧接reload时返回的空DOM，保留原状，不作为PASS依据；43-final09-pending-state.txt补存同一最终构建可见待验证状态，40 canonical及41恢复仍有实际证据。11-reading-only旧计量发现结束后查看报告错误重开，29旧计量发现重试基线被覆盖，均保留而不改成成功；最终34/37及12条定向测试证明修复。旧31图片也保留失败说明。

最终10构建只修已接受耗时与默认暂估的解释及其警示数值，无保存/排序/计量机制变化；45实际关闭默认暂估，已接受30分钟保留、文案无null，46独立canonical仍3/0/2/1/7，47保存最终页面和当前构建控制台空错误。复用07—09未变化的故障/并发/测量路径，未假称全部矩阵在10再次点击。十个本轮临时旧Host已停止，用户旧6777未动，数据库及证据保留。

独立核对[CANONICAL_AND_MEASUREMENT_CHECK](evidence/CANONICAL_AND_MEASUREMENT_CHECK.json)：09读回恢复前后timePoints原字节与history数量一致；跨调整前后源Task/材料/Event/非planned_start时间原字节一致；deadline2026-10-06T16:00，模糊时间null。最终10场景另核数量/值，截图[47-delivery-product](evidence/47-delivery-product.png)可直接查看普通首页。所有结果是ENGINEERING_REPLAY，0真人试次，不能算识别准确率或普遍省时。
