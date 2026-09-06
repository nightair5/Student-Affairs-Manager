# 补齐已批准旅程入口

PLAN J06要求取消无替代，J07明确要求共享事件时间。总表逐项核对发现旧工程浏览器菜单未包含这两项，不能用共享材料代替共享事件，不能提前报J06/J07完整PASS。

仅在原26路径中修改engineeringReplay.ts、browser.tsx、semanticConfirmation.test.ts；不改产品决策/Schema/确认/仓储。共享事件复用原linkedEvent和MAINLINE04登记的共享边；取消关系fromDirectiveId=null，保留原通知独立新事项，不删除任务或原文。都是已见人工工程变形，不是新识别规则/数据集/盲测。

新增3条：共享事件先后/反序、取消关系显式处置与独立新要求成功。首轮36项中34过/2失败，仅完整事件比较的updatedAt由实时钟相差毫秒；保留该失败日志。传入接口已有的固定NOW测试时钟，完整对象相等断言原样保留；没有按案例编号或原句修改业务。原128项断言未改。新定向131/131（59个05+72个旧04），旧V2内存42/42不退化。

日志：C:\Users\Winner\AppData\Local\Temp\rco-mainline05-safety-5sH2HJ\journey-coverage-01.log、journey-coverage-02.log。审查与最终工程、真实新菜单另列，未运行不得算通过。模型准确率本轮未测量。
