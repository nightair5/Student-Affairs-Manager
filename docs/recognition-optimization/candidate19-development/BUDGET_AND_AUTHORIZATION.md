# 本批具体预算申请（尚未授权）

2026-10-04。本卡只申请新批，不创建grant或发送。此前D26 US$5.30许可已耗尽，不复用。当前本批12/12 NOT_RUN，model/grant/reserve/settle0，raw/receipt/lock0，本地execution目录不存在。

批次`C19-C17-C19-DEVELOPMENT-R1`，C17/C19，6新来源×2臂=12；每身份最多一次，零重试/repair/verifier/额外样本。生成代码ce97b325f38897e87a55b63ddaea9470e8ea4156。Manifest SHA `794f0949a3342f0fbad6a70cb5916e69bf7f447757260bf2aae78398fef47c79`；身份SHA `7d969f0aeb216bd158fc2a32346a5b1863fa189e5b206386be2205bd5708a5e0`。身份不回写授权。

## 官方核价与可证明上界

2026-10-03 17:27 UTC（北京时间10月4日）只读核[DeepSeek官方价格](https://api-docs.deepseek.com/quick_start/pricing/?helper=penn&method=individual)及[Responses协议](https://api-docs.deepseek.com/guides/responses_api/)。直接无参数页面一次超时，带官方查询参数页面成功，未靠错误页判断价格。`deepseek-flash`路由当前服务DeepSeek-V4.1-Flash；1M上下文、最大384K输出，本批固定输出8192。Responses temperature0、reasoning.none、stream.false、text JSON Schema支持；输出限包含可见与推理tokens。

每百万tokens：峰时缓存未命中输入US$0.30、命中0.006、输出1.20；非峰输入0.15/0.003、输出0.60。峰时为周一至周五UTC01–04和06–10，法定中国节假日除外。预算用峰时/全部缓存未命中，不依赖实际时间或缓存折扣。官方所列为input/output token扣费，没有列出本批文本请求额外固定费；若调用前发现附加规则或路由改变，重新预算，不能继续套用本卡。

采用完整官方上下文上界1,048,576输入tokens（对1M的保守上界），另加冻结8192输出tokens，**不是将请求字节数当token**。

- 单元：ceil((1,048,576×0.30 + 8192×1.20) microUSD)=324,404 microUSD，即US$0.324404。
- 12单元最坏合计：**US$3.892848**。
- 建议本批美元硬上限：**US$3.90**。

真实usage：NOT_OBSERVABLE（未调用）。供应商实际扣费：NOT_OBSERVABLE；保守reserve/内部settle不等于供应商账单。[本轮只读价格快照](PRICE_SNAPSHOT.json)不可直接用作未来派发核价或授权。未来usage缺失按单元上界内部结算并停后续，不能猜实际费用或以余款扩样本。

## 用户只需明确这一项授权

> 授权仅执行 C19-C17-C19-DEVELOPMENT-R1 冻结的 Candidate17 vs Candidate19 共12个 deepseek-flash 请求，费用硬上限US$3.90；允许且只允许为本批创建一个新grant并逐单元reserve/settle。每身份最多发送一次，不含额外样本、重试、repair、verifier、真人、Holdout、默认替换、合并或部署。重新核价超上限、身份漂移或状态不确定立即停发。

上文是待用户亲自批准的文字，不是本文件已给出的授权。首个grant之前重新核价、路由/上下文/输出/计费、当前已提交已推送HEAD、原Manifest/12identity/requestSHA及账本完整链。法定价格变动等任一关键条件不确定在grant前停；普通本地工程继续。

## 获准后的现成入口

真实许可原文和绑定文件只放本机`.data/candidate19/execution/USER_AUTHORIZATION.txt`、`AUTHORIZATION.json`、`PRICE_EVIDENCE.json`，不进Git。hostVersion=`scoped-execution-host-2`，授权绑定batch12/模型/route、Manifest和身份SHA、每份identity/requestSHA、代码snapshot、当前同步committedHead、账本新基线rows/bytes/SHA、有效价格及唯一新grantId。核价证据role=`OFFICIAL_PRICE_VERIFIED`、tokenBoundMethod=`FULL_OFFICIAL_CONTEXT_UPPER_BOUND`、reasoningMetering=`INCLUDED_IN_OUTPUT_TOKENS`。本卡不可直接复制为已批准AUTHORIZATION。

复用命令：

```text
node scripts/prepare-candidate19.mjs --verify
node scripts/candidate19-execution-host.mjs --verify
node scripts/candidate19-execution-host.mjs --resume-read-only
```

有本批新许可和绑定原件且全部安全门通过后，才使用`--prepare-authorized`（一次新grant），按ordinal逐次`--dispatch-next`。跨进程锁→reserve→发送前持久状态→一次send→raw原字节/SHA/真实usage→settle。任何send/raw/settle/state不确定封存HALT并保留锁，不删文件/锁开第二批；不以没有raw推断未发送。只有12单元确定、链与本地一致、无halt/lock后，`node scripts/report-candidate19.mjs`才生成比较结论。不再新写“准备准备包”。

当前账本只读971行，SHA`7b1d1935254a7d7830e1d03892d12895707b71107dfc1bfb611f3459e839367d`；这是核验快照，合法追加须定位而非改旧Manifest。缺许可prepare/dispatch已实际拒绝，见[机械拒绝证据](evidence/NO_AUTHORIZATION_REFUSALS.json)。
