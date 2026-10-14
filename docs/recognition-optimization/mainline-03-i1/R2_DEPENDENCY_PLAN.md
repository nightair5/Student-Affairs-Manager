# R2 最小开发类型依赖

- 起始Node v24.18.0，TypeScript ~5.7.2；三份测试的node:fs/node:crypto共6个TS2307已复现。声明、锁文件和安装目录原先均无@types/node。
- 公开npm registry实查：@types/node 24.13.3（2026-07-08发布），MIT，DefinitelyTyped/types/node维护；无生命周期脚本，仅依赖undici-types ~7.18.0。精确添加24.13.3开发依赖，必要undici类型按锁文件精确版本记录；不安装8.x新主版本。
- 仅类型声明，不新增生产运行时依赖。Node ambient globals会进入现有未限制types的TypeScript项目；保留DOM类型与现有配置，用两个项目类型检查发现冲突，不用any/ignore/排除文件隐藏。
- 安装使用全新临时npm缓存、公开registry、ignore-scripts/no-audit/no-fund。先后对比每个既有lock package对象、根依赖和package脚本；无关条目变化立即停止，保留现场。
- 旧checker/旧保护清单只读，按R2_BASELINE的两个明确依赖例外执行原检查组成命令；不是修改旧保护证据。
- 本文件为执行前依赖影响说明，尚不代表安装、工程或产品通过。元数据地址：https://registry.npmjs.org/@types%2Fnode 和 https://registry.npmjs.org/undici-types 。模型准确率本轮未测量。
