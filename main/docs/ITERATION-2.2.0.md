# orchestrator-suite 2.2.0 迭代记录

日期：2026-10-12（Asia/Shanghai）。交付范围：本套件目录、自有 `dispatch-orchestrator` 预设及该套件安装链接。用户明确确认只修改套件自有预设。

## 需求与决策

模式中文名统一为“调度对照编排模式”，英文 ID 保留 `dispatch-orchestrator`。参考宿主 dispatch 的组织形式；不改 dispatch、standard、ptc 等原预设，不引入其内部接口。

任务状态采用 agent-swarm 的标题栏紧凑形式，组件、样式、接口与状态均归本套件所有。不依赖、修改或重复注册 `dsh-agent-swarm`。去掉原右侧栏页与 sidebarRight 服务依赖，标题栏常驻当前阶段，点击展开七阶段及明文证据。普通主会话与调度对照编排主会话均可使用；子会话不会混入主任务记录。

relic 保留工具、记忆、身份、组织协作四个判断层。工具层新增环境展示，并使用公共 `skills.list`、`tools.schemas`、`pluginManager.listBundles/listPlugins`、`agentPresets.compositionInventory` 探查。技能库原文与目录资产属于资料，不替代用户指令。

归属规则：插件与套件同级；bundle 的 declared row 能证明 MCP 所属，规范化真实路径能证明技能、环境所属。有证据时在所属插件/套件的详情中嵌套展开；未知归属单独列出。插件目录中的 `SKILL.md`、`pyvenv.cfg` 只按标记发现，不假装已加载技能或已验证解释器。MCP 工具命名空间表示已注册，不等于连接健康；仅 runtime 行无法证明服务调用成功。独立环境发现范围是会话 cwd 的 `.venv`、`venv`、`env`。目录深度、条目与总访问数量均有上限，不执行解释器、不读取私有插件配置或凭据。

看板打开时，在上次请求结束后等待 10 秒串行更新；关闭后清理轮询，页面隐藏时暂停请求。进度默认 1500ms 串行轮询，不扫描资产、不调用裁判；页面隐藏暂停。宿主不增加后台无限扫描器。

## 引导与状态逻辑

原始用户提示词由宿主用户消息事件捕获。`dispatch_plan` 保存 L0/L1/L2 分诊，`dispatch_context` 保存四层判断及综合结论，普通模式也可使用。宿主在后续 `system-prompt/assemble` 的系统 section 中明文记录原始提示词、分诊、对照、裁判结果、综合结论和验收结果；不是伪造用户可见 system 角色消息，也不是要求展示隐藏推理。

调度对照编排流程：用户提示词 → 任务分诊 → 多层对照 → 裁判方案评价 → 综合执行 → 交付验收。`dispatch_review` 沿用已有 `verifier_compare` 公共工具，以 `review_stage=proposal` 提交本轮原始请求及真实主模型判断。`dispatch_commit` 记录主模型采纳/拒绝建议或裁判不可用原因；不再把裁判调用成功作为执行门禁。

资产发现失败、某层无条目、裁判未配置/缺失/超时属于降级，保留实际错误并允许独立工作继续。取消保持暂停语义，追加用户约束使旧裁判与旧验收失效。工具调用不能改写其他插件权限与安全门禁；本套件降级策略不绕过验证器自身的 smart/strict 或宿主安全控制。

`dispatch_accept` 通过可选公共工具 `verifier_current_session` 请求实际会话证据评价。返回评价不自动声称“通过”：公共结果的分数、胜者、criteria 与诊断供主模型解释，本套件不猜测验证器私有阈值。缺失、失败、取消与未调用分别可见。方案评价获胜、主模型 idle、轮次结束均不等于交付验收通过。

七阶段为 input、triage、compare、verify、assemble、execute、accept。状态区分 pending、active、done（有证据）、failed、paused、ended、degraded、skipped。未提交判断不会因后续阶段开始被伪造为完成。

## 验证器关系（只读核对）

来源：`../dsh-llm-verifier/src/index.ts` 中 `verifier_compare`、`verifier_current_session` 注册及 `engine()`，`src/caller.ts` 的 `config.llm.stream(options)`。

已验证的源码事实：方案裁判通过验证器内部 LLM 接口调用已配置模型，未创建用户可见子智能体对话；真实评分、诊断通过主对话工具结果返回。最终会话验证为独立接口。套件不读取验证器私有配置，不替它开启功能或选择模型。此次没有修改验证器源码、配置、依赖或生命周期。

