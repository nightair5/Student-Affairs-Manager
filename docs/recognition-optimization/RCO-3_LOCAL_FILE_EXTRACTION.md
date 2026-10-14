# RCO-3 本机文件提取验收记录

## 结论

`RCO-G3 PASS / ZERO MODEL CALLS / NO_PROMOTION / DO NOT LAUNCH`

这项结论只证明匿名、字节级组件夹具覆盖的本机提取契约成立：文件内容按格式进入可编辑文字，失败和未覆盖范围不会冒充完整。它不证明模型正确率、真实材料泛化、真人修改时间、浏览器商业验收或上线资格。

## 已实现契约

- TXT / Markdown：从原始字节判定 UTF-8、UTF-8 BOM 或 GB18030；解码失败或乱码特征 fail-closed。Markdown 标题、列表、表格、引用与代码围栏不被压平。
- DOCX：浏览器内解压 OOXML，按文档顺序读取标题、编号段落和表格单元格。中央目录预检限制 500 个条目和 8 MiB 解压总量；加密、Zip64、宏、嵌入对象、外部关系、缺失主文档和损坏包均拒绝。
- PDF：每页独立记录 `parser / ocr / empty / error`；无文本层页才进入本机 OCR，文本页与扫描页可在同一文件中组合，页码和实际路由写入可核对文字。
- 长内容：最多 500,000 字；上限内形成 4,000 字块、200 字有限重叠、稳定顺序、字符范围和 SHA-256。超过上限整体 fail-closed，明确要求拆分，不再只留开头。
- UI：文件选择支持 DOCX；混合 PDF 显示“文本层 + 本机 OCR”，并继续使用逐次图片授权和选页边界。

## 匿名组件夹具与对抗检查

测试在内存中构造真实 `File` 字节，包括 UTF-8 BOM、GB18030、不可解码字节、结构化 Markdown、真实 ZIP/OOXML DOCX、外部关系 DOCX、长文本、文本 PDF、混合 PDF、扫描 PDF、OCR 失败/页数上限和陈旧异步任务。未使用真实学生材料。

关键断言：

- 结构化 Markdown 的五类边界逐字保留。
- DOCX 标题、编号和表格仍按源顺序出现；外部关系在正文解析前拒绝。
- 混合 PDF 页路由为 `parser → ocr → parser`；7 页扫描夹具只 OCR 前 6 页并把第 7 页明确标为 `empty + partial`。
- 长文本最后一个 chunk 的 `end` 等于全文长度；每块都有 64 位十六进制 SHA-256；超过 500,000 字返回空正文错误，而非截取开头。
- 过期文件选择在提取、OCR 进度或文件哈希阶段均不能回写当前 UI。

## 验证证据

- `npm run recognition:contract:check`: PASS；Schema 与时间 AST 生成物无漂移。
- `npm run lint`: PASS。
- `npm run typecheck`: PASS。
- `npm test`: PASS；Vitest 283、server 8、Cloudflare Worker 25、time parity 1、multimodal evaluator 23、Firebase Functions 5，共 345 tests。
- `npm run build`: PASS；保留既有主 chunk 超过 500 kB 警告，不将其表述为性能通过。
- `npm run security:scan`: PASS；250 个 source/build files。
- `npm audit --audit-level=high`: PASS；0 vulnerabilities。
- `npm run cloudflare:check`: PASS；三套 Wrangler dry-run；未部署。
- V2/V3 dataset、OCR、checkpoint、summary、freeze 共 10 个受保护文件的 SHA-256 与 RCO-3 启动前一致；`.evaluation-cache` 无 Git 变更。

## 未运行与后续边界

- 模型 / Repair 调用：`0 / 0`。
- Secret：`NOT_ACCESSED`。
- 真实材料 / 真人研究 / Commercial Holdout：`NOT_USED / NOT_RUN / NOT_RUN`。
- Preview / Production 部署：`NOT_RUN / NOT_RUN`。
- 图片介质预处理、CER、关键日期数字、下游 Task/TimePoint 和 OCR p95：属于 RCO-4，不由本阶段结论覆盖。
