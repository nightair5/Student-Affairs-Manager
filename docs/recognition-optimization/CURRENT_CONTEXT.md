# MAINLINE-REAL-INPUT-01 当前交接

## 当前结论
- 本轮只比较deepseek-flash的reasoning none与low。
- candidate03、wire、正文、时区和评分口径均固定。
- low在首个正式样例触顶并返回incomplete。
- 结论DO_NOT_ADOPT_LOW_KEEP_NONE。
- 不增加模型调用、模式、候选或数据。

## 仓库
- 仓库：C:\Users\Winner\student-affairs-multimodal-exp。
- 分支：codex/e2-multimodal-recognition-exp。
- 本轮起点：ec05976a824595fe28737d5dee84fb9d9bbbf2ac。
- 起点对应上一轮业务提交：6a8b459ece9e6cc551a6bd9d07fa042ab4a9ef98。
- 当前交付提交与远端SHA见reasoning run的DELIVERY.json。

## 固定设计
- 20份已见完整匿名通知，原12份与后8份原样复用。
- A臂deepseek-flash + candidate03 + reasoning none。
- B臂deepseek-flash + candidate03 + reasoning low。
- stream=false，max_output_tokens=8192。
- verifier、Repair、传输retry均为0。
- A的temperature=0有效；B思考模式下被服务商忽略。
- 参考答案只用于评分，不进入请求。

## 实际请求
- 计划40次，实际只发送2次。
- Y01-A完成并结算，等待9698ms。
- Y01-A input4777、cached4608、output2275、reasoning0。
- Y01-A费用上界0.027754元。
- Y01-B上游HTTP200，但status=incomplete。
- Y01-B等待37323ms。
- Y01-B input4802、output8192、reasoning6719。
- incomplete原因max_output_tokens。
- Y01-B不评分、不回放、不保存。
- Y02-A在本机账本停机后拒绝，没有网络请求。
- 其余38次NOT_RUN，没有重试或补调用。

## 质量结论
- Y01-A业务上两项任务、两时间、三材料正确。
- 严格来源匹配差异与业务实质差异分开。
- low没有可靠最终答案，无法形成配对质量差值。
- 20份无需实质纠正数量NOT_RUN。
- 各类错误计数和等待P95均NOT_AVAILABLE。
- 本轮证明的用户少改数量为0。
- 历史none基线仍是17/20无需实质纠正。
- 历史工程回放仍有20条正确任务可保存，分布16份来源。
- 历史结果不冒充本轮low收益或真人转化率。

## 账本与费用
- 账本512行，最后sequence=511。
- 账本SHA256为30719d739c848930dacf2eb1475ccdc450c97b065a674c69fefeea5c5b1cd2b9。
- 原507行前缀逐字保持。
- 累计实际请求尝试250次。
- A01未知3.30元预留保持。
- Y01-B新增未知3.30元预留保持。
- 当前累计费用权威上界13.887567元。
- 项目上限20元未突破。
- 服务商实扣NOT_OBSERVABLE。

## 浏览器与产品
- 官方控制只连接一次。
- 21.438秒后nodeRepl.fetch request failed。
- 本轮两旅程、刷新、独立读库、两个下载NOT_RUN。
- 6632当前HTTP200。
- 识别POST返回405 MODEL_AND_WRITES_DISABLED。
- 线上任意模型调用仍关闭。
- 历史Q01/Q07三任务闭环继续保留。
- 历史U11双下载一致只证明当时一项任务。

## 工程检查
- 新配置定向测试120/120通过。
- Node语法和TypeScript通过。
- lint 0错误、4旧警告。
- 安全临时Vite构建通过，根.env未读。
- Vitest 1382通过、1跳过。
- server8、Worker25、time AST1、评估库23、Functions5通过。
- Secret scan 2211文件通过。
- 旧RCO-5-007仍因package-lock历史SHA失败。
- package-lock本轮无diff，旧断言未修改或弱化。
- 工程状态PASS_WITH_RETAINED_HISTORICAL_FREEZE_FAILURE。

## 证据入口
- 主报告：reasoning-compare-20260914a/AUDIT.md。
- 比较：reasoning-compare-20260914a/COMPARISON.json。
- 原始回答：reasoning-compare-20260914a/Y01-*_RAW.jsonl。
- 结果：reasoning-compare-20260914a/Y01-*_RESULT.json。
- 浏览器：reasoning-compare-20260914a/BROWSER.json。
- 检查与SHA：同目录CHECKS、IMPLEMENTATION_SNAPSHOT、DELIVERY。

## 下一动作
- 本轮完成后停止。
- 保留none，不提高low输出上限追分。
- 下一次准确率工作回到none+candidate03。
- 唯一主线仍是复合通知的动作、材料、条件和取消归属。
- 未有新授权不得创建candidate10或继续付费调用。
