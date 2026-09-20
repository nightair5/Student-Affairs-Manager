# 当前交接：开源方法与 candidate10

## 当前目标及授权
- 用户要求调研 GitHub/论坛开源方法，并优化产品识别转化。
- 本轮实现独立离线候选；模型调用与部署需要当前额外授权。
- 已向用户提出最多 24 次配对评测授权，答复尚未收到；不得按超时视作同意。

## 仓库
- C:/Users/Winner/student-affairs-multimodal-exp。
- 分支 codex/e2-multimodal-recognition-exp；起点 00330d91f53503a07b6adf3eb21238a3dc3792a9，起点本机/远端一致且干净。
- 本轮交付提交以当前分支最终 HEAD 为准。

## 固定基线
- deepseek-flash + candidate03 + reasoning=none。
- candidate10 只增加 8 个固定原创教学正反例；TypeScript 自行实现，借鉴 DSPy LabeledFewShot 思路。
- 未安装 DSPy/LangExtract/Docling/PaddleOCR/Instructor。
- 原文定位沿用既有索引；未改 Schema、正式确认/仓储、原候选或历史 Expected。
- 状态 OFFLINE_CANDIDATE_NOT_ADOPTED；没有接入公开网页或当前 6632 进程。

## 数据与证据
- mainline-real-input-01/runs/opensource-methods-20260920a/AUDIT.md：调研、取舍、实现和结论边界。
- mainline-real-input-01/runs/opensource-methods-20260920a/prepared/：12 份新编匿名通知的 24 个配对请求、分离参照与冻结哈希。
- 教学与开发例均由同一实施者编写，属于相近结构的开发对照，不是独立人审或未见盲测。
- 初步比较即使通过，也不能证明泛化或直接上线。
- scripts/prepare-opensource-recognition.mjs 只生成包，不能发送模型请求。

## 检查与阻碍
- Lint、类型、契约、新增 5 项测试、构建、安全扫描通过。
- Vitest 1393 通过、1 缺匿名素材路径失败、1 跳过；补既有路径定向重跑通过。
- Node 60 通过，旧 RCO-5-007 package-lock 冻结哈希检查仍失败；Functions 5 通过。
- 旧冻结检查未修改，故不能说全套测试全绿。
- 详见 mainline-real-input-01/runs/opensource-methods-20260920a/CHECKS.json。
- 模型调用本轮 0；累计仍 290，上限已用完。
- 账本 SHA256 acd7a263be10887b5727b695faaaa8970cba4c57fd253df33a80116dcf42d0e5 未变。
- 真实接受保存转化率 NOT OBSERVABLE；候选模型效果 NOT RUN。

## 待授权下一步
- 请求范围：最多 24 次 Flash none 配对（累计上限 314），继续原累计 20 元硬上限。
- 当前审计费用上界 13.663183 元，含历史未知调用预留；非实际服务商账单。
- 使用既有服务端凭证路径，发送冻结匿名正文/教学/契约；不得发送真实材料。
- 获准后先完成统一预算账本与调度显式适配及测试，再派发；不允许通过独立未记账 fetch 绕开。
- 保留原答、逐项语义裁决、时间和用量；失败停止，不隐藏重试。
- 评测授权不包含 Preview 或 Production；下一步是否盲测由结果决定。

## 上轮保存和下载证据
- 先前 6632 隔离库实际保存、独立只读读回和双路径下载已收口。
- 证据：mainline-real-input-01/runs/read-download-closeout-20260920a/AUDIT.md。
- 完整上轮交接保存在 mainline-real-input-01/runs/opensource-methods-20260920a/PREVIOUS_CONTEXT.md。
- 原 6 份未派发资料未用于本轮教学或开发集，保持原样。

## 交付核验
- 候选代码提交 f7a0f2da0d62625341864aa85e8e80bbd8e3ec20 已推送，远端核验一致。
- 实际集成父节点 119cebe 比源码基线 00330d9 多上轮 4 份文档更新，已保留；源码与账本哈希仍一致。