未验证：本次没有向裁判服务发送真实付费请求。自动验收是否发生仍取决于用户现有验证器配置；独立裁判结果没有伪造。

## 构建、装配与安装证据

- TypeScript 严格检查、生产构建通过；运行时仅 Node 内置模块和宿主 React，没有其他插件依赖。
- 12 项自动测试通过：普通模式、降级继续、真实请求封装、取消、任务变化、验收与方案隔离、主/子会话隔离、系统消息记录、路由范围、嵌套资产、客户端注册与三种关闭路径。
- 官方 desktop CLI 在套件 `.validation/dsh-home` 内对现有完整 desktop profile 的副本执行 `--dump-config`，成功包含新入口和新预设；原 profile 不变。此检查只是组合配置，不是活体激活证明。见 `preflight.json`。
- 只读复用现有 dsh-devops 的 `auditAll` 检查本机插件目录；套件无 findings，总计 0 error、6 个其他包历史 warning。没有执行其会临时改写其他插件的 selfcheck。见 `plugin-audit.json`。
- desktop profile 已以 `link:` 选择本套件。只把本套件 SymbolicLink 换为 Junction，目标是交付目录（本机绝对路径不随包分发）；旧链接保留为 `orchestrator-suite.previous-link-2.2.0`。见 `installation.json`。
- profile 清单、补丁、根配置和锁文件哈希不变；其他插件 9402 个文件安装前后哈希一致。安装核对脚本曾因并行打开过多文件触发 EMFILE，链接已完成；修正为每批 8 个句柄后重新核对通过。

开发工具链使用显式 `ORCHESTRATOR_TOOLCHAIN` 指向本机已有 dsh-agent-swarm 的开发依赖，仅用于构建与测试，无下载、不修改该插件；发布运行时完全独立。正常开发可在本套件安装 package.json 中的 devDependencies。

## 实机限制与待办

当前 Codex 会话没有 SynaBun recall/remember、浏览器、DSH plugin_manager 或 cordis_inspect_query 工具。不能按 AGENTS.md 的活体门禁验证 `application: applied`、Config/Tool/Slots，也无法做真实宿主明暗主题验收。没有用其他浏览器替代，没有为试运行重启 DSH。当前进程可能缓存 2.1.1，新版本在磁盘/junction 已安装，但运行中生效未确认。

待办：通过 DSH 的插件管理入口应用新版本/安全重启，确认新工具与槽位 active，再按复现步骤核验普通模式、调度对照编排模式和裁判交付评价。此待办不影响压缩包本身的构建与静态装配证据，不能写成实机完成。

## 复现与回滚

开发验证（本机工具链示例）：

```powershell
$env:ORCHESTRATOR_TOOLCHAIN='<suite 目录>/../dsh-agent-swarm'
node scripts/typecheck.mjs
node scripts/build.mjs
node --test tests/*.test.mjs
node scripts/preflight.mjs
```

应用后新建普通模式主会话，发送任务，确认标题栏显示进度而右侧栏没有本套件页。展开详情，使用关闭按钮、Escape、面板外点击退出。提交 `dispatch_plan → relic_prepare → dispatch_context`，检查系统消息记录和后续执行。资产层失败或裁判不可用应显示降级且不阻塞独立工作。

新建“调度对照编排模式”主会话，验证 `dispatch_plan → relic_prepare → dispatch_review → dispatch_commit → 实施/自检 → dispatch_accept`；裁判真实结果与最终验收分开记录。追加任务约束后旧结果失效。打开看板切换查看范围，确认插件内部技能/MCP/VENV 嵌套、独立资产单列和更新；切换明暗主题与窄窗口核验。

旧运行版冻结于 `archive/2.1.1-runtime`。回滚时用其中 package.json、cordis.patch.yml、lib、presets、locale 恢复到本套件同名位置；Junction 目标不变，再经 DSH 插件管理应用/重启并核验 2.1.1 工具。源代码若需完整复原，旧 2.1.0 交付包仍在用户下载目录；冻结目录用于本机 2.1.1 运行时恢复，不伪称完整旧源码快照。

商务报价、合同、产品路线图不适用于此受限插件迭代。本记录统一保存需求、实施决策、问题、结论、环境变更、版本谱系与复现入口，不额外生成空文档。
