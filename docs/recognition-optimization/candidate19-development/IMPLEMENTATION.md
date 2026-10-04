# 实际录制后的产品机制修复

2026-10-04。先前新生成契约/普通事件生命周期实现见本目录冻结代码ce97b325；此阶段仅新增非冻结文件。当前程序转换`source-grounded-nonaction-projection-1.0.1`，不是新Prompt候选；C17/C19生成文件、v11、请求及原分数不变。

| 原文→原答→首次页根因 | 代码路径 | 修改/不变边界 |
|---|---|---|
| C19原答把“不需要重新登记/不要发送”写成negative动作；冻结桥仍投影为待办 | src/recognition/directiveDispositionProduct.ts | 仅动作对象在同片段、原文直接否定、模型状态一致、无引用/共享主事实时转信息；保留原实体与决策审计，不猜事实 |
| “不要忘记发送”、临时/条件禁止或问句不能按“不执行”删除 | 同上negativeEvidence；版本1.0.1 | 限明确否定直接前缀，问句/双重否定/提醒/条件时点保留RETAIN_BLOCKED；不是见“不要”就删 |
| 缺事件或错引用不能用转换补答案 | 同上applyRecordedDirectiveDisposition | C17遗漏仍遗漏；缺主实体/图冲突在原编译层仍拒绝，剩余事项继承原coverage/conflict阻断与未选状态 |
| 实际回答接普通首屏、正式保存、失败恢复与独立读回 | src/experiments/candidate19Recorded/browser.tsx；scripts/candidate19-recorded-data.mjs；scripts/serve-candidate19-recorded.mjs | 固定2份已settle raw，仅回环/全新库；普通App、ReviewSession、DomainCommitPlan、Repository和D27安排；不创建平行正式事实链 |

`projectDirectiveDisposition`不原地修改输入；`applyRecordedDirectiveDisposition`保留originalAdapted、originalSemantic、frozenBridgeResult、productDisposition、recordedProvenance、scopeRebinding与来源原基准时间。源scope到新Source的映射可逆，原raw持久化不改；原答、候选转换、比较后程序转换、用户输入不混合。

录制loader在提供数据前核state.SETTLED、HTTP200、request/identity/source/response SHA；只读取确定的2份，没有伪造10份NOT_RUN。拒绝来源不会成为下一provider缓存；普通App先保存Source/Version/Run/Draft再生成首屏。事件仍是事件，模糊时间不建确定日历日期；原deadline与个人计划分开。

## 不是为答案做特例的反例

新增测试使用实际raw和不同匿名写法：无需、不必、直接不要合法；肯定、双重否定、不要忘记、条件时点、反问不能转无任务；被依赖的旧端点、共享主片段、无关coverage guard仍保留；正任务/材料/依赖/精确截止/独立事件图不变。实际Schema→公共decoder/compiler→新转换→ordinary draft→DomainCommitPlan→另一Repository读回，0任务/0项目/1事件/1未知时间。

src/recognition/directiveDispositionProduct.test.ts最终5个测试；scripts/candidate19-recorded-data.node-test.mjs两项读取/篡改反例。完整产品测试959通过/1跳过。不是将脚本兼容率或工程oracle当新模型准确率。

## 尚未修的真实缺口

C17把停查全文标information却没有event/time，程序保持遗漏，不按关键词补实体；当前这类“语义上有遗漏但没有结构坏引用”的全面覆盖仍依赖参照/真实裁决，不能称全部自动发现。C19其他5个来源未运行，所以资格、前置、材料/完成标准及修订的实际生成效果未知。关联否定只做局部阻断，普通完整取消/替代表示仍有原范围限制。S08旧材料参照争议及自由描述/标题未决不填满分。

正式提交后读回失败的恢复按钮在弹层外，需先点“稍后处理并关闭”，再“重新读回并核验”；保留清楚可操作路径，但多一步，未宣称最佳体验。工程时间混有浏览器/工具等待，不能外推真人省时。本包没有修改默认候选、新模型输入、依赖、v8或历史锁。
