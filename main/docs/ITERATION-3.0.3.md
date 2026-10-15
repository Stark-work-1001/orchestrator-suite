# 3.0.3 / Preset isolation and UI stability

## 中文

- 修复旧挂载清理共享样式导致的界面退化；入口保持单行，进度标签紧凑，详情浮层留在视口内。
- 三阶段、11 步仅用于本套件自建“调度编排模式”。其他 Agent 预设仅在开始时进行一次多层对照，返回模型理解，状态只显示“已经编排”。
- 移除重复的计划/委派服务和工具过滤；套件不审批或拦截其他插件。其他调度预设保持独立。
- 任务理解先进入系统上下文与进度展示，由模型向用户汇报；执行、增量需求、待办与验收证据仍可展开查看。

## English

- Fixes shared stylesheet disposal and crowded controls with slot-owned styles, compact labels and viewport-bound details.
- Restricts three phases and eleven steps to the suite’s own dispatch preset. Other presets get one initial layer comparison, the model’s understanding and an “Orchestrated” indicator.
- Removes competing planning/delegation services and tool filters. Other plugins and their dispatch presets remain independent.
- Understanding enters system context and progress before execution; the model reports it to the user. Incremental requirements, todos and acceptance evidence remain inspectable.

Automated regression and composition checks do not establish live DSH activation or a passing judge evaluation. Reload through the host workflow and check version 3.0.3.
