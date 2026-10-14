# MAINLINE-REAL-INPUT-01：TLS路线诊断与零调用工程审计

## 结论（2026-09-07）

本轮不是新阶段，也没有恢复付费。用户明确批准的两次无凭据连接诊断已经全部用完：Node直连在12秒内未完成TLS验证；用户确认信任的现有代理路线在293毫秒内完成TLS证书与主机名验证。证据支持下一次候选使用显式、受限的代理路线，不证明A01历史根因、Key有效性或模型服务可用。

同时修复原42路径内两处React检查错误，不改变识别语义或确认安全规则。应用层工程已向前推进；真实模型响应、真实模型确认及最终全包验收仍未完成。

**本轮新增模型请求0、模型费用0；模型识别准确率：本轮未测量。**
历史A01仍是1次派发尝试、0完整响应、3300000微元未知预留。未知预留不等于已经消费3.30元，实际账单仍NOT_OBSERVABLE。

## 1. 起点和边界

- 唯一仓库/分支：C:\Users\Winner\student-affairs-multimodal-exp / codex/e2-multimodal-recognition-exp。
- 起始Git及live远端：949e42415dc3bc4dd42a5aeb0697160e1f35fc7b。
- 起始42源码匹配diagnostics-20260907a快照；945保护、70旧静态证据、diagnostics11文件、原usage41文件及日志前缀一致。
- 945保护聚合：df68e4eda47f664f9f0fbf218a74687117ac3cc9d2c14f5ee6e9965cd2c28394。
- 原始日志边界：278436字节，SHA256 1489e6f76d0d1d4dd5430c8fee7295dcea88e4207cf8ce879dfb861e82ddf1cd。
- 使用bug-detective先核实信任与因果证据，独立代码复核后检查工程；未将超时猜测写成产品事实。
- 未读取.env、Key、剪贴板、代理凭据或真实库；没有清库、安装依赖、改系统/浏览器设置或部署。

## 2. 两次实际连接证据

| 路线 | 实际结果 | 等待时间 | 可得结论 |
| --- | --- | ---: | --- |
| Node直接连api.deepseek.com:443 | LOCAL_DEADLINE_12000MS；未完成TLS验证 | 12012ms | 此次直连未在期限内完成，不能据此断言历史A01原因 |
| 现有127.0.0.1:10081代理 | CONNECT 200；TLSv1.3；证书和主机名校验通过 | 293ms | 此时此路线能建立经过验证的TLS隧道 |

代理父进程为用户安装的Clash Verge，端口、父子进程、安装记录和文件SHA已核验，详见BASELINE。程序未签名；用户明确确认信任并仅批准本次诊断。未将此表述为供应链或厂商真实性认证。

仅代理路线发送无认证的固定CONNECT隧道控制头；没有API HTTP请求、模型正文或Authorization头。TLS握手后立即关闭，不重试，不进行第三次连接。直接路线的phase是尝试阶段，不足以证明TCP已经连通。所有原始结果在RESULT.json。

系统及浏览器设置没有修改，恢复状态为NOT_NEEDED。TLS可达不等于认证成功；本次授权也不自动授权经代理发送服务端凭据。

## 3. 范围内工程修补与分层数字

仅在原42路径内修改3文件：

- src/App.tsx：将输入面板作为React组件渲染，不在render中直接调用组件函数；默认路径不改。
- src/experiments/realInput01/FactCorrectionEditor.tsx：将回调ref赋值移至提交后的effect，原dirty判断/确认/持久化规则不改。
- src/experiments/realInput01/acceptance.test.tsx：追加2项SSR/内存正常对照，保留原8项断言及原始通知空白，不触发保存/发送回调或库变更。

无上下文独审PASS_SCOPE_ONLY。独审以本轮增量反向内存还原，三文件均恢复上一快照SHA；未修改文件或独立复跑浏览器。

