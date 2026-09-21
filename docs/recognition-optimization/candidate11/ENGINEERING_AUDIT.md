# C11 A 工程包执行审计

日期：2026-09-21。起点：593ab7847a5791f8e3fbc6e4b82f94a6c4d0ebb5。

## 授权与 A0

用户已明确授权连续完成 A1—A5、本机独立入口、必要锁定依赖恢复、测试、提交并推送 C11 当前分支。禁止新模型请求、真实账本写入、旧用户库操作、Schema/依赖升级、合并和部署。

- 分支 codex/e2-candidate11-blind-eval，upstream 同名 origin 分支；开始工作区干净。
- Node v24.18.0 / npm 11.16.0；根仅存在 .env.example，不加载任何环境文件。
- 原 BRANCH_BASELINE.json 中 84 个保护文件逐字节 SHA256 全部匹配。
- 账本快照 644 行、314 个 reserve；本分支副本只读，不作为 writer。
- 当前只存在规划，无 candidate11 实现。candidate03/10 保持冻结。
- 原 6632、旧浏览器用户库和线上入口不操作。新入口必须精确校验 Origin/Host 并使用独立数据库。
- 按锁文件恢复依赖；安装脚本仅涉及 esbuild/workerd 二进制及 Tesseract 赞助提示，安装时禁用 lifecycle 后检查现有平台二进制可用性，避免无关脚本执行。锁文件不变。

## 阶段状态

A1—A5：IN_PROGRESS。模型质量 NOT_RUN；真人收益 NOT_OBSERVABLE；合并/部署 NOT_RUN。

## 验证记录

待实际执行后填写。历史 RCO-5-007 冻结锁文件差异不修改、不豁免；本轮结果独立记录。

### A1 评分与历史诊断

- 44项评分反例/正常对照通过。独立 scorerVersion、最大基数一对一、字段判定、歧义裁决、空集合null及解析失败分母已实现。
- 24份历史原答的请求、响应、账本哈希链和逐项usage结算一致，现有客户端解析和语义组合全部接受。
- 已定义检查：A 9/12、B 11/12；全部24个参照仍为partial，因此完整案例准确率null、NO_PROMOTION_REFERENCE_INCOMPLETE。不是人工盲审或真实转化率。
- lint、类型、无.env构建通过；完整Vitest首次存在3个旧测试的检出/载体问题，RCO-5-007冻结图也受检出行尾影响，A5继续核验，不修改旧断言。
- 契约检查首次受Windows混合换行影响。核实四个文件与HEAD和父工作区只差行尾后，在本工作树恢复父原字节，未改变Git内容；识别契约与时间AST检查随后通过。无Schema升级。
- 全部标准测试分段执行，不因早期失败跳过后续Node/Functions。原始日志位于.data/candidate11/checks/，最终汇总另存可提交报告。

### A2—A3 候选构造与执行保护

- candidate11 公共底座为 candidate03 加完成标准最小修正；四变体 V00/V10/V01/V11 仅切换元指令与教学例，模型及其他参数固定，可见版本一致。保留旧八例并新增两例完成动作/明确结果目标对照。candidate03/10 请求重建逐字一致。
- prepared / binding / result / analysis 贯通候选、提示词、例子、Schema、输入、请求、模型配置和评分器身份；从原上下文重新构造校验，不能靠重算外层 hash 接受错误元数据。
- 所有阶段产物均为 ENGINEERING_NO_AUTHORIZATION / NOT_RUN；没有 C11 付费运行授权或生产接入。有效 prepared 仍被 dispatch 拒绝。
- 7 项候选构造 + 6 项身份测试通过；新网关失败保护 9 项通过。原预算/网关全量 124 项通过，全部使用独立临时目录和 Mock；没有真实模型请求、Secret 读取或真实账本写入。
- lint / typecheck / build / security 通过。完整测试的旧历史换行问题已逐项恢复原字节；旧 RCO-5-007 锁文件冻结差异保留。A5 最终全量结果继续单独记录。
