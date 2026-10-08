# 最终普通页面与独立读回

2026-10-08，实际Codex in-app browser操作。唯一交付 http://127.0.0.1:6895/ 。构建6aa3550f02d3/source e364676630c0；数据库rco-mainline-01-02-i1-d27-plan-recorded-morning-v6-delivery-final。最终提交仅增加文档/证据，源码身份不变。

ENGINEERING_REPLAY：4新V6实际录制+4旧V5回归+8控制分别标注。16页面选项不是16模型调用。实时POST403，任意通知实时AI未接通。旧库未操作。选来源→复制原文→普通首页智能拆分→ReviewSession→DomainCommitPlan→Repository。普通用户不填ID/scope/ISO，不静默写正式库。

| 路径 | 实际结果 | 证据(browser目录) |
|---|---|---|
| 新01 | 3task/0event/2日期窗口8/13和8/27；date_only保留，身份/owner受阻，无补录或确认截止 | final-v6-01-first.txt |
| 新02 | 3task/1日期deadline；只接受基本登记，2条件项待核对；source部分确认，新增1task+1time | final-v6-02-first.txt、final-v6-02-readback.json |
| 新03 | 准备设备真实动作显示，坏关联/前置只阻相关task；7/6—7/10和6/30 17:00保留，待核标题事件默认暂缓，没有正式保存 | final-v6-03-first.txt |
| 新04 | 1task/1event/3time/1二维码材料，兴趣待核；10/12 12:30—14:00与10/11 12:00分清；只保存事件，0新增task/1event/2time/0material，报名留草稿 | final-v6-04-first.txt、final-v6-04-first.png、final-v6-04-readback.json |
| 无任务 | 周五晚维护+结束尚未公布，0task/0project/1event/2null时间；vague/unknown、raw依据保留，不造日历时段 | final-no-task-first.txt、final-no-task-readback.json |
| 截止/材料 | PDF、学院和姓名命名、11/6 15:20保留；故障场景标题/35分钟由工程作者修改，不算首次正确 | final-material-first.txt、final-save-recovered.json |
| 坏owner | 甲乙不保存，无关丙11/14 16:00单独保存；source仍部分 | final-bad-owner.txt、final-bad-owner-blocked.txt、final-bad-owner-readback.json |
| 前置/资格 | 填写/提交借用记录保存，提交在受阻区，1前置未完成；资格尚未公布领取项未选未保存 | final-prerequisite-wait.txt、final-prerequisite-readback.json、FINAL_HOME.txt |
| 检查点失败 | 编辑输入保留、未保存提示、按钮保护；手动重试后恢复 | final-checkpoint-failure.txt、final-checkpoint-recovered.txt |
| 事务失败 | 无半份task/material/time；手动重试一次正式提交 | final-transaction-failure.txt、final-transaction-no-half.json、final-save-recovered.json |
| 提交后读回失败 | COMMITTED_READBACK_FAILED，不再次确认；只重读同commit，无重复task | final-committed-readback-failure.txt、final-save-recovered.json |
| 刷新/安排 | PDF和35分钟恢复；个人10/8 09:40—10:15另存，原11/6 15:20不变；过期登记不自动安排，前置提交不当可开始 | final-refresh.txt、final-personal-plan.txt、final-plan-readback.json |

最终独立 **4Task/3Event/8TimePoint/1Material/0Project**，含1个人planned_start。[最终读回](browser/FINAL_CANONICAL.json)去除serialized备份重复，原始1,756,757字节在本机.data保留，SHA见文件，不冒充完整数据库导出。[控制台](browser/FINAL_CONSOLE.json)空，[首页](browser/FINAL_HOME.png)。

实际计量8报告/55trace/6commit/6readback/2字段edit，两edit都能关联checkpoint operation/revision→同commit→独立readback。无编辑不造editId；2人工字段修改、失败成本保留；刷新缺失null。canonical partial与历史ordinary partial分列。[原计量](browser/FINAL_MEASUREMENT.json)、[摘要](MEASUREMENT_SUMMARY.json)。measurement3.2/low-edit-v2不改，四真人NOT_OBSERVABLE，不把工程时间算真人省时。

过程限制：6894曾显式保留第三份待核标题事件，旧过程v6-03-readback.json仍保留，只证明明确选择可保存，不能证明语义正确。最终6895默认暂缓且未保存。故障夹具有人工修改。自愿义务/二维码角色/窗口归属争议和生成错没有偷偷补对。本次实际手机视口及普通App路径已验，未另跑跨浏览器完整矩阵、真人、提醒外发、系统日历写入或生产。保存成功不算语义正确。
