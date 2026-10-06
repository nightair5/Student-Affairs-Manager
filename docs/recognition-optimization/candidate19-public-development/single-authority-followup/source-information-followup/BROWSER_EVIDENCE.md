# 来源补充说明：最终普通页面验收

2026-10-06。官方 Computer Use 实际操作。唯一入口 http://127.0.0.1:6872/，构建9c8159bac227 / source2531a3ab070f；隔离库rco-mainline-01-02-i1-d27-plan-recorded-source-info-final-1006，初始为空。仅01/02 SETTLED原录制，ENGINEERING_REPLAY，模型派发机械关闭。

| 路径 | 实际操作与结果 | 本机证据 |
|---|---|---|
| C19普通首次页 | 选择C19→原文粘贴普通首页→智能拆分。未编辑事实；“通知补充说明”直接出现“完成学习后提供学习证明。”及“无需报名”。明确未关联具体事项；活动描述没有猜补学习证明owner。PASS | 01-c19-first.txt/png、02-c19-evidence.txt |
| C19正式确认 | 展开补充说明原文依据→确认信息并保存独立事件→独立Repository读回。1事件2时间，0任务/项目/材料；草稿保存firstSourceInformationDisplayed版本、来源版本和依据。PASS | 03-c19-canonical.json |
| SingleAuthority首次页 | 同原文按另一臂普通路径导入。原嵌套属性已有学习证明、在线和讨论；补充说明不再复制这些属性，只保留无报名信息。PASS | 04-single-first.txt |
| 检查点失败和恢复 | 注入检查点失败→事件暂缓。真实错误RECORDED_INJECTED_CHECKPOINT_FAILURE，选择留本页，明确刷新可能丢失；“恢复并保存事件选择”成功→关闭→刷新→重开仍暂缓，补充说明仍在→改回保留。PASS | 05-checkpoint-failure.txt、06-recovered-refresh.txt |
| 正式事务失败 | 注入正式保存失败→确认。真实RECORDED_INJECTED_FORMAL_SAVE_FAILURE；独立读回只有先前C19的1事件2时间，未留下半份SingleAuthority事实。保留选择与错误。PASS | 07-formal-failure.txt、08-no-half-canonical.json |
| 成功提交后读回失败 | 手动重试，同时注入读回失败。正式成功，显示“已提交，读回尚未验证”，确认按钮禁用。关闭核对面板→“重新读回并核验”，仅读回，显示“正式事实已保存，独立读回已验证”。两条commit、两条readback，未重复正式事实。PASS | 09-readback-pending.txt/png、10-readback-recovered.txt、11-final-canonical.json |
| 刷新和测量 | 刷新后再次独立读回，events/timePoints/tasks/projects/materials/drafts/runs/sourceVersions逐项完全一致。2事件4时间0任务0项目0材料。2报告27trace。C19无editId、主动编辑0；另一臂两次处置选择→检查点→同一commit→readback可查，最终事实纠正0，刷新导致时间缺失null。PASS | 12-measurement.json、15-refresh-canonical.json |
| 模型关闭和错误 | GET manifest200，modelCallsByBrowser=0；POST /api/deepseek403，没有外发；console warn/error空。PASS | 13-console.json、14-routes.json |

两个独立来源都是影像叙事工作坊，各自开始2026-12-03T13:30/exact，结束normalizedValue=null、precision=vague、原文“结束时间暂未公布”；start/end引用与eventId两向一致、原依据保留。C19 location“在线”；SingleAuthority location=null但在线形式在描述内。未公布结束不造确定日程。C19学习证明保存在来源草稿/识别结果及首次快照，未伪造为活动附属事实；无额外强制补录或核对按钮。

[独立值及owner摘要](BROWSER_SUMMARY.json)、[测量摘要](MEASUREMENT_SUMMARY.json)、[原raw新展示诊断](DIAGNOSTIC.json)、[本机原件SHA索引](EVIDENCE_INDEX.json)。保存完成不是语义正确；C19活动关联争议继续UNKNOWN，各臂4固定分母。

未改变生成契约、关系编译、逐事件选择、DomainCommitPlan、Repository、CAS和安排逻辑。多活动部分保存/共享时间/坏owner局部阻断/窗口安排等未变路径明确复用[已提交A—J](../BROWSER_EVIDENCE.md)及[上一构建6871恢复证据](../PAID_BROWSER_EVIDENCE.md)，不是本轮再次点击，也不冒充SA02—04未取得的新模型输出。跨来源/无据/来源版本过期的新增说明过滤另经真实捕获和Repository定向反例验证；新首屏及上述受影响恢复均在6872重验。

未测：任意通知实时模型、剩余6请求的首次质量、全部新多活动浏览器矩阵、真人省时及独立真值、远程身份鉴权、复杂全局安排。不新增这类准备阶段。本轮浏览器无工具阻碍；控制台[]，测试服务保留运行供体验。
