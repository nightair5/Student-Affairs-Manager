# RCO Current Context

## 目标与结论
- 同一 MAINLINE-REAL-INPUT-01 完整包，NOT_COMPLETE。
- 主线：本机读取校对→真实建议→用户确认→隔离保存找回。
- A02 已完成一次真实模型调用；成功取得响应后已停止。
- 禁止再运行 --recover-a02/--paid，不自动 A03/B/C 或浏览器竞用。
- 总体模型识别准确率本轮未测量；仅有已见工程单例诊断。
- 自动选择 NOT_ENABLED，不以全部不选替代候选质量。
- 产品全格式/真实模型建议确认保存/真实 Edge 仍未完整验收。

## Git 与范围
- 唯一仓库 C:\Users\Winner\student-affairs-multimodal-exp。
- 分支 codex/e2-multimodal-recognition-exp，不在默认比赛目录实施。
- 起点 HEAD/live 远端 afd81ee4e8bac9285287c85f9ea389139bea12f6。
- 本轮审计交付提交号以 Git 为准；42 实现继续未提交。
- 原方案 56d0545fd8ffdd7b71f9feeed1ad9ac22a705dbe 及历史只读。
- 当前 run mainline-real-input-01/runs/recovery-a02-20260907a/。
- 本轮仅改预算/网关/runner/checker及3个Node测试共7 scripts。
- 其余35实现逐字SHA不变；42最终SHA见 IMPLEMENTATION_SNAPSHOT。
- 不回切、重装、变基、套补丁，不修改历史 runner/result。
- 审计提交仅新run证据、原账本获准追加、短交接、追加日志。

## A02 真实结果
- 输入：请保存活动手册。没有截止日期要求。
- 已见匿名 no-date 工程案例；不是新数据/盲测/真人材料。
- deepseek-v4-flash-vision-exp；temperature=0，reasoning.effort=none。
- stream=false，max_output_tokens=8192，verifier/Repair/retry=0。
- HTTP200，网关等待5651ms；输入3781/输出561/reasoning0。
- 动作对象及 requiresAction 各1/1匹配；没有生成截止日期。
- 工程精确参考 Complete Case=false，原评分原样保留。
- 新增材料实体、时态/效果标签、依据归属和文字字段与参考不同。
- 材料确在原文；不能将精确差异全部称为模型理解错误。
- Major Correction=true 是评分器标记，不是已测真人重大修改。
- 时间/事件/修订分母0，不报告这些为100%正确率。
- 新 RAW_RESULTS/RESULT 按 A02 请求/响应/评分器身份绑定。
- 没有用这条响应完成真实App确认保存；不能声称用户闭环通过。

## 账本与安全停止
- 原 usage-resume-20260907a CALL_LEDGER 保留944字节前缀。
- 仅新增序号3 recoveryReserve、序号4 recoverySettle。
- 原锁根3旧收据不变，仅增加2新收据；原STATE/manifest/raw/RESULT不变。
- A01 永久保留失败、1次计数、3300000微元未知预留。
- A01不重发、不迟到结算、不清HALT、不退款式释放。
- A02费用上界16392微元=0.016392元；服务商实扣NOT_OBSERVABLE。
- 累计2次，总占用3316392微元=3.316392元。
- 3.30元未知预留不是已经确认花费；原24次/10元不清零。
- grant先同锁预留并消费，再派发；成功也已停发。
- 新STATE是不可改的发送前控制计划；动态结果看RESULT/AUDIT。
- REVIEW.json.sending 与 ENGINEERING.json.billing 已被grant绑定，不重写。

## 本轮验证
- 发送前零调用安全测试93/93；不同attempt不累计。
- 修前预算32/35，新增恢复正例失败；修后35/35。
- 安全attempt1 91/93、attempt2 92/93 均保留；最终93/93。
- 独立无上下文审查复跑93/93，另4项对抗检查通过。
- 三旧测试逆向还原SHA一致，旧断言未弱化。
- 4执行脚本语法检查通过；7脚本lint通过0警告。
- 安全扫描1155文件通过；没有新依赖。
- 发送后独立复核账本/收据/原始响应/费用/评分一致，PASS_SCOPE_ONLY。
- 本轮没有机械重跑完整历史工程或实际Edge；不称全门通过。

## 复用证据与连接
- 35源码未变，按旧SHA复用1206应用通过/1原有opt-in跳过及62Node层。
- 上轮type/build/契约通过，lint0错误4警告；不称本轮重跑。
- 原完整npm test历史编排/公开依赖审计仍未完成。
- 可信代理127.0.0.1:10081，固定无认证CONNECT到api.deepseek.com:443。
- 完整证书/主机名验证后才发送服务端.env凭据，未读剪贴板/代理凭据。
- 官方价格/参数公开HTML重新核验与旧SHA相同；未增加试连接。
- 系统/浏览器设置未改；本轮无浏览器、用户库或文件本体外发。
- 原6631 origin及原隔离库保留；不换库/清库掩盖恢复。
- 旧16来源/0任务/0jobs、3下载仅旧证据，不是新响应确认成功。

## 保护与下一唯一建议
- 945保护聚合df68e4eda47f664f9f0fbf218a74687117ac3cc9d2c14f5ee6e9965cd2c28394。
- 122旧证据中仅原CALL_LEDGER获准追加，其他121全SHA保持。
- 14上轮证据、旧日志前缀、3旧收据保持；新收据与账本一致。
- 本轮起始日志281353字节/SHA51cdd4ebce13432f017293b068cd1138336d34fbb3f48a94a8c8681318fca894。
- 原40/42、17旧测试、历史环境3/1 FAIL与所有旧结果保留。
- 下一主线：用现有A02响应零调用回放确认保存，并裁决工程差异的实际影响。
- 不先换模型/改Expected/评分救分/购买A03；新增runtime职责先精确申请。
- 无新语义数据/真人/真实材料/真实库/稳定接入/部署/RCO-6。
- 新安全/预算/保护/重叠修改/范围扩大立即停；本轮交付后停止。