| 检查层 | 结果 | 边界 |
| --- | --- | --- |
| 定向acceptance+runtime | 33/33 | 包含于应用测试，不重复计样本 |
| lint | 0错误、4警告 | 两处原失败关闭；未关闭规则 |
| TypeScript app/node | PASS | 增量产物在新临时目录 |
| 全应用Vitest | 1206通过、1原有跳过、0失败 | ocrLiveComponent opt-in测试未执行，不计PASS |
| 当前Node服务/Worker/函数/时间/评测库层 | 62/62 | 模拟测试，不是模型调用 |
| Schema/时间AST检查 | PASS | --check，不再生成 |
| 安全扫描 | 1140文件PASS | 不将扫描等同全面安全证明 |
| 构建 | PASS | 新临时输出，无部署；540.41KB块大小警告保留 |

工程日志7份由IMPLEMENTATION_SNAPSHOT绑定。没有把各attempt、重复层或模拟请求当成更多真实样本。

未执行：原npm test全部历史编排链、历史环境快照重验、公开依赖审计、UI改动后的实际Edge验收。旧当前环境3/1 FAIL及所有历史失败不变。SSR不验证effect生命周期、逐键操作或实际下载保存；因此完整工程/浏览器及整包仍NOT_COMPLETE。

## 4. 为什么现在不能直接再点一次

当前账本安全策略在未知请求后停发，runner要求原请求全部结算，且原结果写入入口会覆盖旧RESULT；当前checker还有旧HEAD绑定。直接清HALT、另建付费账本、改STATE或直接跑A02都会破坏原证据/预算约束。

本轮只提出以下恢复设计，未改budget/gateway/runner/checker，也没有追加原账本、释放原预留或派发A02。独立复核确认恢复须显式处理，不是换代理参数即可开跑。

## 5. 唯一下一包动作：同包一次性A02恢复（待批准）

### 不可变绑定

原usage-resume-20260907a：
- CALL_LEDGER文件SHA：0bcec9835fc290bf3a77d9ba6114bfb727b9a9db87bed5df84551a767345d716。
- 原账本尾hash：1b063b08f8d5fafc8dda00e6cb1ead9ae3b2c609b4097dbce01ca3a2b96b1cad。
- manifest SHA：7ed6c3c2054e0d101328f882e0efc5e4415d0db8d3cc1f2bc98157ce324d9a9c。
- STATE SHA：d478c58f7f44e68a852bc7712c5d3e7994f2390750f5915d65204963dff9e73b。
- A01 nonce：f8bd6d1a-92aa-4e4d-acd7-f7db66d9dc13；request SHA：cedb11d8d88142cb6ed60fd0dbe5124312a646a6914b8ca28161f3f024a09d3f。

唯一可申请A02：
- input SHA：b14f83da2ef395dd3171e0af5debdc3cfc591e72aafd651cf0c682de44186ed9。
- request SHA：6cbf184da3dbc6d2ab8322b29482a0686fa2657c37ae34f4c8ce84ffae54404a；11549字节。
- candidate SHA：cac6a0073bc43389702ac319b8127ee1d131b0e27f791cb063971d50a624de54。
- scorer SHA：ad76149f8a88cb4adda6dca78b210daaa4f3c800d17582767911e8ace2658e1d；24个评分依赖保持。
- 是旧匿名材料的已见候选验证，不是盲测。A02目前NOT_RUN。

### 必須实现的恢复规则

