# RCO-4 分介质 OCR 与质量路由验收记录

## 结论

`RCO-G4 PASS (COMPONENT) / SEEN_DIAGNOSTIC / ZERO CLOUD MODEL CALLS / NO_PROMOTION / DO NOT LAUNCH`

这项结论仅说明冻结的匿名组件夹具上，最终介质路由相对未预处理 Tesseract 同时改善字符、关键日期数字、任务对象代理和确定性时间代理，并满足组件性能预算。样本只有截图、照片、扫描件各 1 个，仍含错字，不是商业正确率、真实材料泛化或上线证据。

## 最终候选

- 截图：EXIF 方向归一化；在安全像素上限内做灰度、对比度拉伸、最近邻 2–3 倍放大；仅高把握白边可裁；版面模式保持 AUTO。
- 照片：EXIF 方向归一化；灰度、对比度、平滑 2–2.5 倍放大；不自动裁边；检测透视风险后提示重拍/人工核对，不做不可逆透视拉伸。
- 扫描件：最终保持原图、AUTO 版面模式。实测中强制单块、放大和对比度处理会损伤晚间时间数字，因此不自动“优化”可读扫描页。
- 所有介质：像素特征和 OCR 文本共同进入 `accept / review / retake`；高 OCR 自报 confidence 不能覆盖低分辨率、低对比度、模糊、暗部丢失、贴边或透视风险。
- 输出仍是可编辑 OCR 文字和待确认建议；图片本体仅驻留当前内存，不写入 Workspace、导出、日志或 Git。

## 被对抗审查淘汰的方案

- 自动中值降噪：首轮真实运行把基线 CER `0%` 恶化到 `19.05%`，会侵蚀细小汉字笔画，已从自动路由移除。
- 扫描件强制 `single-block`：合并行并破坏“晚上 11 点半”等关键时间，已改回 AUTO。
- 所有介质统一增强：照片/扫描件出现额外错字；最终改为介质专用路由，扫描件默认透传。
- 自动透视/拉伸：组件阶段没有可靠四角证据，存在抹掉边缘字符风险；因此只提示重拍或人工核对，不自动执行。

## 冻结组件证据

- freeze: `docs/recognition-optimization/RCO-4_COMPONENT_FREEZE.json`。
- status: `SEEN_DIAGNOSTIC / NOT_RCO_G7_HOLDOUT`；该组曾用于选择候选，永远不得改称商业 Holdout。
- inputs: Windows 微软雅黑渲染的匿名截图、照片、扫描件各 1 个；本机 `chi_sim` Tesseract；无真实学生材料。
- frozen hash check: fixture、实跑测试、预处理和评分器 4 个 SHA-256 在最终运行前逐一匹配。
- command: `RUN_LIVE_OCR_COMPONENT=1 npx vitest run src/lib/ocrLiveComponent.test.ts --reporter=verbose`（PowerShell 需先设置同名环境变量）。

最终冻结运行：

| 指标 | 未预处理 | 最终分介质候选 | 变化 |
|---|---:|---:|---:|
| CER | 15.48% | 5.95% | -9.52pp |
| 关键日期数字 exact | 66.67% | 100% | +33.33pp |
| 任务动作/对象 token exact | 33.33% | 66.67% | +33.33pp |
| 确定性 TimePoint exact | 33.33% | 66.67% | +33.33pp |

性能采用 Type-7 p95：30 次候选 OCR 的单图 p95 `73.24 ms`；3 个选页的逐介质 p95 保守相加上界 `180.11 ms`；Node 组件运行的增量 RSS 峰值 `40.26 MiB`。均低于 `15 s / 45 s / 512 MiB` 组件预算，但不是 Chrome/Edge 或参考手机的最终性能验收。

## 仍然存在的错误与证据边界

- 截图候选仍把“奖学金”识别为“荣学金”、“成绩单”识别为“成结单”。
- 照片候选仍把“填写”识别为“这写”、“证件照”识别为“正件聊”。
- 因每种介质只有 1 个匿名合成样本，不能计算可信置信区间，也不能声称已达到商业 CER 分格式门槛。
- 真实去标识/假名化文件、真人修改时间、Chrome/Edge/手机、连续来源内存残留、RCO-A…J 与商业 Holdout 全部 `NOT_RUN`。
- 这些限制使结论必须保持 `NO_PROMOTION / DO_NOT_LAUNCH`；RCO-5 及后续阶段需另行授权。

## 工程验证

- 云端模型 / Repair / Secret：`0 / 0 / NOT_ACCESSED`。
- 常规 `npm test` 不联网运行本机 OCR，实时组件测试通过显式环境变量单独执行，避免 CI 暗中下载或把可变运行冒充固定单元测试。
- `@napi-rs/canvas@1.0.8` 仅是 MIT 许可开发依赖，用于可复现生成匿名图片；生产浏览器代码仍使用原生 Canvas。
- lint、typecheck、build、351 个常规测试、1 个显式 live OCR 测试、secret scan（258 files）、0 high vulnerabilities 与三环境 Cloudflare dry-run 全部通过；未部署。
