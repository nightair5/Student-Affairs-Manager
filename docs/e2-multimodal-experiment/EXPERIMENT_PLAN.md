# E2-MM 多模态识别实验计划

固定版本见 `2026-08-31_EXPERIMENT_PLAN.md`。该文件是当前入口；任何协议修改必须先写新的日期版本、记录原因，再更新本入口。

当前状态：方案冻结；独立 Preview Secret 已配置；36 条匿名合成未见材料及本机 OCR 已在首个模型调用前冻结，三臂真实运行仍为 `NOT RUN`。该批次只能作为 synthetic proxy；A–J 浏览器验收、真实未见材料、真实用户修改时间与推广结论均为 `NOT RUN`。部署证据见 `PREVIEW_DEPLOYMENT.md`，冻结哈希见 `SYNTHETIC_UNSEEN_V1_FREEZE.json`。

核心门槛摘要：两批未见材料中，图片+文字版必须稳定优于文字版与图片版，Task F1 每批至少提高 3 个百分点、Major Correction 每批至少下降 5 个百分点、用户修改时间中位数至少下降 15%，且隐私/安全/浏览器 A–J 全 PASS；否则稳定模型、RC.4 与 Production 不变。
