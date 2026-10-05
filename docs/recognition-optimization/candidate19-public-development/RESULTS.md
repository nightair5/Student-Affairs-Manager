# 当前交付：真实通知驱动的时间修复，模型新首答未测

2026-10-05。LOCAL_FIRST_SUGGESTION_TIME_FIXES_DELIVERED_NO_NEW_MODEL_OUTPUT。
唯一当前内部入口：[http://127.0.0.1:6851/](http://127.0.0.1:6851/)；普通App/ReviewSession/DomainCommitPlan/Repository，固定录制与明确工程输入，实时模型机械关闭。[具体实现](current-notice-mainline/IMPLEMENTATION.md)、[浏览器](current-notice-mainline/BROWSER_EVIDENCE.md)、[验证](current-notice-mainline/VALIDATION.md)。

本轮有限取得6份学校官方实际通知文字节选，固定原referenceTime/timezone、出处SHA和provisional最小事实。新模型输出0，6份首次整份正确性全为UNKNOWN，不能报0%或100%。FRESH-03的本机receipt存储失败明确排除；未公布/完整取消新通知覆盖仍缺。FRESH-07面向中学生，仅时间/条件边界控制，不证明普通在校学生代表性。[材料及参照](current-notice-mainline/SOURCES.json)、[出处](current-notice-mainline/PROVENANCE.json)。

## 用户第一次少改什么

1. 日期单独一行、时段下一行时，原答已提供事件/端点及同owner完整依据，程序能直接保留完整日期。例如10月12日12:30–14:00，不再要求补日期。
2. 明确截止“6月30日24:00”正确解释为7月1日00:00，原文和转换审计保留，不再要求手动改成次日零点。无日期、24:30、错日期、矛盾或跨对象依据仍不能套规则。

公共时间2.1.0/首次组装1.1.0修改，旧Candidate19输入和Prompt不动。2手写合法wire的3时间端点旧null→正确正式值，**不是模型2/2整份正确率**。报名夹具仅测截止/动作节选，不声称识别完整夏令营资格/缴费。旧13实际录制首次事实完整深比较不变，仅政策审计版本改变。[前后](current-notice-mainline/BEFORE.json)、[之后](current-notice-mainline/AFTER.json)、[旧录制回归](current-notice-mainline/OLD_RECORDING_REGRESSION.json)。

## 普通路径实际结果

粘贴→智能拆分→看摘要→一次接受。5来源0字段编辑/补录。两任务前置等待与资格unknown分开，第三受阻不妨碍前两项部分保存；PDF、命名、办结回执、截止保留，“平台”仍不是确定渠道。模糊开始/未公布结束保留null、不造日历。事务失败无半份事实，输入保留；手动恢复后已提交但读回失败，禁重复提交，仅重新读回恢复。刷新九类集合一致。

独立最终4Task/0Project/4Event/1Material/12Time（10原文时间+2个人安排）、23Evidence。D27已保存填写10/6 09:00–09:30、递交09:30–10:00，各30分钟标产品暂估；前置仍todo，个人计划不改原截止，逾期报名未擅自新排。安排还需一次“接受这份安排”。[每项页面、canonical及过程错误](current-notice-mainline/BROWSER_EVIDENCE.md)。

5个source-review commit/readback、0edit、2failure。4完整确认/1canonical部分确认；3完整时间/2缺失，旧ordinary部分终态false限制明列，以canonical为准，不补0或造editId。工程完整墙钟中位8464ms仅自动化，不称真人省时。四真人NOT_OBSERVABLE，旧路径步骤未同口径实测。[分层汇总](current-notice-mainline/ENGINEERING_SUMMARY.json)。

## 实际模型分母与原批

| 证据层 | 状态 |
|---|---|
| 新6实际通知 | 0新模型输出、6UNKNOWN |
| 本轮手写契约 | 2 ENGINEERING_FIXTURE，3端点转换及保存通过，不进模型分母 |
| 原公开4模型原答事实，provisional | 1暂定正确/0已知错误/3未知 |
| 原公开4冻结首次展示 | 0正确/1错误/3未知 |
| 原公开4当前公共首次展示 | 1暂定正确/0已知错误/3未知，与起点相同；不报总体正确率 |
| 旧v11原成绩 | C17 2/6、C19 1/6、MIXED_PROGRESS保持 |
| 旧12后验事实 | C17 4暂定/2错、C19 5暂定/1渠道争议，非新模型成绩 |
| 真人最终/四指标 | NOT_OBSERVABLE |

原C19-PUBLIC-DEVELOPMENT-R1：1SETTLED、2UNCERTAIN/SEND_RAW_OR_STATE、3/4NOT_SENT；唯一原grant/US$1.30、HALT/锁/STATE/AUTH/PRICE/raw/receipt原样。第1input4684/cached4096/output887/reasoning0，内部US$0.002470不是实扣；第2 reserve US$0.324404只是上界，送达/实扣未知。未prepare/dispatch/恢复/新grant/重发/补settle。[原执行](paid-evidence/EXECUTION.json)、[原冻结诊断](paid-evidence/INITIAL_FROZEN_DIAGNOSTIC.json)、[原转换诊断](paid-evidence/POST_CONVERSION_DIAGNOSTIC.json)。

供应商已有有限查询只见汇总/充值，未关联第2请求；不循环查、未代发工单。[查证及用户查询文字](paid-evidence/sealed-followup/PROVIDER_LOOKUP.md)、[原有限取证/条件恢复](paid-evidence/sealed-followup/FORENSICS.md)。特定记录仅决定该支线，不再阻挡本地准确率工程。

## 验证与最少下一步

定向12PASS、产品1054PASS/1skip。全量41组34PASS/7FAIL：六历史哈希/账本快照失败，加server bad port。server单独8/8PASS，不擦掉全量失败；原端口未记录，不能称根因已完全查清。lint0错误8旧warning，build/scan通过；audit5high/2moderate开发链，生产独立audit0。没有改依赖/旧锁/断言凑绿，不能宣布全仓全绿。

84保护/119冻结/7归档通过；1000权威链及原996前缀不变，SHA fe24750479d3a5229e386e8088199ae097f48a1f6872f0eaac016cfaeddbb48d。本轮model/grant/reserve/settle0。私有原件只忽略.data，不读Secret或旧用户库；无人/Holdout/default替换/合并/部署。

两项确定性修复不需付费，本轮未建新候选、批次、身份或费用申请。若下一目标是“当前C19对新实际通知第一份到底对不对”，复用现6来源按覆盖最小单臂诊断，输出前冻结请求/评价、核价并另取具体许可；不先造候选或第三臂，不用新请求消除原未知。发现真实生成根因后才做一项配对假设。

当前运行包构建d2b0cc6800cc/source97e42e786c60；最后类型注解/无用export清理后JS/CSS逐字哈希相同，[最终构建证明](current-notice-mainline/FINAL_BUNDLE_EQUIVALENCE.json)。Git最终SHA以交付核验为准，页面不伪造最终Git构建身份。
