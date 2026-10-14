# MAINLINE-REAL-INPUT-01 同包继续：重大安全停止审计

日期：2026-09-07（run于09-06建立，未重建阶段或计划）。整包NOT_COMPLETE；本轮未进入真实模型调用。

## 做了什么

- 起点4ed0486d3137ac60b1b07c7ef276739cbc98350f，分支/实时远端/5未提交源码/946保护/原日志前缀核验通过。
- 按用户补充授权实现3.30元最坏预留、合法完整usage整数结算、未知不释放、并发/重启/次数金额/冻结请求约束。旧0.40元PLAN及失败证据未改。
- 预算独审发现快照引用可改变冻结清单这一P2；两项新回归先失败，最小复制修补后28/28，独审通过。初次语法错误与失败attempt均保留。
- 新网关实现固定Responses上游、同账本、文本冻结、Host/Origin/capability、无重试、上游大小/超时限制、原始记录与usage绑定。17项原有测试通过，但独立新反例未通过。
- 本轮只新增四脚本（两模块/两测试）；13已有源码、此前5新模块均未修改。9源码继续未提交，41白名单还有19路径未创建。没有可试用的新用户链路。

## 唯一阻断：JSON转义绕过凭据反射检查（P1）

证据边界：以下“记录命中”指内存recordRaw回调收到的内容，不是原始响应落盘测试；反例未调用createRawRecorder。仅预算账本写入预声明临时根，不能宣称磁盘原始文件泄露已实测。

位置：scripts/real-input-model-gateway.mjs，记录raw前的raw.includes(secret)。该检查只看序列化文本，不看解码后的值。独立审查实测上游使用合法\\uXXXX表示工程假凭据时，HTTP200、返回值与记录解码后均含该值、预算结算390微元。没有访问真实密钥；这是本机模拟的潜在泄露路径，不是已发生真实泄露。

复现来源：独立审查者real_input_gateway_review，执行chunk_id=36b05f。用现有测试setup/raw/http/FAKE_SECRET定义在内存加载后执行如下片段，调用真实createModelGateway.handle与openBudget；只有fetch为模拟Response。临时文件在BASELINE预声明根下，无源码修改、外部请求或真实库。

```js
const e = JSON.parse(raw('A01'));
e.output[0].content[0].text = FAKE_SECRET;
const escaped = JSON.stringify(e).replace(FAKE_SECRET,
  [...FAKE_SECRET].map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join(''));
const s = await setup(() => http(escaped));
const r = await s.gateway.handle(s.message());
console.log(r.status,
  JSON.parse(r.body.rawHttpText).output[0].content[0].text === FAKE_SECRET,
  JSON.parse(s.recorded[0].rawHttpText).output[0].content[0].text === FAKE_SECRET,
  (await s.budget.snapshot()).reservations[0].status);
// Independent observed: 200 / true / true / settled; 390 micro-CNY simulated usage.
```

已按重大安全停止条件暂停代码/测试修改与派发；未继续App实现或运行全量/浏览器。不能以45个已有测试通过盖过此独立反例。

## 检查分层

|层|结果|边界|
|---|---|---|
|预算最终定向|28/28|两失败反例与正常24单元均保留|
|预算独立复核|PASS_SCOPE_ONLY|无真实发送|
|网关既有定向|17/17|覆盖不足，不能放行|
|网关独立新增反例|1/1复现失败，P1|假凭据，网络0|
|原5辅助文件|SHA未变，沿用先前20/20|没有重跑或累计成新样本|
|完整工程/真实App/Edge/下载/独立库|NOT_RUN|安全门未通过|
|模型识别准确率|本轮未测量|真实请求0，费用0|

所有工程用量与390微元是模拟测试，真实支出为0。

## 预算补充依据

官方[人民币价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)和[Responses协议](https://api-docs.deepseek.com/zh-cn/guides/responses_api/)于本轮公开核验。按1,048,576输入和8192输出、输入3/输出9元每百万的上界推导3.219456元，预留3.30元。该值不是实测账单；缓存/低峰优惠不用于放宽上界。真实usage账单不等同，账单金额不可观测须NOT_OBSERVABLE。首调用前仍需有效期内公开证据/参数/候选/输入/评分冻结及网关安全门，不因预算模块通过便派发。

## 保护与交付

946逐字保护、13已有例外、此前5源码、前run16证据均未变，原252816字节与本次256271字节日志前缀匹配。旧Expected/freeze/dataset/checkpoint/cache、历史FAIL、原42/42/40/42/17以及当前环境3/1不改。全源码SHA及未创建路径见IMPLEMENTATION_SNAPSHOT，日志/检查见ENGINEERING。工作区和Git换行身份分别记录，不放宽保护。

仅精确提交本run报告/日志、CURRENT_CONTEXT与追加日志；9未提交实现不暂存。Git最终提交/推送号以交付答复和实际远端为准。没有API/剪贴板/真实库/新语义数据/新依赖/部署访问。

## 唯一下一步：同包修复此安全门后继续用户闭环

最小范围仍在现有41路径内，优先只修改新gateway和对应测试：在任何原始记录、返回或结算前，验证JSON解码后的键/字符串和output_text结构，保留原始响应但拒绝含凭据的响应；补直接/Unicode转义/嵌套输出的反例及正常成功对照。拒绝不得写raw/回传敏感值，不得释放未知预留或重发；独立复核后继续App/OCR/确认保存，不重做预算或PLAN。

可批准提示词：

> 继续同一MAINLINE-REAL-INPUT-01，明确授权修复continuation-20260906a审查登记的JSON转义凭据反射P1。先核对最新审计Git/远端、9未提交实现SHA、946保护、前run16证据和日志前缀；不回切、不重做PLAN或重复实现。保持41路径，优先新gateway及其Node测试，先复现转义反射和正常对照，在任何记录/返回/结算前检查解码后的JSON键值与嵌套模型文本，凭据命中保持未知预留且不重发。不得仅继续堆序列化文本替换，也不得把正常响应全部拒绝。独立复核通过后，在同包继续原获准读取、真实App核对确认、隔离保存、工程/Edge/下载读库/Git交付。3.30元滚动预留/24次10元/原模型参数/0 verifier Repair retry不变；首模型请求仍须全部发送安全门与输入候选评分绑定通过。只使用合法服务端配置，不读剪贴板或真实库、不接稳定入口、不部署；其余保护和重大安全停止条件保持。
