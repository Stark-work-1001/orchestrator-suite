# Orchestrator Suite 3.0.2

[简体中文](README.md) · [Changelog](CHANGELOG.md) · [Release notes](docs/RELEASE-NOTES-3.0.2.md)

A DeepSeek Harness (DSH) suite providing an orchestration board, task progress status and the **Dispatch Orchestration** preset. It shows where agent understanding, execution or verification needs attention without prescribing a project’s technical implementation.

Each step requires real inspection, assessment or an invocation attempt and visible understanding. Execution choices remain advisory. Unassessed work, explicit no-change decisions, actual changes and failed verification remain distinguishable.

## What is new

- Reuses mounted `dsh-llm-verifier` public tools. Task route controls and returned judge models, scores and evaluations appear in the board without modifying the verifier.
- Integrated task understanding and concrete plans seed initial todos and appear in system sections and progress. An unsplit plan becomes one pending item; an empty list needs an explicit reason.
- Execution insights update todos and plans through `dispatch_refine`, with actual evidence and history. Read-only `dispatch_checkpoint` revisits planning inputs without calling judges.
- Final verification remains with the existing verifier. A dedicated conclusion records completed work, implemented behavior, overall effect and limitations. Separate feedback covers project gaps, problems and suite behavior.

## Three phases

| Phase | Evidence |
| --- | --- |
| Planning | Original input, triage, registered tools/verification/team/identity layers, actual evaluation, integrated understanding and plan |
| Execution reaction | User supplements and deeper execution insights, incremental todo changes or explicit no-change decisions, ongoing evidence |
| Delivery verification | 3-1 Requirement/result trace; 3-2 actual verifier acceptance and conclusion; 3-3 project gaps and suite feedback |

Use `dispatch_plan` to understand input; `dispatch_review` with two real candidates for proposal comparison, three or more for proposal selection, or real steps and one-based checkpoints for tracking. The legacy strategy/direct-execution baseline comparison is explicitly limited.

After reading the actual result, `dispatch_commit` submits `reviewUnderstanding`, `taskUnderstanding`, `conclusion` and `plannedTodos` (`text`, `reason`). An empty list requires `noTodoReason`. `dispatch_adjust` assesses follow-ups; `dispatch_todo` maintains work; `dispatch_refine` records execution insight and incremental updates. No change needs an explicit decision and explanation.

`dispatch_delivery` traces requirements and actually invokes `verifier_current_session`. After reading the current attempt, `dispatch_conclude` submits `completed`, `implemented`, `overallEffect` and `limitations`. Record `missingItems`, `problems`, `suiteStatus` and `suggestions` separately. `dispatch_export` returns full prompts and histories locally.

The original prompt remains unchanged. Supplements are preserved and assessed without restarting initial planning. System sections are model context; the model must also communicate the conclusion to the user. They are not fabricated chat messages.

## Integration boundaries

Judge models remain managed through DSH LLM Verifier settings. Suite controls only select this task’s next public planning tool and repeat count; saving does not call a judge. No verifier source, settings or lifecycle changes. Private acceptance thresholds are never inferred.

Missing evidence, unavailable tools, failures, cancellation and stale results are reported honestly. Identical delivery revisions reuse finished/failed attempts; new requirements, plans, todos or delivery evidence invalidate acceptance. Explicit `dispatch_accept` can retry. Scores, complete process assessment, idle and accepted delivery are different facts.

## Development and distribution

The surrounding workspace uses local `dev/`, sanitized GitHub source `main/` and sanitized artifacts `release/`. This repository contains the `main/` content, not local development transcripts or installed configuration.

Requires Node.js ≥22.19 and DSH `>=0.2.1-0 <0.3`. Install source dependencies with `npm install`, then run:

```sh
npm run verify
node scripts/pack.mjs
```

Release archives include built assets and self-contained dependencies. No toolchain is borrowed from other plugins. Profile checks require deployment-provided environment variables and report skipped checks honestly.

In-place upgrades back up owned files, preserve local configuration and verify external hashes. Other plugins, status bars, presets and profiles remain untouched. Disk installation does not prove live activation; see [deployment](DEPLOYMENT.md).

Task records survive turns in process memory, not restarts. Export before restarting. Full prompt exports remain local; publish a separate sanitized report. Automated checks cover types, build, dependencies, regression, composition and privacy; extraction verifies file hashes and rescans content. Test judges are fixtures, not live DSH or paid evaluation evidence.

See [privacy](PRIVACY.md), [version history](CHANGELOG.md) and [license sections](LICENSE). Vendored dependencies retain their own licenses.
