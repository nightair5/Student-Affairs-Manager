# 直接图片/文件识别复验计划

## 目的

使用第三批全新未见匿名合成材料，复验 `deepseek-v4-flash-vision-exp` 在不接收 OCR 文字时，直接识别截图、照片和扫描文件的正确率。

## 冻结设计

- 36 份新材料：截图、照片、扫描页各 12 份。
- 与前两批 source/image 哈希均不得重合。
- 只运行 I 臂：原图或选定扫描页，加标题、参考时间和时区；客户端请求、Worker Prompt、上游消息和 Worker 归一化均不含 OCR。
- 本机 OCR 仅用于固定输入档案和诊断，不发送给模型；离线评分使用冻结 ground truth。
- 模型固定为 `deepseek-v4-flash-vision-exp`，temperature 固定为 0.1，评估器重试为 0。
- 任一请求失败都保留在分母中，并使正式质量汇总失效。

## 指标

- Task precision、recall、micro-F1。
- Complete Case Accuracy、Major Correction Rate。
- Material、TimePoint、Event、requires-action、Forbidden Task、Evidence Validity。
- 自动纠正操作数只作为修改负担代理；真人修改时间保持 `NOT_RUN`。

## 结论边界

该批次只能复验匿名合成材料上的直接图片识别能力。即使结果较好，也不能替代真实学生材料、真人修改时间、隐私安全和浏览器 A–J 验收，不能单独授权上线。
