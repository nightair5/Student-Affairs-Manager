# MAINLINE-03-I1-R1 进度与身份规则

- 基线c30cdb7本机/远端一致；10拒收源码起始全匹配，原752及R1新增保护共768。
- 先复现2失败/134通过（XWF2mj）；不是新发现错误默认选，而是获准的两个既有阻断反例。
- 第1轮局部修复：raw JSON与rawResponse结构相等；对象顺序/空白不影响身份，数组顺序/键缺失/值类型必须相同。保存原始文本，不重写、补齐语义或重新标历史PASS。
- 完整2.0的契约/提示/模型身份来自原响应实际字段；人工服务形状说明只在kind/展示标签，不混入originalModel。
- 已见候选：契约来自内嵌schemaVersion，模型来自已绑定旧record.responseModel；原JSON没有promptVersion时明确null。当前只声明记录一致性，不宣称哈希能证明服务商真实性。已见类型仍整体CONTRACT_UNREPRESENTABLE，不转完整任务。
- 原人工unknown在生成响应前抛错：raw=null/原始文本空/原异常保留，contractVersion与promptVersion均null，originalModel为已冻结工程producer LABEL而非一次模型预测。这种失败记录不进入语义转换。
- 修复后136/136（QaSg2T）；增加同根因版本类型/缺键/数组序/合法重排/已见三例后153/153（9HKAvC）。旧134项保留，42/42内存读回保留；后续独立审查待完成。
- 同根因源码修补轮数1；只改两实现与三测试，另五实现只读。最后一处测试断言从对象不等于字符串强化为原对象与其原始JSON仍一致，没有改原测试。
- 当前审查快照版本再次定向153/153（2xMFm0），10源码SHA与R1_REVIEW_SNAPSHOT一致，768保护不变。
- 完整门/实际Edge尚未运行，不预先宣称通过；0外部识别模型/费用/密钥/剪贴板。
- 新无上下文独立审查PASS：6类内部矛盾重封存拒绝，合法键序/空白确认2任务且原始/首次保留；3测试内存去新增块后字节SHA与拒收相同，旧断言未弱化。即将执行1轮完整门，尚无完整门/浏览器结论。
- 完整检查首个attempt在lint中止（l1TQcP）：本轮新增测试两处it.each与调用括号换行触发no-unexpected-multiline；1条原mainline01/browser快刷warning保留。其余工程门未开始。
- 第2次局部调整仅把上述两处调用连接到同一行，无产品逻辑/断言变化；将重新定向和独立复核，再继续完整检查。不隐瞒首次中止，不把未跑项算PASS。
- 换行后153/153（ylFLCW），独立差异PASS；工程attempt2（Rx2qfE）lint通过，app类型检查6个TS2307中止。@types/node未声明/安装/锁定，标准依赖修复需package两文件新授权。其余门/Edge未运行，停止代码修改，最终NOT_ACCEPTED_ENGINEERING_BLOCKED，只交付R1审计，模型准确率本轮未测量。
