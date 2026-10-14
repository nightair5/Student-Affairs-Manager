# D25具体费用与唯一待授权动作

状态：申请卡，不是授权。16/16 NOT_RUN，模型/grant/reserve/settle为0。不能复用D17的24次或US$8许可。

## 固定身份

批次`D25-C17-C18-DEVELOPMENT-R1`，仅Candidate17 vs Candidate18、8来源×2臂=16次，4AB/4BA。代码提交`3aabcca00cf8eb8a0830a8f3de317a182b07186b`已推送；最终文档交付后，真实执行必须再绑定当时干净且已推送的实际HEAD，不能只信本卡代码SHA。

Manifest SHA：`b21902a115ad3feebc66fc11ab58c30564277a123dc0cb2669691a0415f1ce06`。
身份文件SHA：`9fe65f082061eda84c3af7797c21223e8faf45106d3b481d6b4204acea868776`。
全部ordinal、requestSha、unitIdentitySha在[具体申请卡](AUTHORIZATION_CARD.json)及[原冻结身份](PREPARED_REQUEST_IDENTITIES.json)，保持dispatchAuthorized=false。

## 官方核价与最坏边界

2026-10-02 03:34 UTC（北京时间11:34）只读核验[DeepSeek官方价格页](https://api-docs.deepseek.com/quick_start/pricing/)、[Responses API参数](https://api-docs.deepseek.com/api/create-response/)、[兼容规则](https://api-docs.deepseek.com/guides/responses_api/)。标准价格URL一次超时，随后官方同页索引链接成功读取、显示Crawled: today；未发送认证探测或模型请求。

官方`deepseek-flash`路由对应DeepSeek-V4.1-Flash，上下文1M，最大输出384K。此批固定POST `/responses`、temperature=0、reasoning.effort=none、stream=false、max_output_tokens=8192；该上限涵盖可见输出和推理token。峰时未缓存输入US$0.30/百万token，输出US$1.20/百万token；缓存命中与非峰时更低。本卡全按峰时未缓存价，不借节假日/缓存折扣封顶。官方费用按输入输出token扣费，没有为此纯文本、无工具请求列额外调用费。

不是拿UTF-8字节估token。每个已冻结请求都采用供应商整个有效上下文的宽上界1,048,576输入token（保守覆盖“1M”的十进制/二进制表示），输出8192；合法处理受上下文限制，超上下文请求按官方规则400，不能无限输出。

每请求金额上界：1,048,576×0.30/1,000,000 + 8192×1.20/1,000,000 = US$0.3244032；账本按微美元逐单元向上取整为US$0.324404。16次保守合计 **US$5.190464**。建议本批硬上限 **US$5.20**。

这是宽松硬边界，不是实际费用预测。无论HTTP/解析是否成功，每身份最多送一次；确定失败且usage不可见按本单元全额上界保守结算。发送/计费/raw落盘/settle任一不确定立即封存并停后续，不自动重试；不能用缺raw推断没送达。供应商实扣与预算结算分开，实扣当前NOT_OBSERVABLE；本轮未发生D25模型费用。

调用前必须重核官方价格及路由（核验有效期最多12小时）、最终提交/推送HEAD、16身份、每份requestSha、保护和权威账本完整链。涨价、参数漂移、状态不确定或新上界超过授权上限，在创建grant前停止。当前账本938行、782221字节、SHA `e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9`是只读快照，不是永久常量。

## 可以直接给出的具体授权

> 授权仅执行D25已冻结Candidate17 vs Candidate18的16个deepseek-flash请求，绑定上述Manifest和身份SHA，费用硬上限US$5.20；允许且只允许一个本批新grant，逐单元reserve/settle。不含额外样本、自动重试、repair、verifier、真人、独立Holdout、默认替换、合并或部署。

收到这份新的真人用户消息后，在同一D25工作包内核价/核账本/核身份→执行→逐来源比较→报告。当前不创建`.data/d25/execution/AUTHORIZATION.json`。

安全入口：`node scripts/run-d25.mjs --verify`只读；`--resume-read-only`仅已有批次状态检查。`--prepare-authorized`及`--dispatch-next`只有真实新授权文件且清洁已推送HEAD满足安全门时才可用。准备授权不是探测模型；一次跨进程锁、顺序reserve→SENDING→raw/SHA/usage→settle；不确定时锁/现场保留。16个确定结局齐备才运行`node scripts/score-d25.mjs --write`。评分后的人工争议、标题/自由描述/泄漏保持未裁决，不可写零风险。
