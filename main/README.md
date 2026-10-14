# Orchestrator Suite 3.0.2

[English](README.en.md) · [版本变更](CHANGELOG.md) · [发布说明](docs/RELEASE-NOTES-3.0.2.md)

DeepSeek Harness（DSH）智能体使用流程套件，提供**编排看板、任务进度状态栏、调度编排模式**。它帮助用户看清模型在哪个环节理解、执行或验收出了问题，不替项目指定技术实现。

每个环节需要真实查看、评估或尝试，并提交公开理解；理解之后的执行选择保持引导性。未查看、已评估无变更、已修改、验证失败分别展示，不伪造理解或验收通过。

## 3.0.2 新增

- 复用已挂载 `dsh-llm-verifier` 的公开工具；看板设置本任务的规划路由和重复次数，展示实际返回的裁判模型、分数和评价，不修改原验证器。
- 综合装配记录任务认识、具体计划和初始待办，写入系统 section 与进度。没有拆分列表时已提交计划成为一项待分解事项；空列表必须说明原因。
- `dispatch_refine` 沉淀执行中加深的认识、实际证据及待办/计划增量，不必等待用户新消息。`dispatch_checkpoint` 随时重读规划依据，不调用裁判。
- 最终验收继续由原验证器完成，独立结论记录完成内容、实现内容、整体效果和限制。建设反馈包含项目缺项、问题、套件运行及建议。

## 三阶段与工具

| 阶段 | 步骤与记录 |
| --- | --- |
| 1 规划 | 原始输入 → 分诊 → 当前注册工具/验证/团队协作/身份四层 → 实际第三方验证 → 综合装配认识与执行计划 |
| 2 执行反应 | 用户补充和执行认识深入 → 待办新增/修订/状态推进或明确无变更 → 持续执行与证据沉淀 |
| 3 验证交付 | 3-1 全链路需求/成果对照；3-2 验证器验收及结论；3-3 项目缺项、问题和套件反馈 |

1. `dispatch_plan({inputUnderstanding, triage})` 理解输入并读取能力。
2. `dispatch_review` 提交对照及真实候选：两个用 `verifier_compare`，三个以上用 `verifier_select`，均为 proposal；真实过程用 `verifier_track`，检查点从 1 开始。无候选兼容路径是策略与直接实施基线对照，局限会明示。
3. 读完真实结果/失败，`dispatch_commit({reviewUnderstanding, taskUnderstanding, conclusion, plannedTodos})` 装配；事项含 `text` 和 `reason`。空列表须 `noTodoReason`。
4. `dispatch_adjust` 评估用户补充；`dispatch_todo` 维护事项；`dispatch_refine` 记录执行理解、证据、影响和增量。无变化须明确 `covered` 或 `not-needed` 及覆盖依据/理由。
5. `dispatch_checkpoint` 重读原始/补充输入、层对照、第三方评价和当前规划。
6. `dispatch_delivery` 对照需求与成果并实际调用 `verifier_current_session`；读完当前尝试后 `dispatch_conclude({completed, implemented, overallEffect, limitations})` 形成专用系统结论。
7. `missingItems / problems / suiteStatus / suggestions` 独立记录建设反馈；`dispatch_export` 导出完整提示词、历史、认识与缺口，仅留本地。

原始输入保持不变，补充原文全部保留。重复仍评估，之后不重复修改；执行增量不重跑初始规划。系统 section 是模型后续请求的明文上下文，模型仍需向用户表达结论，不伪造聊天中的 system 消息。

## 验证器和状态边界

裁判模型及内部路由由 DSH 的 LLM Verifier 设置管理。套件看板仅改本任务下一次规划的公开工具选择和重复次数，保存不立即发起调用。不改验证器源码、配置、依赖或生命周期；不猜测私有通过阈值。

缺少候选、未注册、失败、取消、过期分别记录。相同交付修订不会隐式重复已完成/失败的验收；新需求、计划、待办或交付内容使旧评价失效。可显式 `dispatch_accept` 重试。流程完整、评分返回、idle 和验收通过是不同事实。

首条输入默认 600 非空白字符，或至少 4 段且总计 120 字采用完整评估；短任务简短评估同样环节。身份按阶段、规模和证据报告，不自动切换角色插件。进程内任务记录跨轮次保留，重启前导出。

## 开发、发布与安装

外围目录：`dev/` 是完整本地开发环境、依赖和私有验证报告；`main/` 是脱敏 GitHub 源码；`release/` 是脱敏交付物。本仓库对应 `main/`，不含本地 dev、安装 profile 或完整用户提示词。

Node.js ≥22.19；DSH `>=0.2.1-0 <0.3`。源码先 `npm install`，然后：

```sh
npm run verify
node scripts/pack.mjs
```

发布包自包含依赖。工具链缺失时明确报错，不借用其他插件依赖；真实 profile 组合需部署方提供环境变量，未配置如实标为 skipped。

原位更新只覆盖本套件发布文件，保留本地配置，覆盖前备份、核验外围文件；不改其他插件、状态栏、预设或 profile。磁盘更新不等于 DSH 已加载，参见 [部署说明](DEPLOYMENT.md)。

自动检查覆盖类型、构建、依赖、回归、组合和隐私；打包后逐文件哈希对照及复扫。测试裁判明确为替身，不能证明真实宿主或付费验收。公开材料另行脱敏，见 [隐私边界](PRIVACY.md)。授权分区见 [LICENSE](LICENSE)，依赖保留原许可证。