1. 原账本只追加一次性grant，绑定原尾hash/序号、上述原身份、最新42源码及审核SHA、价格/参数证据、可信路线、唯一grantId。旧事件/STATE/manifest/raw/RESULT原样保留。
2. 只将明确指定的A01在新回放中归为held-unknown：保留原HALT、1次计数、3300000微元占用，不允许迟到结算、释放或重发A01。其他普通pending/新增HALT继续拒绝。
3. 同一原锁事务先持久化A02 reserve并消费grant，再发送；并发/崩溃不能返还权限或绕过账本。A02预留后累计2请求、6600000微元最坏占用；原总24次/10元不清零。
4. 仅完整合法且绑定A02租约、请求和响应身份的usage可结算A02自己的预留差额。重复/冲突JSON属性、反射、超时、协议/写盘/计分失败均停发；未知费用继续保留。
5. A02无论成功失败都停，不发A03/B/C，不允许浏览器并发消费grant。raw按请求身份关联，不用raw数量等于reserve数量；新结果另写，不覆盖原RESULT。
6. 显式子进程固定现有可信代理127.0.0.1:10081，经无代理认证CONNECT连接api.deepseek.com:443，保持端到端证书/主机名校验；不继承任意代理环境/NO_PROXY导致绕路，不改系统或浏览器。
7. 未来另获准后才安全复用合法服务端.env；Key不进前端/导出/日志/Git，不读剪贴板/代理凭据。不发试连接。发送前只读重新核验官方价格/参数及24小时内证据，变化或费用上界不可靠立即停。
8. 只修改原42内7文件：real-input-budget.mjs及Node测试；real-input-model-gateway.mjs及Node测试；run-mainline-real-input-01.mjs；check-mainline-real-input-01.mjs及Node测试（均在scripts/）。分别限恢复回放/租约/固定路线/单元选择/新证据与当前审核编排。
9. 额外精确批准项：原CALL_LEDGER.jsonl仅追加且校验全部旧前缀；原账本锁根只追加本次新收据、不改旧收据；新增本包恢复run报告。不是允许改原冻结/数据/答案，也不是创建新付费账本。
10. 零调用覆盖正常A02、重复grant、并发/重启/崩溃、尾hash与身份篡改、普通pending、额度上限、迟到/跨请求结算、旧结果覆盖、成功后再发拒绝；独审无阻断，绑定最终源码才允许单次发送。

### 可直接使用的授权提示词

> 继续同一MAINLINE-REAL-INPUT-01，批准按tls-route-20260907a/AUDIT.md第5节实现一次性原账本追加恢复，并只执行未运行A02一次。先核最新审计Git/远端、42最终源码SHA、945保护、旧静态证据及日志前缀，不回切、不重做PLAN。
>
> 仅修改该节列明原42内7个scripts文件及其限定职责，新增本包恢复报告；明确批准原CALL_LEDGER仅追加且旧前缀逐字保留、原锁根仅追加本次新收据，旧STATE/manifest/raw/RESULT/旧收据保持。授权绑定原尾hash、原A01身份、既定A02输入/请求/候选/评分依赖和最新安全审核。A01永久保留失败、1次计数与3300000微元未知预留，禁止重发/退款式释放/迟到结算。
>
> 先通过本节零调用正反测试与新独立安全复核，再只用用户信任的现有127.0.0.1:10081代理路线和合法服务端.env执行A02；明确批准本次模型调用所需凭据仅服务端使用，经完整TLS验证发送到api.deepseek.com，代理不带认证。不得读取剪贴板或代理凭据，不改系统/浏览器设置，不新增依赖或试连接。价格/参数先用官方公开资料重新核验，变化或预算不能可靠约束即停。
>
> 原deepseek-v4-flash-vision-exp、temperature=0、reasoning.effort=none、stream=false、max_output_tokens=8192、3.30元滚动预留、总24次/10元、verifier/Repair/retry=0不变。先持久化A02预留并消费一次性grant再派发；A02成功或失败均立即停，不自动A03/B/C，不允许浏览器竞用。原结果不覆盖，新证据按请求身份计分并保留失败。范围内零调用工程可继续，产品完整验收不降低；未完成只审计Git交付，完成才业务提交。新安全/预算/保护/重叠修改/范围扩大立即停，不接真实库/稳定入口，不部署。

## 6. 本轮交付

按最终快照核保护、历史、日志及差异。仅暂存本run补充证据/7日志、CURRENT_CONTEXT和追加日志；42实现继续本机未提交。使用精确Git提交/推送流程，提交后核对远端，不强推或自动变基。实际Git交付号以提交及远端核验回执为准，本文件不自引用未来提交号。

唯一优先事项是批准上面的单次恢复，让下一次请求取得可评价的真实结果；不再重复诊断已证明的TLS路线，也不换模型/新数据绕开旧失败。TLS、工程、模型质量和完整产品交付四类结论严格分开。
