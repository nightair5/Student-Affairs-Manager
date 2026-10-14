# 首轮独立审查反例与一轮修补

## 先复现再改

新增3个测试，初次总99项：96通过、3失败。
- no-date→V2保存日期2026-09-18→确认：canonical为date_only，日期视图却review。
- 真实CalendarPage SSR：仅日期agenda显示08:00，日期格最早时间也虚构。
- 实验IntakePanel显示“本地规则兜底”，没有人工工程响应说明。
日志：C:\Users\Winner\AppData\Local\Temp\rco-mainline-02-i1-SkneSb\results.json。

## 第一轮局部修补

- taskDateView复用既有isDateOnly合法性，不强行用时刻解析器验证仅日期。
- CalendarPage仅实验分支将仅日期agenda/日期格摘要显示“仅日期”，混合事项保留真实时刻摘要；普通参数未改。
- IntakePanel和DraftReviewPanel仅显式实验参数使用人工工程响应文案，普通路径文案不改。
- 不改时间AST、V2确认器、Schema、旧夹具/Expected，不新增识别/时间编辑能力。

修补后99/99；app类型与定向lint通过。日志：C:\Users\Winner\AppData\Local\Temp\rco-mainline-02-i1-fiWRls\results.json。
701保护全部保持；已请求独立审查者复核，不预称审查/全量/浏览器通过。
