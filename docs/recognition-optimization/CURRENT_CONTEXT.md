# MAINLINE-REAL-INPUT-01 当前交接

## 当前结论
- 本轮比较deepseek-flash的reasoning none与Max。
- candidate03、wire、正文、时区和评价口径固定。
- 首批8份两臂16/16均完整返回并完成分析。
- Max整体错误更多、等待更长、费用更高；结论STOP_AFTER_FIRST8_AND_KEEP_NONE。
- 剩余12份/24次NOT_RUN。

## 仓库
- 仓库：C:\Users\Winner\student-affairs-multimodal-exp。
- 分支：codex/e2-multimodal-recognition-exp。
- 本轮起点：129dd1c53c142f45c069110dae42f21f0888a2f2。
- 本轮业务提交：bcdbd948953e7809253c896b16e8a5f641839735。
- 远端已精确核对为同一业务SHA；最终文档回执见DELIVERY.json。

## 固定设计
- 20份已见完整匿名通知原样复用。
- 首批8份：W11、W12、W02、X05、W10、X01、W07、W01。
- 两臂均为deepseek-flash + candidate03；A none，B max。
- 两臂max_output_tokens=32768、timeout=180秒。
- stream=false，verifier/Repair/传输retry=0；B思考模式忽略temperature。
- 参考答案只用于评价，不进入请求。

## 质量结果
- none无需实质纠正6/8，实质错误5个。
- Max无需实质纠正5/8，实质错误9个。
- Max在W11减少3个任务/材料/条件错误。
- Max在X05新增3个任务/材料/时间错误。
- Max在W10新增4个多余任务和材料错归属。
- W02、X01、W07增加核对负担；W01持平，W12没有减少需纠正来源。
- 严格完全匹配两臂均0/8，业务差异另行裁决。
- Max不采用，6632不切换路线。

## 等待与费用
- none中位8660ms/最大9211ms；Max中位100154.5ms/最大125619ms。
- Max中位等待约为none的11.57倍。
- none费用上界0.196400元；Max为1.547088元。
- 本批16次合计上界1.743488元。
- 服务商实扣NOT_OBSERVABLE。

## 账本
- Y01-B可信usage核销0.075140元，但仍不可评分、回放或保存。
- A01未知3.30元预留永久保持。
- 账本546行，最后sequence=545。
- 账本SHA256为fcec75c16702ae90fb1749acf3602b49ba1d8be1caf4b27e1703b718b15a3734。
- 累计实际请求266次。
- 累计权威费用上界12.406195元，低于20元上限。

## 工程接入
- Max由显式新策略接入，旧none/low策略不放宽。
- 最终message与reasoning项分开，只有完整答案形成建议。
- 总output费用只计一次，不重复加reasoning tokens。
- Max响应容量校验采用32768，不套旧8192。
- 服务商raw、账本和请求身份保持；旧评分入口只接收可见答案投影。
- candidate03和modelWire未修改。

## 产品与浏览器
- 官方控制只连接一次，约22.666秒后nodeRepl.fetch request failed。
- 本轮页面确认、刷新、独立读库和下载NOT_RUN。
- 本轮实际新增正式任务0。
- 历史20任务/16来源工程回放、Q01/Q07页面闭环和U11下载证据仅作历史证据。
- Max未采用，6632和公开产物未修改。

## 工程检查
- 完整预算/网关122项及Max定向测试通过。
- Node语法、类型和lint通过，4个旧警告保留。
- 禁根.env临时Vite构建通过。
- Vitest首轮1381通过/1超时/1跳过；唯一超时项定向复跑1/1通过。
- 旧RCO-5-007仍为package-lock历史SHA不匹配。
- package-lock本轮无diff，旧断言未修改。

## 证据入口
- 主报告：reasoning-max-compare-20260914a/AUDIT.md。
- 逐例业务比较：FIRST8_COMPARISON.json。
- 派生评分：FIRST8_DERIVED.json。
- 原始回答：M01至M08的A/B_RAW.jsonl。
- 浏览器：BROWSER.json。
- 检查与SHA：CHECKS、IMPLEMENTATION_SNAPSHOT、DELIVERY。

## 下一动作
- 本轮完成后停止。
- 保留none + candidate03，不继续Max剩余12份或追加其他强度。
- 下一次只考虑“否定/限制说明被造任务”的单变量改进。
- 未有新授权不得创建candidate10或继续付费调用。
