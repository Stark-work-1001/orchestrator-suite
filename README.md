# Orchestrator Suite 3.0.2

[简体中文使用说明](main/README.md) · [English documentation](main/README.en.md) · [版本变化 / Changelog](main/CHANGELOG.md)

智能体使用流程套件：规划、执行反应、验证交付。每个环节查看并展示理解，执行方案保持引导性；复用已挂载 DSH 验证器，不修改该插件。

An agent workflow suite for planning, execution reaction and delivery verification. Each step records inspection and visible understanding while execution choices remain advisory. It reuses the mounted DSH verifier without modifying that plugin.

## Repository layout / 仓库目录

- `main/`: sanitized source, built assets, bilingual documentation, version history and validation summary. 脱敏源码、构建产物、中英文文档与版本记录。
- `release/`: sanitized, verified distribution archives, SHA-256 checksums and release metadata. 脱敏交付包、校验和与发布说明。
- `dev/` remains local and is excluded from this repository. 本地开发环境、用户完整输入、安装路径和原始验证记录不上传。

## Release 3.0.2

Planning verifier routes and actual judge evidence; integrated task understanding and initial todos; execution insights and incremental plans; current-session acceptance and structured delivery conclusions; project gaps and suite feedback.

新增规划验证路由和实际裁判证据，装配认识与初始待办，执行理解及计划增量，当前会话验收和结构化交付结论，以及项目缺项与套件运行反馈。

[Release notes / 发布说明](release/orchestrator-suite-3.0.2.release-notes.md) · [Distribution archive / 交付包](release/orchestrator-suite-3.0.2.tar.gz) · [SHA-256](release/orchestrator-suite-3.0.2.tar.gz.sha256)

## Development and validation / 开发与验证

From `main/`, install source dependencies with `npm install`, then run `npm run verify`. Release archives already include self-contained dependencies. 实际开发环境保存在本地 dev；公开源码在 main。

58 regression tests passed. Fixtures and disk installation do not establish live DSH activation or a passing independent evaluation. Check the actual host version after loading. 58 项回归通过；测试夹具和磁盘安装不等于真实宿主已应用或裁判验收通过。

See [privacy boundaries](main/PRIVACY.md), [deployment](main/DEPLOYMENT.md), and [component license sections](main/LICENSE). Vendored dependencies retain their own licenses.
