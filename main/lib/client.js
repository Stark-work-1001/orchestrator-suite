window.__ModuleLoader__.load({id:"orchestrator-suite",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react5 = __toESM(require("react"), 1);

// src/shared.ts
var VERSION = "3.0.3";
var STAGES = ["input", "triage", "compare", "verify", "assemble", "supplement", "todo", "execute", "trace", "accept", "construction"];
var PHASES = ["planning", "reaction", "delivery"];
var PHASE_STAGES = { planning: ["input", "triage", "compare", "verify", "assemble"], reaction: ["supplement", "todo", "execute"], delivery: ["trace", "accept", "construction"] };
function phaseOf(stage) {
  return PHASES.find((phase) => PHASE_STAGES[phase].includes(stage));
}
function assessmentChecklist(task) {
  const reported = (stage) => !!task.reports?.some((r) => r.stage === stage && r.summary.trim());
  const attempted = (attempt) => !!attempt && !["running", "stale", "paused"].includes(attempt.outcome);
  const understoodAttempt = (attempt) => !!attempt?.id && !!task.reports?.some((r) => r.stage === attempt.stage && r.attemptId === attempt.id && r.summary.trim());
  return [
    { stage: "input", assessed: reported("input"), nextTool: "dispatch_report(input) / dispatch_plan(inputUnderstanding)" },
    { stage: "triage", assessed: !!task.triage?.trim() && reported("triage"), nextTool: "dispatch_plan" },
    { stage: "compare", assessed: !!task.discoveryAttempted && !!task.comparison?.trim() && reported("compare"), nextTool: "relic_prepare + dispatch_review(comparison)" },
    { stage: "verify", assessed: attempted(task.planningAttempt) && understoodAttempt(task.planningAttempt), nextTool: "dispatch_review + dispatch_commit(reviewUnderstanding)" },
    { stage: "assemble", assessed: !!task.conclusion?.trim() && !!task.planVersions?.length && reported("assemble"), nextTool: "dispatch_commit" },
    { stage: "supplement", assessed: task.supplements?.length ? !task.supplements.some((r) => r.status === "pending" || !r.understanding?.trim()) : reported("supplement"), nextTool: "dispatch_adjust / dispatch_report(supplement: no follow-ups)" },
    { stage: "todo", assessed: !!task.todoAssessments?.some((a) => a.requirementIds.includes("initial")) && (task.supplements ?? []).every((r) => task.todoAssessments?.some((a) => a.requirementIds.includes(r.id))), nextTool: "dispatch_todo / dispatch_todo_assess / dispatch_adjust" },
    { stage: "execute", assessed: reported("execute"), nextTool: "dispatch_report(execute) / dispatch_delivery(summary)" },
    { stage: "trace", assessed: !!task.delivery && task.delivery.revision === task.revision && reported("trace"), nextTool: "dispatch_delivery" },
    { stage: "accept", assessed: attempted(task.acceptanceAttempt) && task.acceptanceAttempt?.revision === task.revision && understoodAttempt(task.acceptanceAttempt) && (!task.delivery || task.deliveryConclusion?.attemptId === task.acceptanceAttempt?.id && task.deliveryConclusion?.revision === task.revision), nextTool: "dispatch_delivery + dispatch_conclude" },
    { stage: "construction", assessed: !!task.delivery?.constructionRequests.trim() && reported("construction"), nextTool: "dispatch_delivery(constructionRequests)" }
  ];
}
function deliveryBundle(task) {
  const assessments = assessmentChecklist(task);
  return {
    version: VERSION,
    taskId: task.taskId,
    originalUserPrompt: task.prompt,
    processUserPrompts: task.supplements ?? [],
    triage: task.triage,
    layerComparison: task.comparison,
    thirdPartyPlanningReview: task.review,
    planVersions: task.planVersions ?? [],
    todos: task.todos ?? [],
    todoChanges: task.todoChanges ?? [],
    understanding: task.reports ?? [],
    identityReports: task.identities ?? [],
    delivery: task.delivery,
    thirdPartyAcceptance: task.acceptance || null,
    progress: task.progress,
    assessments,
    workflowComplete: assessments.every((a) => a.assessed),
    todoAssessments: task.todoAssessments ?? [],
    judgeAttempts: task.judgeAttempts ?? [],
    verifierSettings: task.verifierSettings,
    taskUnderstanding: task.taskUnderstanding,
    executionInsights: task.executionInsights ?? [],
    deliveryConclusion: task.deliveryConclusion,
    gaps: [
      ...assessments.filter((a) => !a.assessed).map((a) => `Assessment missing: ${a.stage}`),
      ...(task.supplements ?? []).filter((r) => r.status === "pending").map((r) => `Unassessed requirement: ${r.id}`),
      ...(task.todos ?? []).filter((t) => !["done", "cancelled"].includes(t.status)).map((t) => `Open todo: ${t.id}`),
      ...(task.todos ?? []).filter((t) => t.status === "done" && !t.evidence).map((t) => `Completion evidence missing: ${t.id}`),
      ...!task.delivery || task.delivery.revision !== task.revision ? ["Delivery trace missing or stale"] : [],
      ...!task.acceptance ? [task.acceptanceAttempt ? `Independent acceptance attempted: ${task.acceptanceAttempt.outcome}` : "Independent acceptance not attempted"] : []
    ]
  };
}
var ROUTE = "/api/orchestrator-suite/board";
var PROGRESS_ROUTE = "/api/orchestrator-suite/progress";
var VERIFIER_ROUTE = "/api/orchestrator-suite/verifier-route";

// locale/zh.json
var zh_default = {
  scope: "\u67E5\u770B\u8303\u56F4",
  hostScope: "\u5BBF\u4E3B\u5168\u5C40\uFF08\u4E0D\u542B\u4F1A\u8BDD\u4E13\u5C5E\u8D44\u4EA7\uFF09",
  entry: "\u7F16\u6392\u770B\u677F",
  title: "\u4EFB\u52A1\u7F16\u6392\u5DE5\u4F5C\u53F0",
  readOnly: "\u8D44\u4EA7\u53EA\u8BFB \xB7 \u672C\u4EFB\u52A1\u8DEF\u7531\u53EF\u9009",
  refresh: "\u5237\u65B0\u6E05\u5355",
  close: "\u5173\u95ED\u770B\u677F",
  layers: "\u6CE8\u518C\u80FD\u529B\u4E0E\u53EF\u9009\u8D44\u6599",
  workspace: "\u5F53\u524D\u5BBF\u4E3B / \u8D44\u4EA7\u4E0E\u4EFB\u52A1",
  seam: "\u72EC\u7ACB\u5957\u4EF6 \xB7 \u516C\u5171\u63A5\u53E3",
  overview: "\u603B\u89C8",
  tools: "\u5DE5\u5177\u5C42",
  memory: "\u8BB0\u5FC6\u8D44\u6599",
  identity: "\u8EAB\u4EFD\u5C42",
  organization: "\u56E2\u961F\u534F\u4F5C\u5C42",
  dispatch: "\u8C03\u5EA6\u7F16\u6392\u6A21\u5F0F",
  "overview.description": "\u7406\u89E3\u5982\u4F55\u4F7F\u7528\u667A\u80FD\u4F53\u5F00\u5C55\u9879\u76EE\uFF1A\u89C4\u5212 \u2192 \u6267\u884C\u53CD\u5E94 \u2192 \u9A8C\u6536\u4EA4\u4ED8\u3002\u5404\u73AF\u8282\u6709\u5E8F\u67E5\u770B\uFF0C\u6267\u884C\u65B9\u5F0F\u7531\u7406\u89E3\u4E0E\u8BC1\u636E\u5F15\u5BFC\u3002",
  "tools.description": "\u901A\u8FC7 DSH \u516C\u5171\u6CE8\u518C\u8868\u63A2\u67E5\uFF0C\u63D2\u4EF6\u4E0E\u5957\u4EF6\u540C\u7EA7\u3002\u5185\u90E8\u6280\u80FD\u3001MCP\u3001VENV \u6309\u6765\u6E90\u8BC1\u636E\u5D4C\u5957\uFF1B\u672A\u786E\u8BA4\u5F52\u5C5E\u7684\u8D44\u4EA7\u5355\u5217\u3002\u6253\u5F00\u770B\u677F\u65F6\u6BCF 10 \u79D2\u66F4\u65B0\u3002",
  "memory.description": "\u6309\u9700\u53C2\u8003\u7684\u8BB0\u5FC6\u7CFB\u7EDF\u4E0E\u6587\u4EF6\uFF0C\u4E0D\u7EB3\u5165\u56DB\u5C42\u67B6\u6784\u9A8C\u8BC1\u3002\u6B63\u6587\u8BFB\u53D6\u4ECD\u901A\u8FC7\u516C\u5F00\u5DE5\u5177\u4E0E\u660E\u786E\u914D\u7F6E\u8303\u56F4\u3002",
  "identity.description": "\u8BA9\u4EFB\u52A1\u4E2D\u7684\u8EAB\u4EFD\u4E0E\u804C\u8D23\u53EF\u89C1\u3002\u89D2\u8272\u7531\u6267\u884C\u6A21\u578B\u5224\u65AD\uFF0C\u4E0D\u4F1A\u8986\u76D6\u5BBF\u4E3B\u5DF2\u6709\u89D2\u8272\u8BBE\u7F6E\u3002",
  "organization.description": "\u6839\u636E\u4EFB\u52A1\u89C4\u6A21\u9009\u62E9\u534F\u4F5C\u65B9\u5F0F\uFF0C\u4EE5\u6E05\u6670\u4EFB\u52A1\u4E66\u548C\u5B9E\u9645\u8BC1\u636E\u5B8C\u6210\u5206\u5DE5\u3001\u5BA1\u67E5\u4E0E\u9A8C\u6536\u3002",
  "dispatch.description": "\u6309\u89C4\u5212\u3001\u6267\u884C\u53CD\u5E94\u3001\u9A8C\u6536\u4EA4\u4ED8\u6709\u5E8F\u67E5\u770B\u5E76\u62A5\u544A\u7406\u89E3\uFF0C\u6267\u884C\u65B9\u6848\u53EF\u8C03\u6574\u3002\u65E0\u53D8\u66F4\u4E5F\u8981\u8BC4\u4F30\u539F\u56E0\uFF0C\u4EA4\u4ED8\u9A8C\u6536\u5B9E\u9645\u5C1D\u8BD5\u3002",
  "tools.metric": "\u8D44\u4EA7\u6761\u76EE\uFF08\u542B\u5D4C\u5957\uFF09",
  "memory.metric": "\u8BB0\u5FC6\u7CFB\u7EDF\u4E0E\u6587\u4EF6",
  "identity.metric": "\u8EAB\u4EFD\u63D2\u4EF6\u4E0E\u516C\u5F00\u5DE5\u5177",
  "organization.metric": "\u534F\u4F5C\u76F8\u5173\u5DE5\u5177",
  relicTitle: "\u7ED9\u6A21\u578B\u53C2\u8003\uFF0C\u4FDD\u7559\u5224\u65AD",
  relicBody: "\u5F15\u5BFC\u6267\u884C\u65B9\u6848\uFF0C\u4E0D\u8DF3\u8FC7\u6D41\u7A0B\u67E5\u770B\uFF1B\u8BFB\u53D6\u56DB\u5C42\u6CE8\u518C\u80FD\u529B\u5E76\u63D0\u4EA4\u7406\u89E3\uFF0C\u5931\u8D25\u3001\u65E0\u53D8\u5316\u548C\u672A\u8BC4\u4F30\u5206\u522B\u5C55\u793A\u3002",
  discovery: "\u53D1\u73B0\u6E05\u5355",
  reading: "\u8BFB\u53D6\u76F8\u5173\u5185\u5BB9",
  selection: "\u5224\u65AD\u5E76\u91C7\u7EB3",
  dispatchTitle: "\u6709\u5E8F\u67E5\u770B\u4E0E\u7406\u89E3\uFF0C\u7075\u6D3B\u5F00\u5C55\u4EFB\u52A1",
  dispatchBody: "\u67E5\u770B\u8F93\u5165\u3001\u5206\u8BCA\u548C\u56DB\u5C42\u80FD\u529B\uFF0C\u5C1D\u8BD5\u7B2C\u4E09\u65B9\u89C4\u5212\u9A8C\u8BC1\u540E\u7EFC\u5408\u88C5\u914D\uFF1B\u6BCF\u6B21\u8865\u5145\u90FD\u8BC4\u4F30\uFF0C\u4EA4\u4ED8\u9A8C\u6536\u5FC5\u987B\u5C1D\u8BD5\u3002",
  viewPipeline: "\u67E5\u770B\u6267\u884C\u6D41\u7A0B",
  boundaries: "\u6E05\u6670\u7684\u804C\u8D23\u4E0E\u8303\u56F4",
  boundaryBody: "\u672C\u5957\u4EF6\u4F7F\u7528\u5BBF\u4E3B\u516C\u5171\u6CE8\u518C\u8868\uFF0C\u53EA\u8BFB\u53D1\u73B0\u8D44\u4EA7\u3002\u5DF2\u6709\u8C03\u5EA6\u6A21\u5F0F\u3001\u8BA2\u9605\u63D2\u4EF6\u3001\u9A8C\u8BC1\u5668\u914D\u7F6E\u548C\u5176\u4ED6\u63D2\u4EF6\u4FDD\u6301\u72EC\u7ACB\uFF1B\u65B0\u589E\u6A21\u5F0F\u9700\u8981\u5728\u65B0\u4F1A\u8BDD\u4E2D\u4E3B\u52A8\u9009\u62E9\u3002",
  skills: "\u6280\u80FD",
  plugins: "\u63D2\u4EF6 / \u5957\u4EF6",
  mcp: "MCP",
  search: "\u641C\u7D22\u540D\u79F0\u6216\u7B80\u4ECB\u2026",
  empty: "\u6B64\u8303\u56F4\u6CA1\u6709\u53D1\u73B0\u6761\u76EE\uFF0C\u6216\u6CA1\u6709\u5339\u914D\u7684\u641C\u7D22\u7ED3\u679C\u3002",
  noDescription: "\u6682\u65E0\u7B80\u4ECB",
  catalogHint: "\u53D1\u73B0\u6E05\u5355 \u2260 \u5DF2\u8BFB\u6B63\u6587\uFF1B\u6CE8\u518C\u53EF\u7528 \u2260 \u5DF2\u5B8C\u6210\u8C03\u7528\u9A8C\u8BC1",
  fetchFailed: "\u65E0\u6CD5\u8BFB\u53D6\u5BBF\u4E3B\u6E05\u5355\uFF0C\u8BF7\u5237\u65B0\u91CD\u8BD5\u3002",
  retry: "\u91CD\u8BD5",
  loading: "\u6B63\u5728\u8BFB\u53D6\u5BBF\u4E3B\u6CE8\u518C\u8868\u2026",
  memoryRoots: "\u53EA\u8BFB\u8BB0\u5FC6\u76EE\u5F55",
  warnings: "\u53D1\u73B0\u8FC7\u7A0B\u63D0\u793A",
  "status.available": "\u5DF2\u6CE8\u518C",
  "status.enabled": "\u5DF2\u542F\u7528",
  "status.disabled": "\u5DF2\u505C\u7528",
  "status.failed": "\u5931\u8D25",
  "status.discovered": "\u672A\u8BFB\u6B63\u6587",
  "status.unknown": "\u672A\u77E5",
  "status.pending": "\u7B49\u5F85",
  "status.loading": "\u52A0\u8F7D\u4E2D",
  "status.unloading": "\u5378\u8F7D\u4E2D",
  identityTitle: "\u5F53\u524D\u8EAB\u4EFD\u9700\u8981\u660E\u786E\u62A5\u544A",
  identityBody: "\u5404\u9636\u6BB5\u6839\u636E\u4EFB\u52A1\u4F53\u91CF\u4E0E\u8BC1\u636E\u8BC4\u4F30\u8EAB\u4EFD\uFF0C\u62A5\u544A\u9759\u6001/\u52A8\u6001\u3001\u4FDD\u6301\u6216\u53D8\u5316\u7406\u7531\u4E0E\u6765\u6E90\u3002\u804C\u8D23\u53D8\u5316\u4E0D\u81EA\u52A8\u5207\u6362\u5BBF\u4E3B\u89D2\u8272\u8BBE\u7F6E\u3002",
  lead: "\u4E3B\u7F16\u6392\u6A21\u578B",
  "lead.description": "\u7406\u89E3\u7528\u6237\u8BF7\u6C42\uFF0C\u505A\u5206\u8BCA\u4E0E\u5BF9\u7167\uFF0C\u7EC4\u7EC7\u4EFB\u52A1\uFF0C\u6C47\u603B\u9A8C\u8BC1\u5EFA\u8BAE\u5E76\u8D1F\u8D23\u6700\u7EC8\u4EA4\u4ED8\u3002",
  worker: "\u901A\u7528\u6267\u884C\u6210\u5458",
  "worker.description": "\u5728\u660E\u786E\u7684\u4EFB\u52A1\u8303\u56F4\u5185\u81EA\u4E3B\u89C4\u5212\u3001\u5B9E\u73B0\u3001\u81EA\u68C0\u4E0E\u63D0\u51FA\u6539\u8FDB\uFF0C\u4E0D\u627F\u62C5\u4E3B\u6A21\u578B\u7684\u6700\u7EC8\u6574\u5408\u804C\u8D23\u3002",
  reviewer: "\u72EC\u7ACB\u9A8C\u8BC1\u8005",
  "reviewer.description": "\u4F7F\u7528\u73B0\u6709\u9A8C\u8BC1\u5668\u914D\u7F6E\uFF0C\u5BF9\u65B9\u6848\u7ED9\u51FA\u7B2C\u4E09\u65B9\u8BC1\u636E\u4E0E\u5EFA\u8BAE\uFF1B\u4E3B\u6A21\u578B\u8BF4\u660E\u91C7\u7EB3\u7406\u7531\u3002",
  identityHint: "\u5F53\u524D\u4EFB\u52A1\u7684\u9636\u6BB5\u8EAB\u4EFD\u4E0E\u804C\u8D23\u62A5\u544A\u8BF7\u5728\u8C03\u5EA6\u7F16\u6392\u6A21\u5F0F\u6216\u4EFB\u52A1\u8FDB\u5EA6\u4E2D\u67E5\u770B\uFF1B\u7F3A\u5C11\u62A5\u544A\u65F6\u660E\u786E\u5F85\u786E\u8BA4\u3002",
  "L0.title": "\u5355\u70B9\u76F4\u63A5\u5B8C\u6210",
  "L0.description": "\u9700\u6C42\u660E\u786E\u3001\u6539\u52A8\u53EF\u9006\uFF0C\u6CA1\u6709\u72EC\u7ACB\u5E76\u884C\u6536\u76CA\u3002\u4E3B\u6A21\u578B\u76F4\u63A5\u5B8C\u6210\u5E76\u63D0\u4F9B\u8BC1\u636E\u3002",
  "L1.title": "\u5C0F\u89C4\u6A21\u660E\u786E\u5206\u5DE5",
  "L1.description": "\u591A\u6587\u4EF6\u6216\u5C11\u91CF\u6B65\u9AA4\uFF0C\u5173\u952E\u7EA6\u675F\u660E\u786E\u3002\u6839\u636E\u6536\u76CA\u76F4\u63A5\u6267\u884C\u6216\u59D4\u6D3E\u4E00\u4E2A\u72EC\u7ACB\u4EFB\u52A1\u3002",
  "L2.title": "\u8DE8\u6A21\u5757\u7EC4\u7EC7\u56E2\u961F",
  "L2.description": "\u5148\u6D88\u9664\u5173\u952E\u672A\u77E5\uFF0C\u518D\u6309\u4F9D\u8D56\u62C6\u89E3\u3002\u72EC\u7ACB\u90E8\u5206\u53EF\u5E76\u884C\uFF0C\u4E3B\u6A21\u578B\u6574\u5408\u548C\u5206\u5C42\u9A8C\u6536\u3002",
  assignment: "\u6BCF\u4EFD\u4EFB\u52A1\u4E66\u5E94\u5305\u542B",
  assignmentBody: "\u76EE\u6807 \xB7 \u53EF\u6539\u8303\u56F4 \xB7 \u7EA6\u675F \xB7 \u9A8C\u6536\u6807\u51C6 \xB7 \u56DE\u62A5\u8BC1\u636E\u3002\u8BA9\u6210\u5458\u5145\u5206\u53D1\u6325\u901A\u7528\u80FD\u529B\uFF0C\u4E3B\u6A21\u578B\u660E\u786E\u4F9D\u8D56\u3001\u8D23\u4EFB\u4E0E\u590D\u5BA1\u5B89\u6392\u3002",
  teamTools: "\u5F53\u524D\u5DF2\u6CE8\u518C\u7684\u534F\u4F5C\u5DE5\u5177",
  triage: "\u4EFB\u52A1\u5206\u8BCA",
  compare: "\u591A\u5C42\u5BF9\u7167",
  verify: "\u7B2C\u4E09\u65B9\u9A8C\u8BC1",
  assemble: "\u7EFC\u5408\u88C5\u914D\u89C4\u5212",
  execute: "\u5F00\u59CB\u6267\u884C",
  "triage.description": "\u4E3B\u6A21\u578B\u5224\u65AD\u590D\u6742\u5EA6",
  "compare.description": "\u8BFB\u53D6\u5E76\u5224\u65AD\u76F8\u5173\u8D44\u6E90",
  "verify.description": "\u6CBF\u7528\u5DF2\u6709\u88C1\u5224\u914D\u7F6E",
  "assemble.description": "\u6C47\u603B\u8BF7\u6C42\u3001\u5206\u8BCA\u3001\u56DB\u5C42\u8BC1\u636E\u548C\u771F\u5B9E\u9A8C\u8BC1\u7ED3\u679C",
  "execute.description": "\u7ED3\u5408\u5F53\u524D\u8BA1\u5212\u4E0E\u5F85\u529E\u6301\u7EED\u6267\u884C",
  judgeTitle: "\u88C1\u5224\u6A21\u578B\u901A\u8FC7\u9A8C\u8BC1\u5668\u5185\u90E8\u8C03\u7528",
  judgeBody: "\u88C1\u5224\u901A\u8FC7\u9A8C\u8BC1\u5668\u5185\u90E8 LLM \u63A5\u53E3\u8C03\u7528\uFF0C\u4E0D\u521B\u5EFA\u53EF\u89C1\u5B50\u667A\u80FD\u4F53\u5BF9\u8BDD\u3002\u4E3B\u5BF9\u8BDD\u5DE5\u5177\u7ED3\u679C\u548C\u4EFB\u52A1\u8BE6\u60C5\u5C55\u793A\u771F\u5B9E\u8BC4\u5206\u4E0E\u8BCA\u65AD\uFF1B\u65B9\u6848\u8BC4\u4EF7\u4E0E\u4EA4\u4ED8\u9A8C\u6536\u5206\u522B\u8BB0\u5F55\uFF0C\u964D\u7EA7\u4E0D\u7B49\u4E8E\u901A\u8FC7\u3002",
  taskRecords: "\u672C\u6B21\u8FD0\u884C\u7684\u4EFB\u52A1\u8BB0\u5F55",
  selectSession: "\u9009\u62E9\u4E00\u4E2A\u4E3B\u5BF9\u8BDD\u2026",
  noTask: "\u53D1\u9001\u4EFB\u52A1\u540E\u9009\u62E9\u4E3B\u4F1A\u8BDD\uFF0C\u67E5\u770B\u89C4\u5212\u3001\u8865\u5145\u9700\u6C42\u3001\u5F85\u529E\u4E0E\u5168\u94FE\u8DEF\u9A8C\u6536\u3002",
  pending: "\u5C1A\u672A\u63D0\u4EA4",
  turn: "\u8F6E\u6B21",
  "phase.discovered": "\u89C4\u5212\u7406\u89E3\u5F85\u5B8C\u5584",
  "phase.reviewed": "\u89C4\u5212\u8BC4\u4EF7\u5DF2\u8FD4\u56DE",
  "phase.ready": "\u7EFC\u5408\u88C5\u914D\u89C4\u5212\u5DF2\u8BB0\u5F55",
  "task.prompt": "\u7528\u6237\u539F\u59CB\u8F93\u5165",
  "task.triage": "\u4EFB\u52A1\u5206\u8BCA",
  "task.comparison": "\u591A\u5C42\u5BF9\u7167\u5224\u65AD",
  "task.review": "\u7B2C\u4E09\u65B9\u9A8C\u8BC1\u7ED3\u679C",
  "task.conclusion": "\u7EFC\u5408\u88C5\u914D\u89C4\u5212",
  "progress.stages": "\u4E09\u9636\u6BB5\u4EFB\u52A1\u8FDB\u5EA6",
  "progress.title": "\u4EFB\u52A1\u8FDB\u5EA6",
  "progress.guide": "\u6807\u9898\u680F\u5C55\u793A\u5F53\u524D\u9636\u6BB5\uFF0C\u5C55\u5F00\u67E5\u770B\u6B65\u9AA4\u7406\u89E3\u4E0E\u8BC1\u636E",
  "progress.refresh": "\u5237\u65B0\u4EFB\u52A1\u8FDB\u5EA6",
  "progress.loading": "\u6B63\u5728\u8FDE\u63A5\u5F53\u524D\u4F1A\u8BDD\u2026",
  "progress.fetchFailed": "\u65E0\u6CD5\u8BFB\u53D6\u4EFB\u52A1\u8FDB\u5EA6\uFF0C\u8BF7\u5237\u65B0\u91CD\u8BD5\u3002",
  "progress.stale": "\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u4EE5\u4E0B\u4E3A\u4E0A\u6B21\u5FEB\u7167\uFF0C\u5F53\u524D\u9636\u6BB5\u5C1A\u672A\u786E\u8BA4\u3002",
  "progress.staleShort": "\u5FEB\u7167\u5DF2\u8FC7\u671F",
  "progress.current": "\u5F53\u524D\u9636\u6BB5",
  "progress.fullPrompt": "\u5C55\u5F00\u5B8C\u6574\u539F\u59CB\u8F93\u5165",
  "progress.noTask": "\u672C\u6B21\u5957\u4EF6\u8FD0\u884C\u5C1A\u672A\u6355\u83B7\u6B64\u4F1A\u8BDD\u7684\u7528\u6237\u4EFB\u52A1\u3002\u53D1\u9001\u65B0\u4EFB\u52A1\u540E\u81EA\u52A8\u663E\u793A\uFF1B\u4E0D\u56DE\u586B\u65E7\u8BB0\u5F55\u3002",
  "progress.ordinary": "\u666E\u901A\u6A21\u5F0F\u4E5F\u53EF\u63D0\u4EA4\u5206\u8BCA\u4E0E\u5BF9\u7167\u5E76\u4F7F\u7528\u9A8C\u8BC1\uFF1B\u53C2\u8003\u7F3A\u53E3\u4E0D\u4F1A\u963B\u585E\u4EFB\u52A1\u3002",
  "progress.read": "\u5957\u4EF6\u5B9E\u8BFB",
  "progress.evidenceHint": "\u67E5\u770B\u73AF\u8282\u53CA\u63D0\u4EA4\u7406\u89E3\u662F\u5FC5\u7ECF\u68C0\u67E5\uFF0C\u6267\u884C\u65B9\u6848\u4ECD\u53EF\u8C03\u6574\u3002\u65E0\u53D8\u66F4\u4E0D\u7B49\u4E8E\u5DF2\u8BC4\u4F30\uFF1B\u9A8C\u6536\u5B9E\u9645\u5C1D\u8BD5\uFF0C\u5931\u8D25\u4E0E\u672A\u8C03\u7528\u5206\u522B\u8BB0\u5F55\u3002",
  "progress.autoRefresh": "\u968F\u4F1A\u8BDD\u81EA\u52A8\u5237\u65B0",
  "progress.status.pending": "\u5F85\u5F00\u59CB",
  "progress.status.active": "\u8FDB\u884C\u4E2D",
  "progress.status.done": "\u5DF2\u6709\u8BC1\u636E",
  "progress.status.failed": "\u5931\u8D25",
  "progress.status.paused": "\u6682\u505C / \u5F85\u7EE7\u7EED",
  "progress.status.ended": "\u672C\u8F6E\u5DF2\u7ED3\u675F",
  "stage.input": "\u7528\u6237\u63D0\u793A\u8BCD",
  "stage.input.description": "\u4FDD\u7559\u6700\u521D\u63D0\u793A\u8BCD\u539F\u6587\uFF1B\u540E\u7EED\u8F93\u5165\u72EC\u7ACB\u8BB0\u5F55",
  "stage.triage": "\u4EFB\u52A1\u5206\u8BCA",
  "stage.triage.description": "\u4E3B\u6A21\u578B\u63D0\u4EA4\u590D\u6742\u5EA6\u3001\u8303\u56F4\u4E0E\u7406\u7531",
  "stage.compare": "\u591A\u5C42\u5BF9\u7167",
  "stage.compare.description": "\u5F53\u524D DSH \u6CE8\u518C\u7684\u5DE5\u5177\u3001\u9A8C\u8BC1\u3001\u56E2\u961F\u534F\u4F5C\u3001\u8EAB\u4EFD\u56DB\u5C42",
  "stage.verify": "\u7B2C\u4E09\u65B9\u9A8C\u8BC1",
  "stage.verify.description": "\u73B0\u6709\u9A8C\u8BC1\u5668\u8C03\u7528\u5DF2\u914D\u7F6E\u88C1\u5224\u6A21\u578B",
  "stage.assemble": "\u7EFC\u5408\u88C5\u914D\u89C4\u5212",
  "stage.assemble.description": "\u4E3B\u6A21\u578B\u6C47\u603B\u7406\u89E3\u4E0E\u8BC1\u636E\uFF0C\u8BB0\u5F55\u8BA1\u5212\u7248\u672C",
  "stage.execute": "\u6267\u884C\u4EFB\u52A1",
  "stage.execute.description": "\u7EFC\u5408\u7ED3\u8BBA\u6CE8\u5165\u540E\u7EED\u7CFB\u7EDF\u4E0A\u4E0B\u6587\uFF0C\u4E3B\u6A21\u578B\u7EE7\u7EED\u6267\u884C",
  environments: "VENV / \u73AF\u5883",
  accept: "\u4EA4\u4ED8\u9A8C\u6536",
  "accept.description": "\u8BC4\u4EF7\u5B9E\u9645\u4EA4\u4ED8\u8BC1\u636E",
  "stage.accept": "3-2 \u9A8C\u8BC1\u5668\u9A8C\u6536\u4E0E\u4EA4\u4ED8\u7ED3\u8BBA",
  "stage.accept.description": "\u901A\u8FC7\u73B0\u6709\u9A8C\u8BC1\u5668\u8BC4\u4EF7\u672C\u8F6E\u4EA4\u4ED8\u8BC1\u636E",
  "task.acceptance": "\u4EA4\u4ED8\u9A8C\u6536\u7ED3\u679C",
  "progress.status.degraded": "\u964D\u7EA7 / \u53EF\u7EE7\u7EED",
  "progress.status.skipped": "\u65E7\u8BB0\u5F55\u672A\u8C03\u7528 \xB7 \u9700\u8865\u8BC4\u4F30",
  verification: "\u9A8C\u8BC1\u5C42",
  "verification.description": "\u67E5\u770B\u5F53\u524D\u5F15\u5BFC\u4F7F\u7528\u7684\u7B2C\u4E09\u65B9\u9A8C\u8BC1\u5DE5\u5177\u3001\u516C\u5F00\u53EF\u89C1\u6027\u4E0E\u5B9E\u9645\u63D0\u4EA4\u7ED3\u679C\u3002\u53EA\u8BFB\u53D1\u73B0\u4E0D\u81EA\u52A8\u8C03\u7528\u88C1\u5224\u3002",
  "verification.metric": "\u65B9\u6848 / \u4EA4\u4ED8\u9A8C\u8BC1\u63A5\u53E3",
  "kind.memory-system": "\u8BB0\u5FC6\u7CFB\u7EDF",
  "kind.memory-database": "\u8BB0\u5FC6\u6570\u636E\u5E93",
  "kind.memory-file": "\u8BB0\u5FC6\u6587\u4EF6",
  "kind.memory-tool": "\u516C\u5F00\u67E5\u8BE2\u5DE5\u5177",
  "kind.observation": "\u6A21\u578B\u67E5\u8BE2\u8BB0\u5F55",
  "status.unavailable": "\u5F53\u524D\u4E0D\u53EF\u89C1",
  "status.reported": "\u6A21\u578B\u62A5\u544A",
  protocol: "\u534F\u8BAE",
  port: "\u7AEF\u53E3",
  endpoint: "\u7AEF\u70B9",
  unknown: "\u672A\u77E5 / \u5F85\u786E\u8BA4",
  noTcpPort: "\u65E0 TCP \u7AEF\u53E3",
  memoryProtocolTitle: "\u5148\u786E\u8BA4\u8FD0\u884C\u63A5\u53E3\uFF0C\u518D\u8BFB\u53D6\u4EFB\u52A1\u76F8\u5173\u8BB0\u5FC6",
  memoryProtocolBody: "\u6A21\u578B\u901A\u8FC7\u53EF\u7528\u7684 MCP / \u516C\u5F00 status \u5DE5\u5177\u8BC6\u522B\u5F53\u524D\u8BB0\u5FC6\u7CFB\u7EDF\u534F\u8BAE\u4E0E\u7AEF\u53E3\uFF0C\u518D\u53EC\u56DE\u5BF9\u8BDD\u8BB0\u5FC6\u3002stdio \u65E0 TCP \u7AEF\u53E3\uFF0C\u672A\u77E5\u4E0D\u731C\u6D4B\u3002\u6570\u636E\u5E93\u901A\u8FC7\u516C\u5F00\u63A5\u53E3\u67E5\u8BE2\uFF0C\u6587\u4EF6\u72EC\u7ACB\u5206\u7C7B\uFF1B\u67E5\u8BE2\u540E\u7684\u62A5\u544A\u6CE8\u660E\u6765\u6E90\u3002",
  identityResources: "\u5DF2\u53D1\u73B0\u8EAB\u4EFD\u63D2\u4EF6\u4E0E\u516C\u5F00\u5DE5\u5177",
  teamResources: "\u5DF2\u53D1\u73B0\u56E2\u961F\u63D2\u4EF6\u4E0E\u534F\u4F5C\u5DE5\u5177",
  triageConclusion: "\u5F53\u524D\u4EFB\u52A1\u7684\u5206\u8BCA\u7ED3\u8BBA",
  triageConclusionBody: "\u4FDD\u7559 L0\u2013L2 \u53C2\u8003\uFF0C\u4E5F\u53EF\u76F4\u63A5\u8BF4\u660E\u4EFB\u52A1\u4F9D\u8D56\u3001\u72EC\u7ACB\u5B50\u4EFB\u52A1\u3001\u4E3B\u5B50\u804C\u8D23\u4E0E\u9A8C\u6536\u6761\u4EF6\u3002\u4E0D\u8981\u628A\u7EA7\u522B\u5F53\u5FC5\u987B\u7EC4\u961F\u7684\u95E8\u69DB\u3002",
  selectScopeForReport: "\u9009\u62E9\u4F1A\u8BDD\u67E5\u770B\u8303\u56F4\uFF0C\u67E5\u770B\u8BE5\u4EFB\u52A1\u5B9E\u9645\u63D0\u4EA4\u7684\u5206\u8BCA\uFF1B\u5C1A\u672A\u63D0\u4EA4\u5C31\u4FDD\u6301\u672A\u77E5\u3002",
  dynamicTeamTitle: "\u4E3B\u6A21\u578B\u4E0E\u5B50\u6A21\u578B\u7684\u52A8\u6001\u8054\u7CFB",
  dynamicTeamBody: "\u4E3B\u6A21\u578B\u4FDD\u7559\u4EFB\u52A1\u6240\u6709\u6743\uFF0C\u660E\u786E\u76EE\u6807\u3001\u8303\u56F4\u3001\u4F9D\u8D56\u4E0E\u56DE\u62A5\u8981\u6C42\uFF1B\u5B50\u6A21\u578B\u81EA\u4E3B\u5B9E\u73B0\u3001\u81EA\u68C0\u5E76\u6C47\u62A5\u3002\u6839\u636E\u8FDB\u5C55\u6F84\u6E05\u3001\u8C03\u6574\u6216\u53D6\u6D88\u4EFB\u52A1\uFF0C\u534F\u8C03\u91CD\u53E0\u5199\u5165\uFF0C\u4E3B\u6A21\u578B\u590D\u5BA1\u6574\u5408\u3002\u5957\u4EF6\u4E0D\u989D\u5916\u5BA1\u6279\u6216\u9650\u5236\u59D4\u6D3E\uFF1B\u6309\u5BBF\u4E3B\u4E0E\u56E2\u961F\u5DE5\u5177\u7684\u89C4\u5219\u4F7F\u7528\uFF0C\u63D2\u4EF6\u5B58\u5728\u4E0D\u4EE3\u8868\u56E2\u961F\u5DF2\u542F\u52A8\u3002",
  teamAssign: "\u660E\u786E\u4EFB\u52A1\u4E0E\u8FB9\u754C",
  teamReport: "\u56DE\u62A5\u8FDB\u5EA6\u4E0E\u8BC1\u636E",
  teamAdjust: "\u52A8\u6001\u8C03\u6574\u4F9D\u8D56",
  teamIntegrate: "\u590D\u5BA1\u4E0E\u6574\u5408",
  verificationBoundary: "\u89C4\u5212\u901A\u8FC7\u516C\u5F00 compare / select / track \u5DE5\u5177\u8BC4\u4EF7\u771F\u5B9E\u8BC1\u636E\uFF0C\u4EA4\u4ED8\u56FA\u5B9A verifier_current_session\u3002\u6CE8\u518C\u4E0D\u662F\u8C03\u7528\u6210\u529F\uFF0C\u672A\u9A8C\u8BC1\u548C\u5931\u8D25\u636E\u5B9E\u4FDD\u7559\u3002",
  proposalEvidence: "\u65B9\u6848\u8BC4\u4EF7\u53EA\u63D0\u4F9B\u7B2C\u4E09\u65B9\u5EFA\u8BAE\uFF0C\u4E0D\u80FD\u5F53\u4F5C\u4EA4\u4ED8\u9A8C\u6536\u3002",
  acceptanceEvidence: "\u8BC4\u4EF7\u672C\u8F6E\u5B9E\u9645\u4EA4\u4ED8\u8BC1\u636E\uFF1B\u8FD4\u56DE\u8BC4\u5206\u4E0D\u81EA\u52A8\u8868\u793A\u901A\u8FC7\u79C1\u6709\u9608\u503C\u3002",
  "progress.stagePosition": "\u5F53\u524D\u4E09\u9636\u6BB5\u4F4D\u7F6E\uFF0C\u4E0D\u662F\u5B8C\u6210\u767E\u5206\u6BD4",
  "progress.gaps": "\u53D1\u73B0 / \u9A8C\u8BC1\u7F3A\u53E3",
  "progress.evidenceCount": "\u5DF2\u6709\u5B8C\u6574\u73AF\u8282\u8BC4\u4F30",
  "progress.canContinue": "\u8BB0\u5F55\u539F\u56E0\uFF0C\u72EC\u7ACB\u5DE5\u4F5C\u53EF\u7EE7\u7EED",
  "task.observations": "\u516C\u5F00\u67E5\u8BE2\u8BB0\u5F55",
  "progress.executionObserved": "\u6B64\u5904\u663E\u793A\u5BBF\u4E3B\u89C2\u5BDF\u5230\u7684\u6267\u884C\u72B6\u6001\u4E0E\u65F6\u95F4\u3002\u672C\u8F6E\u7ED3\u675F\u53EA\u8868\u793A\u6A21\u578B\u505C\u6B62\u8FD0\u884C\uFF1B\u4E0D\u7B49\u4E8E\u4EFB\u52A1\u5B8C\u6210\u6216\u4EA4\u4ED8\u9A8C\u6536\u901A\u8FC7\u3002",
  "progress.executionPending": "\u5C1A\u672A\u89C2\u5BDF\u5230\u6267\u884C\u9636\u6BB5\u5F00\u59CB\u3002",
  "progress.noResult": "\u5C1A\u672A\u53D6\u5F97\u8BE5\u9636\u6BB5\u7684\u7ED3\u679C\uFF1B\u67E5\u770B\u4E0B\u65B9\u539F\u56E0\u6216\u7B49\u5F85\u7EE7\u7EED\u3002",
  "progress.notCalled": "\u672C\u9636\u6BB5\u672A\u8C03\u7528\uFF0C\u672A\u4EA7\u751F\u7B2C\u4E09\u65B9\u7ED3\u679C\u3002",
  "progress.reason": "\u672C\u9636\u6BB5\u7684\u539F\u56E0 / \u63D0\u793A",
  "progress.started": "\u5F00\u59CB",
  "progress.finished": "\u7ED3\u675F",
  ownedAssets: "\u5185\u7F6E\u8D44\u4EA7",
  standaloneHint: "\u6B64\u9875\u4EC5\u5217\u72EC\u7ACB\u8D44\u4EA7\u3002\u63D2\u4EF6\u6216\u5957\u4EF6\u5185\u90E8\u7684\u8D44\u4EA7\uFF0C\u8BF7\u5728\u201C\u63D2\u4EF6 / \u5957\u4EF6\u201D\u6761\u76EE\u4E2D\u5C55\u5F00\u67E5\u770B\u3002",
  refreshing: "\u6B63\u5728\u5237\u65B0\uFF0C\u4FDD\u7559\u4E0A\u6B21\u5FEB\u7167",
  "progress.readingGuide": "\u72B6\u6001\u4E0E\u9A8C\u8BC1\u8BF4\u660E",
  "workflow.advisory": "\u6709\u5E8F\u67E5\u770B\u4E0E\u7406\u89E3 \xB7 \u6267\u884C\u65B9\u6848\u53EF\u8C03\u6574",
  "workflow.full": "\u5B8C\u6574\u8BC4\u4F30",
  "workflow.light": "\u8F7B\u91CF\u8BC4\u4F30\uFF0C\u73AF\u8282\u4ECD\u9700\u67E5\u770B",
  "workflow.phase.planning": "\u89C4\u5212\u9636\u6BB5",
  "workflow.phase.reaction": "\u6267\u884C\u53CD\u5E94\u9636\u6BB5",
  "workflow.phase.delivery": "\u9A8C\u6536\u4EA4\u4ED8\u9636\u6BB5",
  "workflow.phase.planning.description": "\u63D0\u793A\u8BCD \u2192 \u5206\u8BCA \u2192 \u56DB\u5C42\u5BF9\u7167 \u2192 \u7B2C\u4E09\u65B9\u9A8C\u8BC1 \u2192 \u7EFC\u5408\u88C5\u914D\u89C4\u5212",
  "workflow.phase.reaction.description": "\u9700\u6C42\u8865\u5145 + \u6267\u884C\u8BA4\u8BC6 \u2192 \u5F85\u529E\u589E\u91CF\u4E0E\u6C89\u6DC0 \u2192 \u6301\u7EED\u6267\u884C",
  "workflow.phase.delivery.description": "\u521D\u59CB\u4E0E\u8FC7\u7A0B\u9700\u6C42 \u2192 \u5168\u94FE\u8DEF\u5BF9\u7167 \u2192 \u4EA4\u4ED8\u8BC4\u4EF7 \u2192 \u72EC\u7ACB\u5EFA\u8BBE\u9700\u6C42",
  "stage.supplement": "\u9700\u6C42\u8865\u5145\u4E0E\u5F71\u54CD\u8BC4\u4F30",
  "stage.todo": "\u5F85\u529E\u5217\u8868\u4E0E\u53D8\u5316",
  "stage.trace": "3-1 \u5168\u94FE\u8DEF\u9A8C\u6536\u5BF9\u7167",
  "stage.construction": "3-3 \u72EC\u7ACB\u5EFA\u8BBE\u9700\u6C42\u4E0E\u8FD0\u884C\u53CD\u9988",
  "workflow.identity": "\u9636\u6BB5\u8EAB\u4EFD\u4E0E\u4F53\u91CF",
  "workflow.identityPending": "\u5C1A\u672A\u63D0\u4EA4\u8EAB\u4EFD\u3001\u89C4\u6A21\u4E0E\u8BC1\u636E\u62A5\u544A",
  "workflow.identity.static": "\u9759\u6001\u804C\u8D23",
  "workflow.identity.dynamic": "\u52A8\u6001\u804C\u8D23",
  "workflow.understanding": "\u672C\u6B65\u9AA4\u7684\u7406\u89E3",
  "workflow.understandingPending": "\u6A21\u578B\u5C1A\u672A\u63D0\u4EA4\u7406\u89E3\uFF0C\u4E0D\u63A8\u6D4B\u5176\u5224\u65AD",
  "workflow.impactPending": "\u5F85\u8BC4\u4F30\u5BF9\u5F53\u524D\u8BA1\u5212\u7684\u5F71\u54CD",
  "workflow.requirement.pending": "\u5F85\u8BC4\u4F30",
  "workflow.requirement.assessed": "\u5DF2\u8BC4\u4F30",
  "workflow.noTodoChange": "\u6682\u65E0\u5F85\u529E\u5173\u8054",
  "workflow.noSupplements": "\u5F53\u524D\u6CA1\u6709\u8FC7\u7A0B\u8865\u5145\uFF1B\u6A21\u578B\u4ECD\u9700\u8BF4\u660E\u6267\u884C\u53CD\u5E94\u9636\u6BB5\u7684\u7406\u89E3",
  "workflow.noTodos": "\u5F53\u524D\u5F85\u529E\u4E3A\u7A7A\uFF1B\u662F\u5426\u9700\u8981\u53D8\u66F4\u4EE5\u8BC4\u4F30\u8BB0\u5F55\u4E3A\u51C6",
  "workflow.todo.pending": "\u5F85\u529E",
  "workflow.todo.active": "\u8FDB\u884C\u4E2D",
  "workflow.todo.done": "\u5DF2\u63D0\u4EA4\u5B8C\u6210",
  "workflow.todo.cancelled": "\u5DF2\u53D6\u6D88",
  "workflow.todoHistory": "\u5F85\u529E\u53D8\u66F4\u5386\u53F2",
  "workflow.planHistory": "\u89C4\u5212\u7248\u672C\u5386\u53F2",
  "workflow.allPrompts": "\u6700\u521D\u4E0E\u8FC7\u7A0B\u63D0\u793A\u8BCD\u5B8C\u6574\u539F\u6587",
  "workflow.export": "\u5BFC\u51FA\u63D0\u793A\u8BCD\u4E0E\u9A8C\u6536\u62A5\u544A\uFF08JSON\uFF09",
  "progress.close": "\u5173\u95ED\u4EFB\u52A1\u8FDB\u5EA6",
  "workflow.unassessed": "\u5C1A\u672A\u67E5\u770B / \u8BC4\u4F30",
  "workflow.assessed": "\u5DF2\u6709\u8BC4\u4F30\u7406\u89E3",
  "workflow.assessmentMissing": "\u7F3A\u5C11\u672C\u73AF\u8282\u7684\u5B8C\u6574\u8BC4\u4F30\u6216\u7406\u89E3\uFF0C\u4E0D\u80FD\u89C6\u4E3A\u5DF2\u5B8C\u6210",
  "workflow.assessmentCount": "\u73AF\u8282\u5DF2\u8BC4\u4F30",
  "workflow.todoUnassessed": "\u5F85\u529E\u5C1A\u672A\u5B8C\u6574\u8BC4\u4F30",
  "workflow.todoUpdated": "\u5DF2\u8BC4\u4F30 \xB7 \u6709\u53D8\u66F4",
  "workflow.todoUnchanged": "\u5DF2\u8BC4\u4F30 \xB7 \u65E0\u53D8\u66F4",
  "workflow.todoUnassessedReason": "\u6CA1\u6709\u53D8\u66F4\u4E0D\u80FD\u8BF4\u660E\u5DF2\u7ECF\u8BC4\u4F30\uFF1B\u7B49\u5F85\u6A21\u578B\u67E5\u770B\u5F53\u524D\u9700\u6C42\u3001\u8BA1\u5212\u4E0E\u5F85\u529E\u5E76\u63D0\u4EA4\u7406\u89E3\u548C\u539F\u56E0\u3002",
  "workflow.todoAssessmentHistory": "\u5F85\u529E\u8BC4\u4F30\u8BB0\u5F55\uFF08\u4E0E\u53D8\u66F4\u5386\u53F2\u5206\u5F00\uFF09",
  "workflow.todoDecision.updated": "\u5DF2\u8BC4\u4F30\uFF0C\u5DF2\u65B0\u589E / \u4FEE\u8BA2\u5F85\u529E",
  "workflow.todoDecision.covered": "\u5DF2\u8BC4\u4F30\uFF0C\u5DF2\u6709\u4E8B\u9879\u8986\u76D6\uFF0C\u5F85\u529E\u4E0D\u53D8",
  "workflow.todoDecision.not-needed": "\u5DF2\u8BC4\u4F30\uFF0C\u672C\u6B21\u4E0D\u9700\u8981\u5F85\u529E\u53D8\u66F4",
  "workflow.planVersion": "\u8986\u76D6\u89C4\u5212\u7248\u672C",
  "workflow.attempt.running": "\u5B9E\u9645\u9A8C\u8BC1\u8FDB\u884C\u4E2D",
  "workflow.attempt.evaluated": "\u5DF2\u53D6\u5F97\u8BC4\u4EF7",
  "workflow.attempt.unavailable": "\u5DF2\u5C1D\u8BD5 \xB7 \u5DE5\u5177\u4E0D\u53EF\u7528",
  "workflow.attempt.failed": "\u5DF2\u8C03\u7528 / \u5C1D\u8BD5 \xB7 \u5931\u8D25",
  "workflow.attempt.paused": "\u5C1D\u8BD5\u4E2D\u65AD \xB7 \u5F85\u7EE7\u7EED",
  "workflow.attempt.stale": "\u7ED3\u679C\u8FC7\u671F \xB7 \u5F85\u91CD\u8BD5",
  "workflow.toolInvoked": "\u5DF2\u5411\u516C\u5171\u9A8C\u8BC1\u5DE5\u5177\u53D1\u51FA\u5B9E\u9645\u8C03\u7528",
  "workflow.toolNotInvoked": "\u5C1A\u672A\u53D1\u51FA\u5B9E\u9645\u5DE5\u5177\u8C03\u7528\uFF1B\u67E5\u770B\u6CE8\u518C\u4E0D\u53EF\u7528\u6216\u4E2D\u65AD\u539F\u56E0",
  "workflow.runtimeVersion": "\u5BBF\u4E3B\u8FD0\u884C\u7248\u672C",
  "workflow.runtimeUnknown": "\u672A\u62A5\u544A",
  "workflow.runtimeMismatch": "\u5C1A\u672A\u786E\u8BA4\u5BBF\u4E3B\u5E94\u7528\u5F53\u524D 3.0.2 \u5165\u53E3",
  "progress.status.assessed": "\u5DF2\u8BC4\u4F30 \xB7 \u65E0\u9700\u53D8\u66F4",
  "workflow.partialUnderstanding": "\u5DF2\u63D0\u4EA4\u7406\u89E3\uFF08\u5F53\u524D\u4ECD\u6709\u8BC4\u4F30\u7F3A\u53E3\uFF09",
  "verifier.title": "DSH \u9A8C\u8BC1\u5668\u4E0E\u5957\u4EF6\u8DEF\u7531",
  "verifier.boundary": "\u590D\u7528\u5DF2\u6302\u8F7D\u7684 dsh-llm-verifier\u3002\u88C1\u5224\u6A21\u578B\u5728 DSH \u7684 LLM Verifier \u8BBE\u7F6E\u4E2D\u7BA1\u7406\uFF1B\u8FD9\u91CC\u4EC5\u8BBE\u7F6E\u672C\u4EFB\u52A1\u7684\u89C4\u5212\u8C03\u7528\u8DEF\u7531\uFF0C\u4E0D\u6539\u9A8C\u8BC1\u5668\u63D2\u4EF6\u3002",
  "verifier.planningRoute": "\u89C4\u5212\u9A8C\u8BC1\u8DEF\u7531",
  "verifier.repeats": "\u8BC4\u4EF7\u91CD\u590D\u6B21\u6570",
  "verifier.route.auto": "\u81EA\u52A8 \xB7 \u6309\u5DF2\u63D0\u4EA4\u8BC1\u636E",
  "verifier.route.compare": "\u89C4\u5212\u5BF9\u7167 \xB7 \u4E24\u4E2A\u5019\u9009",
  "verifier.route.select": "\u89C4\u5212\u6392\u5E8F \xB7 \u4E09\u4E2A\u4EE5\u4E0A\u5019\u9009",
  "verifier.route.track": "\u8FC7\u7A0B\u8BC4\u4EF7 \xB7 \u771F\u5B9E\u68C0\u67E5\u70B9",
  "verifier.save": "\u4FDD\u5B58\u672C\u4EFB\u52A1\u8DEF\u7531",
  "verifier.saved": "\u5DF2\u4FDD\u5B58\uFF1B\u4EC5\u5F71\u54CD\u4E0B\u4E00\u6B21\u89C4\u5212\u9A8C\u8BC1\uFF0C\u4E0D\u7ACB\u5373\u8C03\u7528\u88C1\u5224\u3002",
  "verifier.routeHelp": "\u5BF9\u8BDD\u6A21\u578B\u63D0\u4EA4\u771F\u5B9E\u5019\u9009\u6216\u68C0\u67E5\u70B9\u540E\u8C03\u7528\u3002\u81EA\u52A8\u8DEF\u7531\uFF1A\u4E09\u9879\u4EE5\u4E0A\u5019\u9009\u2192\u6392\u5E8F\uFF1B\u8FC7\u7A0B\u6B65\u9AA4\u2192\u68C0\u67E5\u70B9\uFF1B\u5176\u4ED6\u2192\u5BF9\u7167\u3002\u7F3A\u5C11\u5BF9\u5E94\u8BC1\u636E\u4F1A\u660E\u786E\u63D0\u793A\u3002",
  "verifier.acceptanceRoute": "\u6700\u7EC8\u9A8C\u6536\u56FA\u5B9A\u5165\u53E3",
  "verifier.actualModel": "\u672C\u6B21\u5B9E\u9645\u88C1\u5224\u6A21\u578B",
  "verifier.modelUnconfirmed": "\u5C1A\u65E0\u5DF2\u8FD4\u56DE\u7684\u5B9E\u9645\u6A21\u578B\u8BC1\u636E",
  "verifier.notAttempted": "\u5C1A\u672A\u8FDB\u884C\u5BF9\u5E94\u9A8C\u8BC1\u5C1D\u8BD5",
  "verifier.result": "\u8BC4\u5206\u3001\u5177\u4F53\u8BC4\u4EF7\u4E0E\u591A\u88C1\u5224\u7ED3\u679C",
  "workflow.taskUnderstanding": "\u7EFC\u5408\u88C5\u914D\u540E\u7684\u4EFB\u52A1\u8BA4\u8BC6",
  "workflow.executionInsights": "\u6267\u884C\u7406\u89E3\u4E0E\u6C89\u6DC0\u8BB0\u5F55",
  "workflow.deliveryConclusion": "\u4EA4\u4ED8\u9A8C\u6536\u7ED3\u8BBA",
  "workflow.construction.missingItems": "\u9879\u76EE\u7F3A\u5C11\u7684\u4E8B\u9879",
  "workflow.construction.problems": "\u5B58\u5728\u7684\u95EE\u9898",
  "workflow.construction.suiteStatus": "\u5957\u4EF6\u8FD0\u884C\u60C5\u51B5",
  "workflow.construction.suggestions": "\u6539\u52A8\u5EFA\u8BAE",
  "workflow.origin.plan": "\u7EFC\u5408\u88C5\u914D\u89C4\u5212",
  "workflow.origin.user-supplement": "\u7528\u6237\u8865\u5145",
  "workflow.origin.model-execution": "\u6267\u884C\u8BA4\u8BC6",
  "layers.completed": "\u5DF2\u7ECF\u7F16\u6392",
  "layers.pending": "\u591A\u5C42\u5BF9\u7167",
  "layers.hint": "\u7B49\u5F85\u5BF9\u8BDD\u6A21\u578B\u8BFB\u53D6\u5DE5\u5177\u3001\u9A8C\u8BC1\u3001\u56E2\u961F\u4E0E\u8EAB\u4EFD\u5C42\u5E76\u8FD4\u56DE\u7406\u89E3\uFF1B\u4E0D\u4F1A\u542F\u52A8\u4E09\u9636\u6BB5\u6216\u9650\u5236\u5176\u4ED6\u63D2\u4EF6\u3002"
};

// locale/en.json
var en_default = {
  scope: "Scope",
  hostScope: "Global host (excludes session-only assets)",
  entry: "Orchestration",
  title: "Task orchestration",
  readOnly: "Read-only assets \xB7 task routing",
  refresh: "Refresh inventory",
  close: "Close board",
  layers: "Registered capabilities and optional resources",
  workspace: "CURRENT HOST / ASSETS & TASKS",
  seam: "Independent suite \xB7 Public APIs",
  overview: "Overview",
  tools: "Tools",
  memory: "Memory resources",
  identity: "Identity",
  organization: "Teamwork layer",
  dispatch: "Dispatch orchestration mode",
  "overview.description": "A process for using agents to work on projects: planning, execution response and delivery acceptance. Inspect each step and let understanding guide implementation.",
  "tools.description": "DSH public registries and source containment evidence. Plugins and bundles are peers; owned skills, MCP and environments nest inside. Unknown owners stay standalone. Refreshes every 10 seconds while open.",
  "memory.description": "Inspect installed memory systems and configured directories. Discovery does not mean relevant records have been read.",
  "identity.description": "Make roles and responsibilities visible. The executing model selects task roles without overwriting host persona settings.",
  "organization.description": "Choose collaboration by task size. Assign clear scopes and review actual evidence.",
  "dispatch.description": "Inspect planning, execution response and delivery steps in order, report understanding, adapt implementation, assess unchanged todos and actually attempt delivery evaluation.",
  "tools.metric": "Assets including nested items",
  "memory.metric": "Memory systems & files",
  "identity.metric": "Identity plugins and public tools",
  "organization.metric": "Collaboration tools",
  relicTitle: "Reference for model judgment",
  relicBody: "Guidance applies to execution choices, not skipping inspections. Report registered-layer findings, assessment reasons and actual evaluation attempts.",
  discovery: "Discover",
  reading: "Read relevant records",
  selection: "Assess & adopt",
  dispatchTitle: "Ordered inspection and flexible execution",
  dispatchBody: "Inspect the request, triage and four registered layers; attempt proposal review, assess every follow-up and always attempt delivery evaluation.",
  viewPipeline: "View pipeline",
  boundaries: "Clear responsibilities and scope",
  boundaryBody: "This suite reads public host registries. Existing dispatch mode, subscription plugin, verifier settings, and other plugins remain independent. Select the new preset in a new session.",
  skills: "Skills",
  plugins: "Plugins / bundles",
  mcp: "MCP",
  search: "Search names or descriptions\u2026",
  empty: "No entries discovered in this scope, or no matching search results.",
  noDescription: "No description",
  catalogHint: "Discovery is not reading; registration is not a successful capability call",
  fetchFailed: "Host inventory could not be read. Refresh to retry.",
  retry: "Retry",
  loading: "Reading host registries\u2026",
  memoryRoots: "Read-only memory directories",
  warnings: "Discovery notices",
  "status.available": "Registered",
  "status.enabled": "Enabled",
  "status.disabled": "Disabled",
  "status.failed": "Failed",
  "status.discovered": "Unread",
  "status.unknown": "Unknown",
  "status.pending": "Waiting",
  "status.loading": "Loading",
  "status.unloading": "Unloading",
  identityTitle: "Report the current task role",
  identityBody: "Record public identity capabilities and current model responsibilities. Discovery does not adopt a role or read private configuration.",
  lead: "Main orchestrator",
  "lead.description": "Understand the request, triage, compare, coordinate, integrate independent review, and own final delivery.",
  worker: "Generalist team member",
  "worker.description": "Plan, implement, self-check, and suggest improvements within an explicit task scope.",
  reviewer: "Independent verifier",
  "reviewer.description": "Use existing judge settings to provide evidence and advice; the main model explains its adoption decisions.",
  identityHint: "Discovery does not switch roles. The model reports its adopted identity and source for the selected session.",
  "L0.title": "Complete directly",
  "L0.description": "Clear, reversible, single-point work without useful independent parallel tasks.",
  "L1.title": "Small, explicit assignments",
  "L1.description": "A few files or steps with clear constraints. Execute directly or delegate one independent task when useful.",
  "L2.title": "Coordinate across modules",
  "L2.description": "Resolve consequential unknowns, divide by dependencies, parallelize independent work, and review in layers.",
  assignment: "Each assignment includes",
  assignmentBody: "Goal \xB7 Editable scope \xB7 Constraints \xB7 Acceptance criteria \xB7 Evidence. Give generalist members autonomy while the main model manages dependencies and review.",
  teamTools: "Registered collaboration tools",
  triage: "Triage",
  compare: "Layer comparison",
  verify: "Independent review",
  assemble: "Integrated assembly planning",
  execute: "Execute",
  "triage.description": "Main model assesses complexity",
  "compare.description": "Read and assess relevant assets",
  "verify.description": "Use existing judge settings",
  "assemble.description": "Integrate the request, triage, evidence and real review",
  "execute.description": "Complete the integrated plan",
  judgeTitle: "Internal verifier model call",
  judgeBody: "The verifier calls its configured judge internally; it does not spawn a visible subagent conversation. Actual results appear in the main tool call and task details. Proposal review and delivery evaluation are separate; degraded never means passed.",
  taskRecords: "Task records in this host run",
  selectSession: "Select a main session\u2026",
  noTask: "No task selected. Create a session with dispatch-orchestrator and submit a task to inspect triage, layer comparison, review, and integrated conclusions.",
  pending: "Not submitted",
  turn: "Turn",
  "phase.discovered": "Planning assessment incomplete",
  "phase.reviewed": "Planning evaluation returned",
  "phase.ready": "Integrated plan recorded",
  "task.prompt": "Original user input",
  "task.triage": "Task triage",
  "task.comparison": "Layer judgments",
  "task.review": "Independent review",
  "task.conclusion": "Integrated assembly plan",
  "progress.stages": "Three-phase task progress",
  "progress.title": "Task progress",
  "progress.guide": "Follow this conversation through orchestration and execution",
  "progress.refresh": "Refresh task progress",
  "progress.loading": "Connecting to this conversation\u2026",
  "progress.fetchFailed": "Cannot read task progress. Refresh to retry.",
  "progress.stale": "Connection interrupted. The last snapshot may be outdated; the current stage is unconfirmed.",
  "progress.staleShort": "Stale snapshot",
  "progress.current": "Current stage",
  "progress.fullPrompt": "Expand original input",
  "progress.noTask": "No user task captured for this conversation during this suite runtime. Send a new task to begin; old records are not backfilled.",
  "progress.ordinary": "All main presets can submit triage and comparison and request review. Discovery gaps do not block execution.",
  "progress.read": "Read by suite",
  "progress.evidenceHint": "Inspect each step and report understanding; execution may adapt. No changes do not imply assessment. Actual evaluation failure is distinct from an uncalled step.",
  "progress.autoRefresh": "Automatically follows this conversation",
  "progress.status.pending": "Pending",
  "progress.status.active": "In progress",
  "progress.status.done": "Evidence recorded",
  "progress.status.failed": "Failed",
  "progress.status.paused": "Paused / awaiting continuation",
  "progress.status.ended": "Turn ended",
  "stage.input": "Original user input",
  "stage.input.description": "Capture original input and steering constraints",
  "stage.triage": "Task triage",
  "stage.triage.description": "Main model submits complexity, scope and reasons",
  "stage.compare": "Layer comparison",
  "stage.compare.description": "Registered tools, verification, teamwork and identity",
  "stage.verify": "Independent review",
  "stage.verify.description": "Existing verifier calls its configured judge",
  "stage.assemble": "Integrated assembly planning",
  "stage.assemble.description": "Main model adopts or revises advice and commits a conclusion",
  "stage.execute": "Task execution",
  "stage.execute.description": "Inject the conclusion into subsequent system context and continue execution",
  environments: "VENV / environments",
  accept: "Delivery evaluation",
  "accept.description": "Evaluate actual delivery evidence",
  "stage.accept": "3-2 Verifier acceptance and conclusion",
  "stage.accept.description": "Evaluate delivery via the existing verifier",
  "task.acceptance": "Delivery evaluation result",
  "progress.status.degraded": "Degraded / can continue",
  "progress.status.skipped": "Legacy uncalled step \xB7 assessment needed",
  verification: "Verification layer",
  "verification.description": "Current public verifier tools, availability and submitted evidence. Discovery does not call the judge.",
  "verification.metric": "Proposal / delivery interfaces",
  "kind.memory-system": "Memory systems",
  "kind.memory-database": "Memory databases",
  "kind.memory-file": "Memory files",
  "kind.memory-tool": "Public query tools",
  "kind.observation": "Model query reports",
  "status.unavailable": "Not visible",
  "status.reported": "Model reported",
  protocol: "Protocol",
  port: "Port",
  endpoint: "Endpoint",
  unknown: "Unknown / unconfirmed",
  noTcpPort: "No TCP port",
  memoryProtocolTitle: "Confirm the running interface before recall",
  memoryProtocolBody: "Use visible MCP or public status tools to identify the memory transport and port, then recall task-related conversation memory. Stdio has no TCP port. Query databases through public tools; files stay separate. Reports retain their source.",
  identityResources: "Discovered identity plugins and public tools",
  teamResources: "Discovered team plugins and collaboration tools",
  triageConclusion: "Current task triage",
  triageConclusionBody: "Keep L0\u2013L2 as references, or describe dependencies, subtasks, responsibilities and acceptance directly.",
  selectScopeForReport: "Select a session scope to see submitted task triage; missing submissions remain unknown.",
  dynamicTeamTitle: "Dynamic lead and worker coordination",
  dynamicTeamBody: "The lead owns scope and integration. Workers implement, self-check and report within their assignment. Adjust dependencies and assignments from real progress, coordinate shared writes, and review evidence. Delegate only when authorized and useful.",
  teamAssign: "Define scope",
  teamReport: "Report evidence",
  teamAdjust: "Adjust dependencies",
  teamIntegrate: "Review and integrate",
  verificationBoundary: "Planning evaluates real evidence through public compare/select/track tools; final acceptance uses verifier_current_session. Registration is not invocation success.",
  proposalEvidence: "A proposal verdict is advice, not delivery acceptance.",
  acceptanceEvidence: "Evaluate actual delivery evidence without assuming a private pass threshold.",
  "progress.stagePosition": "Position in the three phases, not a completion percentage",
  "progress.gaps": "Discovery / review gaps",
  "progress.evidenceCount": "Fully assessed steps",
  "progress.canContinue": "Record the gap; independent work can continue",
  "task.observations": "Public query reports",
  "progress.executionObserved": "This shows execution state and times observed by the host. Driver idle does not mean task completion or delivery acceptance.",
  "progress.executionPending": "Execution has not been observed yet.",
  "progress.noResult": "No result was obtained for this stage; see the reason or continue when ready.",
  "progress.notCalled": "This stage was not called; no third-party result exists.",
  "progress.reason": "Stage reason / notice",
  "progress.started": "Started",
  "progress.finished": "Ended",
  ownedAssets: "Owned assets",
  standaloneHint: "This page lists standalone assets. Expand plugin or bundle entries for their owned assets.",
  refreshing: "Refreshing; showing previous snapshot",
  "progress.readingGuide": "State and verification notes",
  "workflow.advisory": "Ordered inspection and understanding \xB7 execution may adapt",
  "workflow.full": "Full assessment",
  "workflow.light": "Brief assessment; steps still inspected",
  "workflow.phase.planning": "Planning",
  "workflow.phase.reaction": "Execution response",
  "workflow.phase.delivery": "Delivery acceptance",
  "workflow.phase.planning.description": "Prompt \u2192 triage \u2192 four registered layers \u2192 review \u2192 integrated plan",
  "workflow.phase.reaction.description": "Supplements + execution insights \u2192 todo increments and evidence \u2192 ongoing work",
  "workflow.phase.delivery.description": "Initial and process requirements \u2192 full trace \u2192 evaluation \u2192 separate construction requests",
  "stage.supplement": "Follow-ups and impact",
  "stage.todo": "Todo list and changes",
  "stage.trace": "3-1 Full requirement trace",
  "stage.construction": "3-3 Project gaps and suite feedback",
  "workflow.identity": "Phase identity and scale",
  "workflow.identityPending": "Identity, scale and evidence not reported",
  "workflow.identity.static": "Static responsibility",
  "workflow.identity.dynamic": "Dynamic responsibility",
  "workflow.understanding": "Understanding of this step",
  "workflow.understandingPending": "Understanding not submitted; no inferred judgment",
  "workflow.impactPending": "Impact on the current plan not assessed",
  "workflow.requirement.pending": "Pending assessment",
  "workflow.requirement.assessed": "Assessed",
  "workflow.noTodoChange": "No todo association",
  "workflow.noSupplements": "No follow-ups; initial prompt preserved",
  "workflow.noTodos": "Todo list is empty; inspect the assessment record to learn why",
  "workflow.todo.pending": "Pending",
  "workflow.todo.active": "Active",
  "workflow.todo.done": "Completion reported",
  "workflow.todo.cancelled": "Cancelled",
  "workflow.todoHistory": "Todo change history",
  "workflow.planHistory": "Plan version history",
  "workflow.allPrompts": "Complete initial and process prompts",
  "workflow.export": "Export prompts and acceptance report (JSON)",
  "progress.close": "Close task progress",
  "workflow.unassessed": "Not inspected / assessed",
  "workflow.assessed": "Understanding assessed",
  "workflow.assessmentMissing": "Required inspection, attempt or understanding is missing",
  "workflow.assessmentCount": "steps assessed",
  "workflow.todoUnassessed": "Todo assessment incomplete",
  "workflow.todoUpdated": "Assessed \xB7 changed",
  "workflow.todoUnchanged": "Assessed \xB7 unchanged",
  "workflow.todoUnassessedReason": "No changes do not prove assessment. Inspect requirements, plan and todos and submit understanding and reasons.",
  "workflow.todoAssessmentHistory": "Todo assessments (separate from changes)",
  "workflow.todoDecision.updated": "Assessed and updated",
  "workflow.todoDecision.covered": "Assessed; existing work covers the requirement",
  "workflow.todoDecision.not-needed": "Assessed; no todo change needed",
  "workflow.planVersion": "Covering plan version",
  "workflow.attempt.running": "Evaluation running",
  "workflow.attempt.evaluated": "Evaluation returned",
  "workflow.attempt.unavailable": "Attempted \xB7 tool unavailable",
  "workflow.attempt.failed": "Attempted \xB7 failed",
  "workflow.attempt.paused": "Interrupted \xB7 resume needed",
  "workflow.attempt.stale": "Stale \xB7 retry needed",
  "workflow.toolInvoked": "Actual public tool invocation issued",
  "workflow.toolNotInvoked": "Invocation not issued; see registry or cancellation evidence",
  "workflow.runtimeVersion": "Host runtime version",
  "workflow.runtimeUnknown": "Not reported",
  "workflow.runtimeMismatch": "Current 3.0.2 host activation unconfirmed",
  "progress.status.assessed": "Assessed \xB7 unchanged",
  "workflow.partialUnderstanding": "Submitted understanding (assessment gaps remain)",
  "verifier.title": "DSH verifier and suite routing",
  "verifier.boundary": "Reuses the mounted dsh-llm-verifier. Manage judge models in DSH LLM Verifier settings. These controls only select this task\u2019s planning tool; they do not modify the verifier plugin.",
  "verifier.planningRoute": "Planning verification route",
  "verifier.repeats": "Evaluation repeats",
  "verifier.route.auto": "Auto \xB7 submitted evidence",
  "verifier.route.compare": "Compare \xB7 two candidates",
  "verifier.route.select": "Select \xB7 three or more candidates",
  "verifier.route.track": "Track \xB7 real checkpoints",
  "verifier.save": "Save task route",
  "verifier.saved": "Saved for the next planning call; no judge call was made.",
  "verifier.routeHelp": "Submit real candidates or checkpoints. Auto: three or more candidates \u2192 select; real steps \u2192 track; otherwise \u2192 compare. Missing evidence is reported.",
  "verifier.acceptanceRoute": "Final acceptance tool",
  "verifier.actualModel": "Actual judge model",
  "verifier.modelUnconfirmed": "No returned model evidence yet",
  "verifier.notAttempted": "No attempt recorded",
  "verifier.result": "Scores, evaluation and judge results",
  "workflow.taskUnderstanding": "Integrated task understanding",
  "workflow.executionInsights": "Execution insights and accumulated evidence",
  "workflow.deliveryConclusion": "Delivery acceptance conclusion",
  "workflow.construction.missingItems": "Missing project items",
  "workflow.construction.problems": "Current problems",
  "workflow.construction.suiteStatus": "Suite runtime observations",
  "workflow.construction.suggestions": "Improvement suggestions",
  "workflow.origin.plan": "Integrated plan",
  "workflow.origin.user-supplement": "User supplement",
  "workflow.origin.model-execution": "Execution insight",
  "layers.completed": "Orchestrated",
  "layers.pending": "Layer comparison",
  "layers.hint": "Waiting for the model\u2019s four-layer understanding. No three-phase workflow or restrictions on other plugins."
};

// src/client/surface.tsx
var import_react = __toESM(require("react"), 1);
function Surface({ children }) {
  return /* @__PURE__ */ import_react.default.createElement("div", { className: "os-surface" }, /* @__PURE__ */ import_react.default.createElement("style", null, '.os-entry{display:flex;align-items:center;gap:9px;width:100%;padding:9px 12px;border:0;background:transparent;color:inherit;cursor:pointer;font:inherit;border-radius:8px}.os-entry:hover{background:var(--dsw-alias-interactive-bg-hover)}\r\n.os-pills{flex-wrap:wrap}.os-tool-name{display:inline-block!important;padding:3px 8px;margin:4px 4px 4px 0!important;border:1px solid var(--os-line);border-radius:6px;color:var(--os-accent);background:var(--os-hover);font:11px/1.6 ui-monospace,monospace}.os-evidence{border-left:2px solid var(--os-line);padding-left:9px;color:var(--os-muted)}.os-connection{display:grid;grid-template-columns:70px minmax(0,1fr);gap:5px 10px;font-size:11px;margin:14px 0}.os-connection dt{color:var(--os-muted)}.os-connection dd{margin:0;overflow-wrap:anywhere}.os-report{white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;font:12px/1.7 var(--dsw-font-family,system-ui,sans-serif);color:var(--os-fg)}.os-status-position{font-size:10px;font-variant-numeric:tabular-nums;padding:1px 5px;border-radius:5px;background:var(--os-hover)}.os-status-gap{font-size:10px;color:var(--os-danger)}.os-status-summary{display:grid;grid-template-columns:1fr auto;gap:7px;border:1px solid var(--os-line);padding:10px;border-radius:8px;margin-bottom:12px;background:var(--os-hover)}.os-status-summary>span{font-size:11px;color:var(--os-muted)}.os-status-summary p{grid-column:1/-1;font-size:11px;color:var(--os-danger);margin:0}.os-status-trigger[aria-expanded="true"]{background:var(--os-hover);color:var(--os-accent)}.os-status-popover details[open]{border-top:1px solid var(--os-line);padding-top:8px}.os-status-stages li[aria-current]{background:var(--os-hover);padding:6px;border-radius:6px}.os-status .os-status-active{animation:os-status-pulse 2s ease-in-out infinite}@keyframes os-status-pulse{50%{opacity:.45}}@media(prefers-reduced-motion:reduce){.os-status .os-status-active{animation:none}}\r\n.os-status{position:relative;display:inline-flex;color:var(--os-fg);font:12px/1.6 var(--dsw-font-family,system-ui,sans-serif)}\r\n.os-status-trigger{display:flex;align-items:center;gap:6px;border:0;background:transparent;color:var(--os-muted);padding:4px 7px;border-radius:var(--dsw-radius-sm,6px);font:inherit;cursor:pointer;max-width:280px;white-space:nowrap}\r\n.os-status-trigger>span:nth-child(2){overflow:hidden;text-overflow:ellipsis}.os-status-trigger:hover{background:var(--os-hover);color:var(--os-fg)}\r\n.os-status-light,.os-status-dots i{display:inline-block;width:6px;height:6px;border:1px solid var(--os-line);border-radius:50%;flex:none;background:transparent}\r\n.os-status-dots{display:flex;gap:3px}.os-status .os-status-active,.os-status .os-status-done{background:var(--os-accent);border-color:var(--os-accent)}.os-status .os-status-failed,.os-status .os-status-degraded{border-color:var(--os-danger);background:var(--os-danger)}.os-status .os-status-ended,.os-status .os-status-skipped{background:var(--os-muted)}\r\n.os-status-popover{position:absolute;right:0;top:calc(100% + 6px);z-index:1000;width:min(420px,calc(100vw - 24px));max-height:min(520px,70dvh);overflow:auto;padding:14px;background:var(--os-bg);border:1px solid var(--os-line);border-radius:var(--dsw-radius-lg,10px);box-shadow:var(--dsw-elevation-prominent,0 8px 28px var(--dsw-alias-bg-mask-1));box-sizing:border-box}\r\n.os-status-popover header{display:flex;justify-content:space-between;align-items:center}.os-status-popover button{background:transparent;border:0;color:inherit;font:inherit;cursor:pointer;padding:4px 8px}.os-status-popover details{margin:7px 0}.os-status-popover summary{cursor:pointer}.os-status-popover pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.6 var(--dsw-font-family,system-ui,sans-serif);max-height:200px;overflow:auto;background:var(--os-hover);padding:8px;border-radius:6px}.os-status-popover .os-caption{color:var(--os-muted);font-size:11px}.os-status-stages{list-style:none;padding:0;display:flex;flex-direction:column;gap:7px}.os-status-stages li{display:flex;align-items:center;gap:8px}.os-status-stages li>span:last-child{margin-left:auto;color:var(--os-muted);font-size:11px}.os-status-stages strong{font-weight:500}.os-status-stages li[aria-current]{color:var(--os-accent)}.os-status button:focus-visible,.os-status summary:focus-visible{outline:2px solid var(--os-accent);outline-offset:2px}.os-asset-detail>.os-assets{margin:12px 0 0 12px;border-left:1px solid var(--os-line);padding-left:12px}\r\n@media(max-width:600px){.os-status-dots{display:none}.os-status-trigger{max-width:170px}.os-status-popover{position:fixed;top:64px;right:12px}}\r\n.os-scope{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-bottom:18px;font-size:11px;color:var(--os-muted)}.os-scope select{font:inherit;padding:5px 9px;max-width:75%;background:var(--os-bg);border:1px solid var(--os-line);border-radius:7px;color:inherit}\r\n.os-backdrop{position:fixed;inset:0;z-index:1000;background:var(--dsw-alias-bg-mask-3);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:28px}\r\n.os-panel,.os-themed{--os-bg:var(--dsw-alias-bg-layer-1,Canvas);--os-fg:var(--dsw-alias-label-primary,CanvasText);--os-line:var(--dsw-alias-border-l3,color-mix(in srgb,CanvasText 15%,transparent));--os-muted:var(--dsw-alias-label-secondary,GrayText);--os-accent:var(--dsw-alias-link,var(--dsw-alias-brand-primary,CanvasText));--os-danger:var(--dsw-alias-state-error-primary,CanvasText);--os-hover:var(--dsw-alias-interactive-bg-hover,color-mix(in srgb,CanvasText 7%,transparent))}\r\n.os-panel{width:min(1150px,100%);height:min(790px,calc(100dvh - 56px));background:var(--os-bg);color:var(--os-fg);border:1px solid var(--os-line);border-radius:20px;box-shadow:0 24px 100px var(--dsw-alias-bg-mask-1);display:flex;flex-direction:column;overflow:hidden;font:14px/1.65 var(--dsw-font-family,system-ui,sans-serif);outline:none}\r\n.os-panel *{box-sizing:border-box}.os-panel button,.os-panel input,.os-panel select{font:inherit;color:inherit}.os-panel button{cursor:pointer}.os-panel button:disabled{opacity:.5;cursor:wait}.os-panel button:focus-visible,.os-panel input:focus-visible,.os-panel select:focus-visible,.os-panel summary:focus-visible{outline:2px solid var(--os-accent);outline-offset:3px}\r\n.os-header{display:flex;align-items:center;gap:14px;padding:22px 26px;border-bottom:1px solid var(--os-line);flex:none}.os-logo{width:42px;height:42px;display:grid;place-items:center;background:color-mix(in srgb,var(--os-accent) 9%,transparent);color:var(--os-accent);border-radius:12px}.os-header h1{font-size:20px;margin:0;font-weight:650;letter-spacing:.02em}.os-eyebrow{font-size:10px;letter-spacing:.13em;color:var(--os-muted);font-weight:600}.os-header-label{margin-left:auto;font-size:11px;color:var(--os-muted);border:1px solid var(--os-line);padding:3px 10px;border-radius:20px}.os-icon{width:32px;height:32px;display:grid;place-items:center;background:transparent;border:0;border-radius:8px}.os-icon:hover{background:var(--os-line)}\r\n.os-layout{display:flex;min-height:0;flex:1}.os-nav{width:205px;flex:none;border-right:1px solid var(--os-line);padding:24px 12px;display:flex;flex-direction:column;gap:6px;background:color-mix(in srgb,var(--os-fg) 2%,var(--os-bg))}.os-nav button{display:flex;align-items:center;gap:10px;text-align:left;padding:10px 12px;background:transparent;border:0;border-radius:9px;font-size:13px}.os-nav button:hover{background:var(--os-line)}.os-nav button.os-nav-active{color:var(--os-accent);background:color-mix(in srgb,var(--os-accent) 7%,transparent);font-weight:650}.os-nav-index{font-size:10px;opacity:.65;font-variant-numeric:tabular-nums}.os-nav-count{margin-left:auto;font-size:11px;opacity:.6}.os-nav-note{margin-top:auto;padding:20px 10px 0;font-size:11px;line-height:1.9;color:var(--os-muted)}.os-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--os-accent);margin-right:7px}\r\n.os-main{flex:1;min-width:0;overflow:auto;padding:28px 30px}.os-page-title{margin-bottom:25px}.os-page-title h2{font-size:25px;letter-spacing:-.025em;margin:5px 0 7px;font-weight:650}.os-page-title p{color:var(--os-muted);margin:0;font-size:13px;max-width:630px}.os-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:24px}.os-stats button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;border:1px solid var(--os-line);border-radius:12px;padding:17px;background:var(--os-bg)}.os-stats button:hover{border-color:var(--os-accent)}.os-stats strong{font-size:33px;line-height:1.5;font-weight:500;font-variant-numeric:tabular-nums}.os-stats button>span:last-child{font-size:11px;color:var(--os-muted)}.os-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:16px;margin-bottom:20px}.os-feature{border:1px solid var(--os-line);padding:22px;border-radius:13px}.os-panel h3{font-size:15px;font-weight:650;margin:8px 0}.os-feature p,.os-note p{font-size:13px;color:var(--os-muted);margin:6px 0}.os-accent{background:linear-gradient(135deg,color-mix(in srgb,var(--os-accent) 4%,transparent),transparent);border-color:color-mix(in srgb,var(--os-accent) 25%,transparent)}.os-link{border:0;background:transparent;padding:14px 0 0;color:var(--os-accent)!important;font-size:12px!important}.os-flow{display:flex;gap:7px;flex-wrap:wrap;margin-top:20px}.os-flow span{font-size:11px;padding:3px 9px;border-radius:5px;background:var(--os-line)}.os-note{padding:17px 20px;background:color-mix(in srgb,var(--os-fg) 3%,var(--os-bg));border:1px solid var(--os-line);border-radius:11px;margin-bottom:18px}.os-note code{display:block;overflow-wrap:anywhere;font-size:11px;margin-top:5px}.os-toolbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}.os-toolbar input{margin-left:auto;min-width:160px;width:215px}.os-toolbar input,.os-toolbar select{padding:7px 11px;border:1px solid var(--os-line);border-radius:8px;background:var(--os-bg);font-size:12px}.os-toolbar select{flex:1;min-width:180px;max-width:100%}.os-pills{display:flex;gap:5px}.os-pills button{border:1px solid transparent;background:transparent;padding:6px 11px;font-size:12px;border-radius:7px}.os-pills .selected{border-color:var(--os-line);background:color-mix(in srgb,var(--os-fg) 5%,var(--os-bg))}.os-pills span{margin-left:5px;opacity:.5}\r\n.os-assets{display:flex;flex-direction:column;gap:9px}.os-asset{border:1px solid var(--os-line);border-radius:10px}.os-asset summary{display:flex;align-items:center;gap:12px;padding:14px;cursor:pointer;list-style:none}.os-asset summary::-webkit-details-marker{display:none}.os-asset-mark{width:31px;height:31px;border-radius:8px;background:color-mix(in srgb,var(--os-accent) 6%,transparent);color:var(--os-accent);display:grid;place-items:center;font-size:12px;flex:none}.os-asset-heading{display:flex;flex-direction:column;min-width:0;flex:1}.os-asset-heading strong{font-size:12px;font-weight:600;overflow-wrap:anywhere}.os-asset-heading>span{font-size:11px;color:var(--os-muted);white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.os-badge{flex:none;font-size:10px;border:1px solid var(--os-line);padding:2px 7px;border-radius:20px;color:var(--os-muted)}.os-available,.os-enabled{color:var(--os-accent);border-color:color-mix(in srgb,var(--os-accent) 20%,transparent)}.os-failed{color:var(--os-danger);border-color:color-mix(in srgb,var(--os-danger) 25%,transparent)}.os-asset-detail{padding:0 18px 15px 57px;font-size:12px;overflow-wrap:anywhere}.os-asset-detail code{font-size:11px}.os-asset-detail p:last-child{color:var(--os-muted);font-size:11px}.os-empty{border:1px dashed var(--os-line);border-radius:12px;padding:32px;text-align:center;font-size:13px;color:var(--os-muted)}.os-caption{color:var(--os-muted);font-size:12px}.os-loading{font-size:12px;color:var(--os-muted)}.os-warning{border:1px solid var(--os-line);background:var(--os-hover);color:var(--os-muted);border-radius:10px;padding:12px 16px;margin:18px 0;font-size:12px;overflow-wrap:anywhere}.os-warning button{background:transparent;border:0;text-decoration:underline;margin-left:12px}.os-warning summary{cursor:pointer}.os-pipeline{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:22px}.os-pipeline>div{padding:13px 10px;border-top:2px solid color-mix(in srgb,var(--os-accent) 33%,transparent);background:color-mix(in srgb,var(--os-accent) 3%,transparent);border-radius:0 0 8px 8px}.os-pipeline span{display:block;font-size:11px;color:var(--os-accent)}.os-pipeline strong{display:block;font-size:12px;margin:8px 0}.os-pipeline small{font-size:10px;line-height:1.6;color:var(--os-muted);display:block}.os-task details{border-bottom:1px solid var(--os-line);padding:14px 0}.os-task summary{cursor:pointer;font-size:12px;font-weight:600}.os-task pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.8 system-ui,sans-serif;color:var(--os-muted);max-height:280px;overflow:auto}.os-footer{padding:12px 26px;border-top:1px solid var(--os-line);display:flex;justify-content:space-between;gap:16px;font-size:10px;color:var(--os-muted);flex:none}\r\n@media(max-width:800px){.os-backdrop{padding:12px}.os-panel{height:calc(100dvh - 24px);border-radius:13px}.os-nav{width:160px;padding:16px 7px}.os-main{padding:22px 18px}.os-stats{grid-template-columns:repeat(2,1fr)}.os-header{padding:17px}.os-header-label{display:none}.os-header>.os-icon:first-of-type{margin-left:auto}.os-pipeline{grid-template-columns:repeat(3,1fr)}}\r\n@media(max-width:580px){.os-layout{flex-direction:column}.os-nav{width:100%;flex-direction:row;overflow:auto;border-right:0;border-bottom:1px solid var(--os-line);padding:8px;flex-shrink:0}.os-nav button{white-space:nowrap;padding:6px 9px}.os-nav-index,.os-nav-count,.os-nav-note{display:none}.os-main{padding:18px}.os-footer{padding:10px 15px}.os-footer>span:first-child{max-width:85%}.os-toolbar input{width:100%}.os-pipeline{grid-template-columns:repeat(2,1fr)}.os-header h1{font-size:17px}.os-header{gap:10px}.os-grid{grid-template-columns:1fr}}\r\n.os-stage-list{list-style:none;padding:0;margin:12px 0;display:flex;flex-direction:column;gap:6px}.os-stage-list>li{min-width:0}.os-stage-row{border:1px solid var(--os-line);border-radius:8px;overflow:hidden;background:transparent;margin:0!important;padding:0!important}.os-stage-row>summary{display:flex;align-items:center;gap:8px;list-style:none;cursor:pointer;padding:10px 11px;font-size:12px}.os-stage-row>summary::-webkit-details-marker{display:none}.os-stage-row>summary:hover{background:var(--os-hover)}.os-stage-row>summary strong{min-width:0;flex:1;font-weight:550}.os-stage-chevron{width:8px;flex:none;display:inline-block;color:var(--os-muted);transition:transform .15s}.os-stage-row[open] .os-stage-chevron{transform:rotate(90deg)}.os-stage-state{flex:none;font-size:11px;color:var(--os-muted)}.os-stage-row[aria-current]{border-color:color-mix(in srgb,var(--os-accent) 40%,var(--os-line));background:color-mix(in srgb,var(--os-accent) 4%,transparent)}.os-stage-row[aria-current]>summary strong{color:var(--os-accent)}.os-stage-evidence{border-top:1px solid var(--os-line);padding:10px 12px;color:var(--os-fg);font-size:12px;overflow-wrap:anywhere}.os-stage-evidence>p{margin:3px 0 9px}.os-stage-evidence>pre,.os-stage-issue pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;font:12px/1.75 var(--dsw-font-family,system-ui,sans-serif);padding:10px;background:var(--os-hover);border-radius:6px;color:var(--os-fg)}.os-stage-issue{padding:9px;margin-top:8px;border-left:2px solid var(--os-danger);background:var(--os-hover);border-radius:5px}.os-stage-issue>strong{font-size:11px;color:var(--os-danger)}.os-stage-issue pre{font-size:11px;background:transparent;padding:4px 0 0}.os-stage-times{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:10px;color:var(--os-muted);margin:10px 0 0}.os-stage-times dd{margin:0}.os-status-popover .os-stage-row[open]{border-top:1px solid var(--os-line);padding-top:0}.os-status-popover .os-stage-row>summary{padding:9px 10px}.os-status-popover .os-stage-row>summary strong{font-size:12px}.os-status-popover .os-stage-evidence>pre{font-size:11px}.os-task .os-stage-list{margin-top:14px}.os-task .os-stage-row{border-bottom:1px solid var(--os-line)}.os-stage-list .os-status-done,.os-stage-list .os-status-active{background:var(--os-accent);border-color:var(--os-accent)}.os-stage-list .os-status-degraded,.os-stage-list .os-status-failed{background:var(--os-danger);border-color:var(--os-danger)}.os-stage-list .os-status-ended,.os-stage-list .os-status-skipped,.os-stage-list .os-status-paused{background:var(--os-muted);border-color:var(--os-muted)}.os-stage-observations{margin-top:10px}.os-owned-count{display:inline-block;margin-left:8px;font-size:10px;font-weight:400;color:var(--os-muted);white-space:nowrap}.os-stats{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}.os-stats button{min-width:0}.os-stats button>span:last-child{overflow-wrap:anywhere}.os-asset-detail{padding-left:18px}.os-asset-detail>.os-assets{margin-left:4px;padding-left:9px}.os-asset-heading strong{display:flex;align-items:center;flex-wrap:wrap}.os-pills button{white-space:nowrap}.os-footer>span:last-child{white-space:nowrap}@media(max-width:580px){.os-stage-state{font-size:10px}.os-stage-row>summary{gap:6px}.os-footer{flex-wrap:wrap}.os-footer>span:first-child{max-width:100%}.os-status-popover .os-stage-evidence{padding:9px}}@media(prefers-reduced-motion:reduce){.os-stage-chevron{transition:none}}\r\n\n.os-phase{border:1px solid var(--os-line);border-radius:11px;padding:11px;min-width:0}.os-phase-current{border-color:var(--os-accent)}.os-phase-header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:9px}.os-phase-header>span{font-size:10px;color:var(--os-accent)}.os-phase-header>strong{font-size:13px}.os-phase-header>small{flex-basis:100%;color:var(--os-muted);font-size:11px}.os-phase-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.os-phase-identity{font-size:11px;color:var(--os-muted);margin:6px 0 10px;overflow-wrap:anywhere}.os-phase-identity>strong{margin-right:8px}.os-phase pre,.os-phase-identity pre,.os-requirement pre,.os-todos pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;font:11px/1.7 system-ui,sans-serif}.os-understanding{border-left:2px solid var(--os-accent);padding-left:9px;margin-bottom:12px}.os-understanding strong{font-size:11px}.os-understanding small{color:var(--os-muted)}.os-requirement,.os-todos>li{border-bottom:1px solid var(--os-line);padding:10px 0}.os-todos{list-style:none;padding:0}.os-todos p{margin:5px 0}.os-todos small{color:var(--os-muted)}.os-export{border:1px solid var(--os-line);background:var(--os-hover);color:inherit;border-radius:6px;padding:7px 10px;cursor:pointer;margin:10px 0}.os-pipeline{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:580px){.os-pipeline{grid-template-columns:1fr}.os-status-trigger{max-width:220px}}\n\n.os-phase-header{cursor:pointer;list-style:none;margin:0}.os-phase-header::-webkit-details-marker{display:none}.os-phase-header:before{content:"\u203A";color:var(--os-muted)}.os-phase[open]>.os-phase-header:before{transform:rotate(90deg)}.os-phase[open]>.os-phase-header{margin-bottom:9px}.os-task .os-phase,.os-status-popover .os-phase{padding:11px;border:1px solid var(--os-line)}.os-phase-current,.os-task .os-phase-current,.os-status-popover .os-phase-current{border-color:var(--os-accent)}.os-status-popover .os-phase[open]{padding-top:11px}.os-phase-header:focus-visible{outline:2px solid var(--os-accent);outline-offset:3px}\n\n.os-phase-assessments{margin-left:auto;font-size:10px;color:var(--os-muted)}.os-assessment-pending{color:var(--os-danger);font-size:11px}.os-assessment-complete{color:var(--os-accent);font-size:11px}.os-todo-assessments article,.os-judge-attempt{padding:9px;border:1px solid var(--os-line);border-radius:7px;margin:8px 0}.os-todo-assessments pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.7 system-ui,sans-serif}.os-todo-assessments small,.os-judge-attempt small{color:var(--os-muted);font-size:10px}.os-status-assessed{background:var(--os-accent);border-color:var(--os-accent)}.os-runtime-version{font-size:10px;color:var(--os-muted);overflow-wrap:anywhere}.os-runtime-version strong{color:var(--os-danger);font-weight:500}.os-status *{box-sizing:border-box}\n.os-verifier-panel{border:1px solid var(--os-line);border-radius:12px;padding:16px;margin:12px 0}.os-verifier-controls{display:flex;flex-wrap:wrap;align-items:end;gap:12px}.os-verifier-controls label{display:flex;flex-direction:column;gap:6px}.os-verifier-controls select,.os-verifier-controls button{font:inherit;color:inherit;background:var(--os-bg);border:1px solid var(--os-line);padding:7px;border-radius:6px}.os-verifier-evidence{border-top:1px solid var(--os-line);padding-top:10px;margin-top:10px}.os-execution-insights article{margin:10px 0}.os-delivery-conclusion{padding:12px;border-left:3px solid var(--os-accent)}\r\n\n/* Slot-owned styles, with explicit control defaults resistant to host resets. */\n.os-surface{display:contents;font-family:var(--dsw-font-family,system-ui,sans-serif)}\n.os-surface .os-entry,.os-surface .os-status-trigger{appearance:none;box-sizing:border-box;border:0;background:transparent;color:inherit;font:12px/1.5 var(--dsw-font-family,system-ui,sans-serif);cursor:pointer;box-shadow:none;text-transform:none;letter-spacing:normal}\n.os-surface .os-entry{display:flex;align-items:center;gap:8px;min-width:0;white-space:nowrap;overflow:hidden;padding:8px 10px;border-radius:6px}\n.os-entry svg{flex:0 0 18px}.os-entry span{overflow:hidden;text-overflow:ellipsis;min-width:0}\n.os-surface .os-status{flex:0 1 200px;min-width:0;max-width:200px}\n.os-surface .os-status-trigger{display:flex;gap:5px;align-items:center;min-width:0;max-width:200px;height:28px;padding:3px 6px;border-radius:6px;white-space:nowrap}\n.os-status-label{min-width:0;overflow:hidden;text-overflow:ellipsis}.os-status-position,.os-status-light,.os-status-dots,.os-status-gap{flex-shrink:0}\n.os-surface .os-status-popover{position:fixed;top:60px;right:12px;z-index:10000;width:min(420px,calc(100vw - 24px));max-height:calc(100vh - 84px);overflow:auto;overscroll-behavior:contain}\n@media(max-width:800px){.os-surface .os-status,.os-surface .os-status-trigger{max-width:150px}.os-status-dots{display:none}}\n@media(max-width:480px){.os-surface .os-status,.os-surface .os-status-trigger{max-width:112px}}\n.os-surface .os-entry{width:auto;max-width:100%;flex:0 1 auto}\r\n'), children);
}

// src/client/status.tsx
var import_react4 = __toESM(require("react"), 1);

// src/client/stages.tsx
var import_react3 = __toESM(require("react"), 1);

// src/client/verifier.tsx
var import_react2 = __toESM(require("react"), 1);
function JudgeEvidence({ attempt, t }) {
  if (!attempt) return /* @__PURE__ */ import_react2.default.createElement("p", null, t("verifier.notAttempted"));
  return /* @__PURE__ */ import_react2.default.createElement("div", { className: "os-verifier-evidence" }, /* @__PURE__ */ import_react2.default.createElement("strong", null, attempt.tool, " \xB7 ", t(`workflow.attempt.${attempt.outcome}`)), /* @__PURE__ */ import_react2.default.createElement("p", null, attempt.routeReason), /* @__PURE__ */ import_react2.default.createElement("p", null, t("verifier.actualModel"), "\uFF1A", attempt.provider && attempt.model ? `${attempt.provider} / ${attempt.model}` : t("verifier.modelUnconfirmed")), /* @__PURE__ */ import_react2.default.createElement("p", null, t(attempt.toolInvoked ? "workflow.toolInvoked" : "workflow.toolNotInvoked")), attempt.error && /* @__PURE__ */ import_react2.default.createElement("pre", null, attempt.error), attempt.evaluation !== void 0 && /* @__PURE__ */ import_react2.default.createElement("details", null, /* @__PURE__ */ import_react2.default.createElement("summary", null, t("verifier.result")), /* @__PURE__ */ import_react2.default.createElement("pre", null, JSON.stringify(attempt.evaluation, null, 2))));
}
function VerifierPanel({ task, t }) {
  const [route, setRoute] = (0, import_react2.useState)(task?.verifierSettings?.planningRoute ?? "auto"), [repeats, setRepeats] = (0, import_react2.useState)(task?.verifierSettings?.repeats ?? 1), [message, setMessage] = (0, import_react2.useState)(""), [saving, setSaving] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    setRoute(task?.verifierSettings?.planningRoute ?? "auto");
    setRepeats(task?.verifierSettings?.repeats ?? 1);
    setMessage("");
  }, [task?.sessionId, task?.verifierSettings?.planningRoute, task?.verifierSettings?.repeats]);
  const save = async () => {
    if (!task) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(VERIFIER_ROUTE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: task.sessionId, settings: { planningRoute: route, repeats } }), signal: AbortSignal.timeout(1e4) });
      const result = await response.json();
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || t("fetchFailed"));
      setMessage(t("verifier.saved"));
    } catch (error) {
      setMessage(String(error));
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ import_react2.default.createElement("article", { className: "os-verifier-panel" }, /* @__PURE__ */ import_react2.default.createElement("h3", null, t("verifier.title")), /* @__PURE__ */ import_react2.default.createElement("p", null, t("verifier.boundary")), task ? /* @__PURE__ */ import_react2.default.createElement(import_react2.default.Fragment, null, /* @__PURE__ */ import_react2.default.createElement("div", { className: "os-verifier-controls" }, /* @__PURE__ */ import_react2.default.createElement("label", null, t("verifier.planningRoute"), /* @__PURE__ */ import_react2.default.createElement("select", { "aria-label": t("verifier.planningRoute"), value: route, onChange: (e) => setRoute(e.target.value) }, ["auto", "compare", "select", "track"].map((id) => /* @__PURE__ */ import_react2.default.createElement("option", { key: id, value: id }, t(`verifier.route.${id}`))))), /* @__PURE__ */ import_react2.default.createElement("label", null, t("verifier.repeats"), /* @__PURE__ */ import_react2.default.createElement("select", { "aria-label": t("verifier.repeats"), value: repeats, onChange: (e) => setRepeats(Number(e.target.value)) }, /* @__PURE__ */ import_react2.default.createElement("option", { value: 1 }, "1"), /* @__PURE__ */ import_react2.default.createElement("option", { value: 2 }, "2"))), /* @__PURE__ */ import_react2.default.createElement("button", { onClick: () => void save(), disabled: saving || task.judgeAttempts?.some((a) => a.outcome === "running") }, t("verifier.save"))), message && /* @__PURE__ */ import_react2.default.createElement("p", { role: "status" }, message)) : /* @__PURE__ */ import_react2.default.createElement("p", null, t("selectScopeForReport")), /* @__PURE__ */ import_react2.default.createElement("p", null, t("verifier.routeHelp")), /* @__PURE__ */ import_react2.default.createElement("p", null, t("verifier.acceptanceRoute"), "\uFF1A", /* @__PURE__ */ import_react2.default.createElement("code", null, "verifier_current_session")), /* @__PURE__ */ import_react2.default.createElement(JudgeEvidence, { attempt: task?.planningAttempt, t }), /* @__PURE__ */ import_react2.default.createElement(JudgeEvidence, { attempt: task?.acceptanceAttempt, t }));
}

// src/client/stages.tsx
function pretty(value) {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? JSON.stringify(parsed, null, 2) : value;
  } catch {
    return value;
  }
}
function evidence(task, id) {
  switch (id) {
    case "input":
      return task.prompt;
    case "triage":
      return task.triage;
    case "compare":
      return task.comparison;
    case "verify":
      return task.review;
    case "assemble":
      return task.conclusion;
    case "trace":
      return task.delivery?.requirements ?? "";
    case "construction":
      return task.delivery?.constructionRequests ?? "";
    case "accept":
      return task.acceptance ?? "";
    default:
      return "";
  }
}
function TaskStages({ task, t }) {
  const [expanded, setExpanded] = (0, import_react3.useState)({});
  const currentPhase = phaseOf(task.progress.current);
  const assessments = assessmentChecklist(task);
  const [phaseExpanded, setPhaseExpanded] = (0, import_react3.useState)({ [currentPhase]: true });
  (0, import_react3.useEffect)(() => {
    setPhaseExpanded((previous) => ({ ...previous, [currentPhase]: true }));
  }, [currentPhase]);
  const download = () => {
    const blob = new Blob([JSON.stringify(deliveryBundle(task), null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url;
    link.download = "orchestrator-suite-3.0.3-delivery.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  };
  return /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement("p", { className: "os-caption" }, t("workflow.advisory"), " \xB7 ", t(`workflow.${task.guidance ?? "light"}`), task.triggerReason && /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement("br", null), task.triggerReason)), /* @__PURE__ */ import_react3.default.createElement("ol", { className: "os-stage-list", "aria-label": t("progress.stages") }, PHASES.map((phase, index) => /* @__PURE__ */ import_react3.default.createElement("li", { key: phase }, /* @__PURE__ */ import_react3.default.createElement("details", { className: currentPhase === phase ? "os-phase os-phase-current" : "os-phase", "data-phase": phase, open: !!phaseExpanded[phase], onToggle: (event) => {
    const open = event.currentTarget.open;
    setPhaseExpanded((previous) => previous[phase] === open ? previous : { ...previous, [phase]: open });
  } }, /* @__PURE__ */ import_react3.default.createElement("summary", { className: "os-phase-header" }, /* @__PURE__ */ import_react3.default.createElement("span", null, index + 1, "/3"), /* @__PURE__ */ import_react3.default.createElement("strong", null, t(`workflow.phase.${phase}`)), /* @__PURE__ */ import_react3.default.createElement("span", { className: "os-phase-assessments" }, assessments.filter((a) => PHASE_STAGES[phase].includes(a.stage) && a.assessed).length, "/", PHASE_STAGES[phase].length, " ", t("workflow.assessmentCount")), /* @__PURE__ */ import_react3.default.createElement("small", null, t(`workflow.phase.${phase}.description`))), /* @__PURE__ */ import_react3.default.createElement("div", { className: "os-phase-identity" }, /* @__PURE__ */ import_react3.default.createElement("strong", null, t("workflow.identity")), task.identities?.filter((r) => r.phase === phase).length ? /* @__PURE__ */ import_react3.default.createElement("details", null, /* @__PURE__ */ import_react3.default.createElement("summary", null, task.identities.filter((r) => r.phase === phase).at(-1).identity, " \xB7 ", t(`workflow.identity.${task.identities.filter((r) => r.phase === phase).at(-1).mode}`)), task.identities.filter((r) => r.phase === phase).map((r, i) => /* @__PURE__ */ import_react3.default.createElement("div", { key: i }, /* @__PURE__ */ import_react3.default.createElement("p", null, t(`stage.${r.stage}`), " \xB7 ", r.identity, " \xB7 ", r.scale), /* @__PURE__ */ import_react3.default.createElement("pre", null, r.reason, "\n", r.evidence)))) : /* @__PURE__ */ import_react3.default.createElement("span", null, t("workflow.identityPending"))), /* @__PURE__ */ import_react3.default.createElement("ol", { className: "os-phase-steps" }, PHASE_STAGES[phase].map((id) => {
    const step = task.progress.steps.find((step2) => step2.id === id);
    if (!step) return null;
    const value = evidence(task, id);
    const assessed = assessments.find((a) => a.stage === id).assessed;
    const attempt = id === "verify" ? task.planningAttempt : id === "accept" ? task.acceptanceAttempt : void 0;
    const understanding = task.reports?.filter((r) => r.stage === id && (!["verify", "accept"].includes(id) || !!attempt?.id && r.attemptId === attempt.id)).at(-1);
    const latestTodo = task.todoAssessments?.at(-1);
    const assessmentLabel = id === "todo" ? !assessed ? t("workflow.todoUnassessed") : t(latestTodo?.decision === "updated" ? "workflow.todoUpdated" : "workflow.todoUnchanged") : attempt ? t(`workflow.attempt.${attempt.outcome}`) : assessed ? t("workflow.assessed") : t("workflow.unassessed");
    const issue = step.note || ((step.status === "degraded" || step.status === "failed") && task.progress.steps.filter((s) => ["degraded", "failed"].includes(s.status)).length === 1 ? task.progress.error : void 0);
    return /* @__PURE__ */ import_react3.default.createElement("li", { key: id }, /* @__PURE__ */ import_react3.default.createElement("details", { className: `os-stage-row os-stage-${step.status}`, "data-stage": id, open: !!expanded[id], onToggle: (event) => {
      const open = event.currentTarget.open;
      setExpanded((previous) => previous[id] === open ? previous : { ...previous, [id]: open });
    }, "aria-current": id === task.progress.current ? "step" : void 0 }, /* @__PURE__ */ import_react3.default.createElement("summary", null, /* @__PURE__ */ import_react3.default.createElement("span", { className: "os-stage-chevron", "aria-hidden": "true" }, "\u203A"), /* @__PURE__ */ import_react3.default.createElement("span", { className: `os-status-light os-status-${step.status}`, "aria-hidden": "true" }), /* @__PURE__ */ import_react3.default.createElement("strong", null, t(`stage.${id}`)), /* @__PURE__ */ import_react3.default.createElement("span", { className: "os-stage-state" }, id === "todo" || attempt ? assessmentLabel : t(`progress.status.${step.status}`))), /* @__PURE__ */ import_react3.default.createElement("div", { className: "os-stage-evidence" }, /* @__PURE__ */ import_react3.default.createElement("p", { className: assessed ? "os-assessment-complete" : "os-assessment-pending" }, assessmentLabel, !assessed && /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, " \xB7 ", t("workflow.assessmentMissing"))), !(id === "accept" && task.deliveryConclusion) && /* @__PURE__ */ import_react3.default.createElement("div", { className: "os-understanding" }, /* @__PURE__ */ import_react3.default.createElement("strong", null, t(!assessed && understanding ? "workflow.partialUnderstanding" : "workflow.understanding")), understanding ? /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement("pre", null, understanding.summary), /* @__PURE__ */ import_react3.default.createElement("small", null, understanding.source)) : /* @__PURE__ */ import_react3.default.createElement("p", { className: "os-caption" }, t("workflow.understandingPending"))), attempt && /* @__PURE__ */ import_react3.default.createElement(JudgeEvidence, { attempt, t }), id === "assemble" && task.taskUnderstanding && /* @__PURE__ */ import_react3.default.createElement("article", null, /* @__PURE__ */ import_react3.default.createElement("strong", null, t("workflow.taskUnderstanding")), /* @__PURE__ */ import_react3.default.createElement("pre", null, task.taskUnderstanding)), (id === "todo" || id === "execute") && !!task.executionInsights?.length && /* @__PURE__ */ import_react3.default.createElement("details", { className: "os-execution-insights" }, /* @__PURE__ */ import_react3.default.createElement("summary", null, t("workflow.executionInsights"), " (", task.executionInsights.length, ")"), task.executionInsights.map((i) => /* @__PURE__ */ import_react3.default.createElement("article", { key: i.id }, /* @__PURE__ */ import_react3.default.createElement("strong", null, i.id, " \xB7 ", i.todoIds.join(" \xB7 ")), /* @__PURE__ */ import_react3.default.createElement("pre", null, i.understanding, "\n", i.evidence, "\n", i.impact)))), id === "accept" && task.deliveryConclusion && /* @__PURE__ */ import_react3.default.createElement("article", { className: "os-delivery-conclusion" }, /* @__PURE__ */ import_react3.default.createElement("strong", null, t("workflow.deliveryConclusion")), /* @__PURE__ */ import_react3.default.createElement("pre", null, task.deliveryConclusion.completed, "\n", task.deliveryConclusion.implemented, "\n", task.deliveryConclusion.overallEffect, "\n", task.deliveryConclusion.limitations)), id === "construction" && task.delivery?.construction && /* @__PURE__ */ import_react3.default.createElement("dl", null, Object.entries(task.delivery.construction).map(([key, value2]) => /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, { key }, /* @__PURE__ */ import_react3.default.createElement("dt", null, t(`workflow.construction.${key}`)), /* @__PURE__ */ import_react3.default.createElement("dd", null, /* @__PURE__ */ import_react3.default.createElement("pre", null, value2))))), id === "supplement" ? /* @__PURE__ */ import_react3.default.createElement("div", null, task.supplements?.length ? task.supplements.map((r) => /* @__PURE__ */ import_react3.default.createElement("article", { className: "os-requirement", key: r.id }, /* @__PURE__ */ import_react3.default.createElement("strong", null, r.id, " \xB7 ", t(`workflow.requirement.${r.status}`), r.duplicateOf && ` \u2192 ${r.duplicateOf}`), /* @__PURE__ */ import_react3.default.createElement("pre", null, r.prompt), /* @__PURE__ */ import_react3.default.createElement("p", null, r.understanding || t("workflow.understandingPending")), /* @__PURE__ */ import_react3.default.createElement("p", null, r.impact || t("workflow.impactPending")), /* @__PURE__ */ import_react3.default.createElement("small", null, r.todoIds.join(" \xB7 ") || t("workflow.noTodoChange")))) : /* @__PURE__ */ import_react3.default.createElement("p", null, t("workflow.noSupplements"))) : id === "todo" ? /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, !task.todoAssessments?.length ? /* @__PURE__ */ import_react3.default.createElement("p", { className: "os-assessment-pending" }, t("workflow.todoUnassessedReason")) : /* @__PURE__ */ import_react3.default.createElement("div", { className: "os-todo-assessments" }, /* @__PURE__ */ import_react3.default.createElement("strong", null, t("workflow.todoAssessmentHistory")), task.todoAssessments.map((a, i) => /* @__PURE__ */ import_react3.default.createElement("article", { key: i }, /* @__PURE__ */ import_react3.default.createElement("strong", null, t(`workflow.todoDecision.${a.decision}`)), /* @__PURE__ */ import_react3.default.createElement("pre", null, a.understanding, "\n", a.reason), /* @__PURE__ */ import_react3.default.createElement("small", null, a.requirementIds.join(" \xB7 "), a.todoIds.length > 0 && ` \u2192 ${a.todoIds.join(" \xB7 ")}`, a.planVersion && ` \xB7 ${t("workflow.planVersion")} ${a.planVersion}`)))), task.todos?.length ? /* @__PURE__ */ import_react3.default.createElement("ul", { className: "os-todos" }, task.todos.map((todo) => /* @__PURE__ */ import_react3.default.createElement("li", { key: todo.id }, /* @__PURE__ */ import_react3.default.createElement("strong", null, todo.id, " \xB7 ", t(`workflow.todo.${todo.status}`)), /* @__PURE__ */ import_react3.default.createElement("p", null, todo.text), /* @__PURE__ */ import_react3.default.createElement("small", null, todo.requirementIds.join(" \xB7 "), " \xB7 ", todo.origin && t("workflow.origin." + todo.origin), " \xB7 ", todo.reason, todo.insightIds?.length ? " \xB7 " + todo.insightIds.join(" \xB7 ") : ""), todo.evidence && /* @__PURE__ */ import_react3.default.createElement("pre", null, todo.evidence)))) : /* @__PURE__ */ import_react3.default.createElement("p", null, t("workflow.noTodos")), !!task.todoChanges?.length && /* @__PURE__ */ import_react3.default.createElement("details", null, /* @__PURE__ */ import_react3.default.createElement("summary", null, t("workflow.todoHistory"), " (", task.todoChanges.length, ")"), /* @__PURE__ */ import_react3.default.createElement("pre", null, JSON.stringify(task.todoChanges, null, 2)))) : id === "execute" ? /* @__PURE__ */ import_react3.default.createElement("p", null, step.startedAt ? t("progress.executionObserved") : t("progress.executionPending")) : value ? /* @__PURE__ */ import_react3.default.createElement("pre", null, id === "input" ? value : pretty(value)) : /* @__PURE__ */ import_react3.default.createElement("p", { className: "os-caption" }, ["degraded", "failed", "paused"].includes(step.status) ? t("progress.noResult") : step.status === "skipped" ? t("progress.notCalled") : t("pending")), id === "assemble" && !!task.planVersions?.length && /* @__PURE__ */ import_react3.default.createElement("details", null, /* @__PURE__ */ import_react3.default.createElement("summary", null, t("workflow.planHistory"), " (", task.planVersions.length, ")"), /* @__PURE__ */ import_react3.default.createElement("pre", null, JSON.stringify(task.planVersions, null, 2))), id === "trace" && /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement("p", null, task.delivery?.summary), /* @__PURE__ */ import_react3.default.createElement("details", { className: "os-prompt-export" }, /* @__PURE__ */ import_react3.default.createElement("summary", null, t("workflow.allPrompts")), /* @__PURE__ */ import_react3.default.createElement("strong", null, t("task.prompt")), /* @__PURE__ */ import_react3.default.createElement("pre", null, task.prompt), task.supplements?.map((r) => /* @__PURE__ */ import_react3.default.createElement("div", { key: r.id }, /* @__PURE__ */ import_react3.default.createElement("strong", null, r.id, " \xB7 ", t("turn"), " ", r.turn), /* @__PURE__ */ import_react3.default.createElement("pre", null, r.prompt)))), /* @__PURE__ */ import_react3.default.createElement("button", { className: "os-export", onClick: download }, t("workflow.export")), /* @__PURE__ */ import_react3.default.createElement("ul", null, deliveryBundle(task).gaps.map((gap) => /* @__PURE__ */ import_react3.default.createElement("li", { key: gap }, gap)))), issue && /* @__PURE__ */ import_react3.default.createElement("div", { className: "os-stage-issue" }, /* @__PURE__ */ import_react3.default.createElement("strong", null, t("progress.reason")), /* @__PURE__ */ import_react3.default.createElement("pre", null, issue)), (step.startedAt || step.finishedAt) && /* @__PURE__ */ import_react3.default.createElement("dl", { className: "os-stage-times" }, step.startedAt && /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement("dt", null, t("progress.started")), /* @__PURE__ */ import_react3.default.createElement("dd", null, /* @__PURE__ */ import_react3.default.createElement("time", { dateTime: step.startedAt }, new Date(step.startedAt).toLocaleString()))), step.finishedAt && /* @__PURE__ */ import_react3.default.createElement(import_react3.default.Fragment, null, /* @__PURE__ */ import_react3.default.createElement("dt", null, t("progress.finished")), /* @__PURE__ */ import_react3.default.createElement("dd", null, /* @__PURE__ */ import_react3.default.createElement("time", { dateTime: step.finishedAt }, new Date(step.finishedAt).toLocaleString())))), id === "compare" && !!task.observations?.length && /* @__PURE__ */ import_react3.default.createElement("details", { className: "os-stage-observations" }, /* @__PURE__ */ import_react3.default.createElement("summary", null, t("task.observations")), /* @__PURE__ */ import_react3.default.createElement("pre", null, JSON.stringify(task.observations, null, 2))), id === "verify" && /* @__PURE__ */ import_react3.default.createElement("p", { className: "os-caption" }, t("proposalEvidence")), id === "accept" && /* @__PURE__ */ import_react3.default.createElement("p", { className: "os-caption" }, t("acceptanceEvidence")))));
  })))))));
}

// src/client/status.tsx
function isResponse(value, sessionId) {
  if (!value || typeof value !== "object") return false;
  const body = value;
  return body.ok === true && (body.version === void 0 || typeof body.version === "string") && body.sessionId === sessionId && typeof body.preset === "string" && Number.isSafeInteger(body.pollMs) && body.pollMs >= 500 && body.pollMs <= 3e4 && (body.task === null || !!body.task && body.task.sessionId === sessionId && typeof body.task.prompt === "string" && STAGES.includes(body.task.progress?.current) && Array.isArray(body.task.progress?.steps) && new Set(body.task.progress.steps.map((s) => s.id)).size === STAGES.length && body.task.progress.steps.length === STAGES.length && body.task.progress.steps.every((s) => STAGES.includes(s.id) && ["pending", "active", "done", "assessed", "failed", "paused", "ended", "degraded", "skipped"].includes(s.status)));
}
function ProgressStatus({ sessionId, t }) {
  const [data, setData] = (0, import_react4.useState)(null), [error, setError] = (0, import_react4.useState)(""), [opened2, setOpened] = (0, import_react4.useState)(false);
  const root = (0, import_react4.useRef)(null), trigger = (0, import_react4.useRef)(null);
  (0, import_react4.useEffect)(() => {
    setData(null);
    setError("");
    setOpened(false);
    if (!sessionId) return;
    let disposed = false, busy = false, delay = 1500, timer, controller;
    async function poll() {
      if (disposed || busy || document.hidden) return;
      busy = true;
      controller = new AbortController();
      try {
        const response = await fetch(PROGRESS_ROUTE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15e3)]) });
        const body = await response.json();
        if (!response.ok || !isResponse(body, sessionId)) throw new Error(t("progress.fetchFailed"));
        if (!disposed && !controller.signal.aborted) {
          delay = body.pollMs;
          setData(body);
          setError("");
        }
      } catch (reason) {
        if (!disposed && !controller.signal.aborted) setError(String(reason));
      } finally {
        busy = false;
        if (!disposed && !document.hidden) timer = setTimeout(() => void poll(), delay);
      }
    }
    const visibility = () => {
      clearTimeout(timer);
      if (document.hidden) controller?.abort();
      else void poll();
    };
    document.addEventListener("visibilitychange", visibility);
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [sessionId, t]);
  (0, import_react4.useEffect)(() => {
    if (!opened2) return;
    const click = (event) => {
      if (!root.current?.contains(event.target)) setOpened(false);
    };
    const key = (event) => {
      if (event.key === "Escape") {
        setOpened(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", click);
      document.removeEventListener("keydown", key);
    };
  }, [opened2]);
  const dispatch = data?.preset === "dispatch-orchestrator";
  const task = data?.sessionId === sessionId ? data.task : null, progress = task?.progress;
  const status = progress?.steps.find((s) => s.id === progress.current)?.status ?? "pending";
  const gaps = progress?.steps.filter((s) => s.status === "degraded" || s.status === "failed").length ?? 0;
  const assessments = task ? assessmentChecklist(task) : [];
  const evidenceCount = assessments.filter((a) => a.assessed).length;
  const label = !dispatch && data ? error ? t("progress.staleShort") : task?.layerSummary ? t("layers.completed") : t("layers.pending") : error ? t("progress.staleShort") : progress ? `${t(`workflow.phase.${phaseOf(progress.current)}`)} \xB7 ${t(`stage.${progress.current}`)} \xB7 ${t(`progress.status.${status}`)}` : t("progress.title");
  return /* @__PURE__ */ import_react4.default.createElement("div", { className: "os-status os-themed", ref: root }, /* @__PURE__ */ import_react4.default.createElement("button", { ref: trigger, className: "os-status-trigger", "aria-label": label, title: label, "aria-expanded": opened2, "aria-haspopup": "dialog", onClick: () => setOpened((value) => !value) }, /* @__PURE__ */ import_react4.default.createElement("span", { className: `os-status-light os-status-${error ? "degraded" : status}`, "aria-hidden": "true" }), /* @__PURE__ */ import_react4.default.createElement("span", { className: "os-status-label" }, dispatch && progress && !error ? `${t(`workflow.phase.${phaseOf(progress.current)}`)} \xB7 ${t(`stage.${progress.current}`)}` : label), dispatch && progress && /* @__PURE__ */ import_react4.default.createElement("span", { className: "os-status-position", title: t("progress.stagePosition"), "aria-label": t("progress.stagePosition") }, PHASES.indexOf(phaseOf(progress.current)) + 1, "/", PHASES.length), /* @__PURE__ */ import_react4.default.createElement("span", { className: "os-status-dots", "aria-hidden": "true" }, dispatch && progress && PHASES.map((phase) => /* @__PURE__ */ import_react4.default.createElement("i", { key: phase, className: `os-status-${phase === phaseOf(progress.current) ? status : PHASE_STAGES[phase].every((id) => assessments.some((a) => a.stage === id && a.assessed)) ? "done" : "pending"}` }))), dispatch && gaps > 0 && /* @__PURE__ */ import_react4.default.createElement("span", { className: "os-status-gap", title: t("progress.gaps") }, "! ", gaps)), opened2 && /* @__PURE__ */ import_react4.default.createElement("section", { className: "os-status-popover", role: "dialog", "aria-label": t("progress.title") }, /* @__PURE__ */ import_react4.default.createElement("header", null, /* @__PURE__ */ import_react4.default.createElement("strong", null, t("progress.title")), /* @__PURE__ */ import_react4.default.createElement("button", { "aria-label": t("progress.close"), onClick: () => {
    setOpened(false);
    trigger.current?.focus();
  } }, "\xD7")), error && /* @__PURE__ */ import_react4.default.createElement("div", { className: "os-warning", role: "alert" }, error, /* @__PURE__ */ import_react4.default.createElement("p", null, t("progress.stale"))), !task ? /* @__PURE__ */ import_react4.default.createElement("p", null, t("progress.noTask")) : /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement("p", { className: "os-runtime-version" }, t("workflow.runtimeVersion"), " ", data?.version ?? t("workflow.runtimeUnknown"), data?.version !== VERSION && /* @__PURE__ */ import_react4.default.createElement("strong", null, " \xB7 ", t("workflow.runtimeMismatch"))), dispatch ? /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement("p", { className: "os-caption" }, data?.preset, " \xB7 ", t("turn"), " ", task.turn, " \xB7 ", t("progress.evidenceCount"), " ", evidenceCount, "/", STAGES.length), /* @__PURE__ */ import_react4.default.createElement("div", { className: "os-status-summary", role: "status" }, /* @__PURE__ */ import_react4.default.createElement("strong", null, t(`stage.${progress.current}`)), /* @__PURE__ */ import_react4.default.createElement("span", null, t(`progress.status.${status}`)), gaps > 0 && /* @__PURE__ */ import_react4.default.createElement("p", null, t("progress.gaps"), " \xB7 ", gaps, " \xB7 ", t("progress.canContinue"))), /* @__PURE__ */ import_react4.default.createElement(TaskStages, { key: task.taskId ?? `${task.sessionId}:${task.prompt}`, task, t }), /* @__PURE__ */ import_react4.default.createElement("p", { className: "os-caption" }, t("progress.evidenceHint")), /* @__PURE__ */ import_react4.default.createElement("details", { className: "os-status-info" }, /* @__PURE__ */ import_react4.default.createElement("summary", null, t("progress.readingGuide")), /* @__PURE__ */ import_react4.default.createElement("p", { className: "os-caption" }, t("judgeBody")))) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "os-layer-result" }, /* @__PURE__ */ import_react4.default.createElement("strong", null, task.layerSummary ? t("layers.completed") : t("layers.pending")), /* @__PURE__ */ import_react4.default.createElement("p", null, task.layerSummary || t("layers.hint"))), dispatch && progress?.updatedAt && /* @__PURE__ */ import_react4.default.createElement("p", { className: "os-caption" }, t("progress.autoRefresh"), " \xB7 ", /* @__PURE__ */ import_react4.default.createElement("time", { dateTime: progress.updatedAt }, new Date(progress.updatedAt).toLocaleTimeString())))));
}

// src/client/index.tsx
var opened = false;
var subscribers = /* @__PURE__ */ new Set();
var setOpen = (value) => {
  opened = value;
  subscribers.forEach((fn) => fn());
};
var subscribe = (fn) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};
var getOpen = () => opened;
var name = "orchestrator-suite";
var inject = ["slots", "locale"];
var tabs = ["overview", "tools", "memory", "identity", "organization", "verification", "dispatch"];
function Glyph({ kind = "board" }) {
  return /* @__PURE__ */ import_react5.default.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.65", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, kind === "close" ? /* @__PURE__ */ import_react5.default.createElement("path", { d: "m6 6 12 12M6 18 18 6" }) : kind === "refresh" ? /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("path", { d: "M20 11a8 8 0 1 0-2 6M20 4v7h-7" })) : /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("rect", { x: "3", y: "4", width: "18", height: "16", rx: "3" }), /* @__PURE__ */ import_react5.default.createElement("path", { d: "M9 4v16M15 4v16M5.5 8H7M11 8h2M17 8h2" })));
}
function Assets({ rows, query, t }) {
  const matches = (row) => `${row.name} ${row.description} ${row.path ?? ""}`.toLowerCase().includes(query.toLowerCase()) || !!row.children?.some(matches);
  const selected = rows.filter(matches);
  return /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-assets" }, selected.length ? selected.map((row) => /* @__PURE__ */ import_react5.default.createElement("details", { className: "os-asset", key: `${row.kind}:${row.id}` }, /* @__PURE__ */ import_react5.default.createElement("summary", null, /* @__PURE__ */ import_react5.default.createElement("span", { className: "os-asset-mark" }, row.kind === "skill" ? "S" : row.kind === "mcp" ? "M" : row.kind === "memory-file" ? "R" : "P"), /* @__PURE__ */ import_react5.default.createElement("span", { className: "os-asset-heading" }, /* @__PURE__ */ import_react5.default.createElement("strong", null, row.name, !!row.children?.length && /* @__PURE__ */ import_react5.default.createElement("small", { className: "os-owned-count" }, t("ownedAssets"), " ", row.children.length)), /* @__PURE__ */ import_react5.default.createElement("span", null, row.description || t("noDescription"))), /* @__PURE__ */ import_react5.default.createElement("span", { className: `os-badge os-${row.status}` }, t(`status.${row.status}`))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-asset-detail" }, /* @__PURE__ */ import_react5.default.createElement("p", null, row.description || t("noDescription")), row.path && /* @__PURE__ */ import_react5.default.createElement("code", null, row.path), row.toolNames?.map((name2) => /* @__PURE__ */ import_react5.default.createElement("code", { className: "os-tool-name", key: name2 }, name2)), row.evidence && /* @__PURE__ */ import_react5.default.createElement("p", { className: "os-evidence" }, row.evidence), (row.kind.startsWith("memory-") && row.kind !== "memory-file" || row.protocol) && /* @__PURE__ */ import_react5.default.createElement("dl", { className: "os-connection" }, /* @__PURE__ */ import_react5.default.createElement("dt", null, t("protocol")), /* @__PURE__ */ import_react5.default.createElement("dd", null, row.protocol ?? t("unknown")), /* @__PURE__ */ import_react5.default.createElement("dt", null, t("port")), /* @__PURE__ */ import_react5.default.createElement("dd", null, row.protocol === "stdio" ? t("noTcpPort") : row.port ?? t("unknown")), row.endpoint && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("dt", null, t("endpoint")), /* @__PURE__ */ import_react5.default.createElement("dd", null, /* @__PURE__ */ import_react5.default.createElement("code", null, row.endpoint)))), row.ownership && /* @__PURE__ */ import_react5.default.createElement("p", null, row.ownership), /* @__PURE__ */ import_react5.default.createElement("p", null, t("catalogHint")), !!row.children?.length && /* @__PURE__ */ import_react5.default.createElement(Assets, { rows: row.children, query, t })))) : /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-empty" }, t("empty")));
}
function Panel({ t }) {
  const [tab, setTab] = (0, import_react5.useState)("overview"), [toolTab, setToolTab] = (0, import_react5.useState)("plugins");
  const [memoryTab, setMemoryTab] = (0, import_react5.useState)("memory-system");
  const [options, setOptions] = (0, import_react5.useState)({ sessions: [], tasks: [] });
  const [data, setData] = (0, import_react5.useState)(null), [error, setError] = (0, import_react5.useState)(""), [loading, setLoading] = (0, import_react5.useState)(true), [attempt, setAttempt] = (0, import_react5.useState)(0), [query, setQuery] = (0, import_react5.useState)("");
  const root = (0, import_react5.useRef)(null);
  const [scope, setScope] = (0, import_react5.useState)("");
  const changeScope = (value) => {
    setScope(value);
    setData(null);
  };
  (0, import_react5.useEffect)(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    let timer;
    const refreshLater = () => {
      timer = setTimeout(() => {
        if (document.hidden) refreshLater();
        else setAttempt((n) => n + 1);
      }, 1e4);
    };
    void fetch(ROUTE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(scope ? { sessionId: scope } : {}), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15e3)]) }).then(async (response) => {
      const value = await response.json();
      if (!response.ok || !value || typeof value !== "object" || !("catalog" in value) || !("tasks" in value) || !("ok" in value) || value.ok !== true) throw new Error(t("fetchFailed"));
      const parsed = value;
      if (!parsed.catalog || !["skills", "plugins", "mcp", "memory", "tools", "warnings", "memoryRoots"].every((key) => Array.isArray(parsed.catalog[key])) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.sessions)) throw new Error(t("fetchFailed"));
      if (!controller.signal.aborted) {
        setData(parsed);
        setOptions({ sessions: parsed.sessions, tasks: parsed.tasks });
      }
    }).catch((err) => {
      if (!controller.signal.aborted) setError(String(err));
    }).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
        refreshLater();
      }
    });
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [attempt, t, scope]);
  (0, import_react5.useEffect)(() => {
    const previous = document.activeElement;
    root.current?.focus();
    return () => previous?.focus();
  }, []);
  const changeTab = (next) => {
    setTab(next);
    setQuery("");
  };
  const catalog = data?.catalog, task = data?.tasks.find((row) => row.sessionId === scope);
  const standalone = (key) => (catalog?.[key] ?? []).filter((row) => !row.ownerId || !catalog?.plugins.some((plugin) => plugin.id === row.ownerId));
  const toolRows = toolTab === "plugins" ? catalog?.plugins ?? [] : standalone(toolTab);
  const counts = catalog ? [catalog.skills.length + catalog.plugins.length + catalog.mcp.length + (catalog.environments?.length ?? 0), catalog.memory.length, catalog.identity?.length ?? 0, catalog.organization?.length ?? 0, catalog.verification?.length ?? 0] : [0, 0, 0, 0, 0];
  return /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-backdrop", onMouseDown: (e) => {
    if (e.target === e.currentTarget) setOpen(false);
  } }, /* @__PURE__ */ import_react5.default.createElement("div", { ref: root, className: "os-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "os-title", tabIndex: -1, onKeyDown: (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
    if (e.key === "Tab") {
      const nodes = [...root.current?.querySelectorAll('button:not([disabled]),input,select,summary,[tabindex="0"]') ?? []].filter((node) => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === root.current)) {
        e.preventDefault();
        first?.focus();
      }
    }
  } }, /* @__PURE__ */ import_react5.default.createElement("header", { className: "os-header" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-logo" }, /* @__PURE__ */ import_react5.default.createElement(Glyph, null)), /* @__PURE__ */ import_react5.default.createElement("div", null, /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-eyebrow" }, "ORCHESTRATOR / 3.0.3"), /* @__PURE__ */ import_react5.default.createElement("h1", { id: "os-title" }, t("title"))), /* @__PURE__ */ import_react5.default.createElement("span", { className: "os-header-label" }, t("readOnly")), /* @__PURE__ */ import_react5.default.createElement("button", { className: "os-icon", "aria-label": t("refresh"), onClick: () => setAttempt((n) => n + 1), disabled: loading }, /* @__PURE__ */ import_react5.default.createElement(Glyph, { kind: "refresh" })), /* @__PURE__ */ import_react5.default.createElement("button", { className: "os-icon", "aria-label": t("close"), onClick: () => setOpen(false) }, /* @__PURE__ */ import_react5.default.createElement(Glyph, { kind: "close" }))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-layout" }, /* @__PURE__ */ import_react5.default.createElement("nav", { className: "os-nav", "aria-label": t("layers") }, tabs.map((id, index) => /* @__PURE__ */ import_react5.default.createElement("button", { className: tab === id ? "os-nav-active" : "", key: id, onClick: () => changeTab(id), "aria-current": tab === id ? "page" : void 0 }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "os-nav-index" }, String(index + 1).padStart(2, "0")), t(id), index > 0 && index < 6 && /* @__PURE__ */ import_react5.default.createElement("span", { className: "os-nav-count" }, counts[index - 1]))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-nav-note" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "os-dot" }), t("seam"))), /* @__PURE__ */ import_react5.default.createElement("main", { className: "os-main" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-scope" }, /* @__PURE__ */ import_react5.default.createElement("label", { htmlFor: "os-scope" }, t("scope")), /* @__PURE__ */ import_react5.default.createElement("select", { id: "os-scope", value: scope, onChange: (e) => changeScope(e.target.value) }, /* @__PURE__ */ import_react5.default.createElement("option", { value: "" }, t("hostScope")), options.sessions.map((row) => /* @__PURE__ */ import_react5.default.createElement("option", { key: row.id, value: row.id }, row.id.slice(-8), " \xB7 ", row.preset)))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-page-title" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-eyebrow" }, t("workspace")), /* @__PURE__ */ import_react5.default.createElement("h2", null, t(tab)), /* @__PURE__ */ import_react5.default.createElement("p", null, t(`${tab}.description`))), error && /* @__PURE__ */ import_react5.default.createElement("div", { role: "alert", className: "os-warning" }, error, /* @__PURE__ */ import_react5.default.createElement("button", { onClick: () => setAttempt((n) => n + 1) }, t("retry"))), loading && !catalog && /* @__PURE__ */ import_react5.default.createElement("p", { role: "status", className: "os-loading" }, t("loading")), catalog && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, tab === "overview" && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-stats" }, ["tools", "memory", "identity", "organization", "verification"].map((id, i) => /* @__PURE__ */ import_react5.default.createElement("button", { key: id, onClick: () => changeTab(id) }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "os-eyebrow" }, "0", i + 1, " / ", t(id)), /* @__PURE__ */ import_react5.default.createElement("strong", null, counts[i]), /* @__PURE__ */ import_react5.default.createElement("span", null, t(`${id}.metric`))))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-grid" }, /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-feature" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-eyebrow" }, "RELIC"), /* @__PURE__ */ import_react5.default.createElement("h3", null, t("relicTitle")), /* @__PURE__ */ import_react5.default.createElement("p", null, t("relicBody")), /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-flow" }, ["discovery", "reading", "selection"].map((id) => /* @__PURE__ */ import_react5.default.createElement("span", { key: id }, t(id))))), /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-feature os-accent" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-eyebrow" }, "DISPATCH-ORCHESTRATOR"), /* @__PURE__ */ import_react5.default.createElement("h3", null, t("dispatchTitle")), /* @__PURE__ */ import_react5.default.createElement("p", null, t("dispatchBody")), /* @__PURE__ */ import_react5.default.createElement("button", { className: "os-link", onClick: () => changeTab("dispatch") }, t("viewPipeline"), " \u2192"))), /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-note" }, /* @__PURE__ */ import_react5.default.createElement("h3", null, t("boundaries")), /* @__PURE__ */ import_react5.default.createElement("p", null, t("boundaryBody")))), (tab === "tools" || tab === "memory") && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-toolbar" }, tab === "tools" ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-pills" }, ["plugins", "skills", "mcp", "environments"].map((id) => /* @__PURE__ */ import_react5.default.createElement("button", { key: id, className: id === toolTab ? "selected" : "", onClick: () => setToolTab(id) }, t(id), " ", /* @__PURE__ */ import_react5.default.createElement("span", null, id === "plugins" ? catalog.plugins.length : standalone(id).length)))) : /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-pills" }, ["memory-system", "memory-database", "memory-file", "memory-tool", "observation"].map((kind) => /* @__PURE__ */ import_react5.default.createElement("button", { key: kind, className: memoryTab === kind ? "selected" : "", onClick: () => setMemoryTab(kind) }, t(`kind.${kind}`), " ", /* @__PURE__ */ import_react5.default.createElement("span", null, catalog.memory.filter((row) => row.kind === kind).length)))), /* @__PURE__ */ import_react5.default.createElement("input", { "aria-label": t("search"), placeholder: t("search"), value: query, onChange: (e) => setQuery(e.target.value) })), tab === "memory" && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-note" }, /* @__PURE__ */ import_react5.default.createElement("h3", null, t("memoryProtocolTitle")), /* @__PURE__ */ import_react5.default.createElement("p", null, t("memoryProtocolBody")), /* @__PURE__ */ import_react5.default.createElement("code", null, "relic_prepare \u2192 MCP / status / recall \u2192 relic_record_observation")), memoryTab === "memory-file" && /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-note" }, /* @__PURE__ */ import_react5.default.createElement("span", null, t("memoryRoots")), catalog.memoryRoots.map((path) => /* @__PURE__ */ import_react5.default.createElement("code", { key: path }, path)))), tab === "tools" && toolTab !== "plugins" && /* @__PURE__ */ import_react5.default.createElement("p", { className: "os-caption" }, t("standaloneHint")), /* @__PURE__ */ import_react5.default.createElement(Assets, { rows: tab === "tools" ? toolRows : catalog.memory.filter((row) => row.kind === memoryTab), query, t })), tab === "identity" && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-feature" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-eyebrow" }, "IDENTITY / RESPONSIBILITY"), /* @__PURE__ */ import_react5.default.createElement("h3", null, t("identityTitle")), /* @__PURE__ */ import_react5.default.createElement("p", null, t("identityBody"))), /* @__PURE__ */ import_react5.default.createElement("h3", null, t("identityResources")), /* @__PURE__ */ import_react5.default.createElement(Assets, { rows: catalog.identity ?? [], query: "", t }), /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-grid" }, ["lead", "worker", "reviewer"].map((id) => /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-note", key: id }, /* @__PURE__ */ import_react5.default.createElement("h3", null, t(id)), /* @__PURE__ */ import_react5.default.createElement("p", null, t(`${id}.description`))))), /* @__PURE__ */ import_react5.default.createElement("p", { className: "os-caption" }, t("identityHint"))), tab === "organization" && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-note" }, /* @__PURE__ */ import_react5.default.createElement("h3", null, t("triageConclusion")), /* @__PURE__ */ import_react5.default.createElement("p", null, t("triageConclusionBody")), /* @__PURE__ */ import_react5.default.createElement("pre", { className: "os-report" }, task?.triage || t("selectScopeForReport"))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-grid" }, ["L0", "L1", "L2"].map((id) => /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-feature", key: id }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-eyebrow" }, id), /* @__PURE__ */ import_react5.default.createElement("h3", null, t(`${id}.title`)), /* @__PURE__ */ import_react5.default.createElement("p", null, t(`${id}.description`))))), /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-note" }, /* @__PURE__ */ import_react5.default.createElement("h3", null, t("dynamicTeamTitle")), /* @__PURE__ */ import_react5.default.createElement("p", null, t("dynamicTeamBody")), /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-flow" }, ["teamAssign", "teamReport", "teamAdjust", "teamIntegrate"].map((key) => /* @__PURE__ */ import_react5.default.createElement("span", { key }, t(key))))), /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-note" }, /* @__PURE__ */ import_react5.default.createElement("h3", null, t("assignment")), /* @__PURE__ */ import_react5.default.createElement("p", null, t("assignmentBody"))), /* @__PURE__ */ import_react5.default.createElement("h3", null, t("teamResources")), /* @__PURE__ */ import_react5.default.createElement(Assets, { rows: catalog.organization ?? catalog.tools.filter((row) => /subagent|teammate|team_task|list_agents|wait_agent|send_message/.test(row.name)), query: "", t })), tab === "verification" && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement(VerifierPanel, { task, t }), /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-note" }, /* @__PURE__ */ import_react5.default.createElement("h3", null, t("judgeTitle")), /* @__PURE__ */ import_react5.default.createElement("p", null, t("judgeBody")), /* @__PURE__ */ import_react5.default.createElement("p", null, t("verificationBoundary"))), /* @__PURE__ */ import_react5.default.createElement(Assets, { rows: catalog.verification ?? [], query: "", t }), /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-grid" }, /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-feature" }, /* @__PURE__ */ import_react5.default.createElement("h3", null, t("task.review")), /* @__PURE__ */ import_react5.default.createElement("code", null, "dispatch_review \u2192 ", task?.planningAttempt?.tool ?? "verifier_compare / verifier_select / verifier_track"), /* @__PURE__ */ import_react5.default.createElement("p", null, t("proposalEvidence")), /* @__PURE__ */ import_react5.default.createElement("pre", { className: "os-report" }, task?.review || t("pending"))), /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-feature" }, /* @__PURE__ */ import_react5.default.createElement("h3", null, t("task.acceptance")), /* @__PURE__ */ import_react5.default.createElement("code", null, "dispatch_accept \u2192 verifier_current_session"), /* @__PURE__ */ import_react5.default.createElement("p", null, t("acceptanceEvidence")), /* @__PURE__ */ import_react5.default.createElement("pre", { className: "os-report" }, task?.acceptance || t("pending"))))), tab === "dispatch" && /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, null, /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-pipeline" }, ["planning", "reaction", "delivery"].map((id, i) => /* @__PURE__ */ import_react5.default.createElement("div", { key: id }, /* @__PURE__ */ import_react5.default.createElement("span", null, i + 1), /* @__PURE__ */ import_react5.default.createElement("strong", null, t(`workflow.phase.${id}`)), /* @__PURE__ */ import_react5.default.createElement("small", null, t(`workflow.phase.${id}.description`))))), /* @__PURE__ */ import_react5.default.createElement("article", { className: "os-note" }, /* @__PURE__ */ import_react5.default.createElement("h3", null, t("judgeTitle")), /* @__PURE__ */ import_react5.default.createElement("p", null, t("judgeBody"))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-toolbar" }, /* @__PURE__ */ import_react5.default.createElement("label", { htmlFor: "os-session" }, t("taskRecords")), /* @__PURE__ */ import_react5.default.createElement("select", { id: "os-session", value: scope, onChange: (e) => changeScope(e.target.value) }, /* @__PURE__ */ import_react5.default.createElement("option", { value: "" }, t("selectSession")), options.tasks.map((row) => /* @__PURE__ */ import_react5.default.createElement("option", { key: row.sessionId, value: row.sessionId }, row.sessionId.slice(-8), " \xB7 ", row.prompt.slice(0, 48))))), task && options.sessions.find((row) => row.id === scope)?.preset === "dispatch-orchestrator" ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-task" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "os-badge" }, t(`phase.${task.phase}`), " \xB7 ", t("turn"), " ", task.turn), /* @__PURE__ */ import_react5.default.createElement(TaskStages, { key: task.taskId ?? `${task.sessionId}:${task.prompt}`, task, t })) : /* @__PURE__ */ import_react5.default.createElement("div", { className: "os-empty" }, task?.layerSummary || t("noTask"))), catalog.warnings.length > 0 && /* @__PURE__ */ import_react5.default.createElement("details", { className: "os-warning" }, /* @__PURE__ */ import_react5.default.createElement("summary", null, t("warnings"), " (", catalog.warnings.length, ")"), catalog.warnings.map((warning, i) => /* @__PURE__ */ import_react5.default.createElement("p", { key: i }, warning)))))), /* @__PURE__ */ import_react5.default.createElement("footer", { className: "os-footer" }, /* @__PURE__ */ import_react5.default.createElement("span", null, /* @__PURE__ */ import_react5.default.createElement("span", { className: "os-dot" }), t("catalogHint")), /* @__PURE__ */ import_react5.default.createElement("span", null, loading && catalog ? t("refreshing") + " \xB7 " : "", catalog ? new Date(catalog.generatedAt).toLocaleTimeString() : "\u2014"))));
}
function Overlay({ t }) {
  return (0, import_react5.useSyncExternalStore)(subscribe, getOpen, getOpen) ? /* @__PURE__ */ import_react5.default.createElement(Panel, { t }) : null;
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(name, { zh: zh_default, en: en_default }), "orchestrator-suite locale");
  const t = ctx.locale.bind(name);
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({ name: "sidebar.footer.action", id: "orchestrator-suite", order: 5, label: () => t("entry") }, (props) => /* @__PURE__ */ import_react5.default.createElement(Surface, null, /* @__PURE__ */ import_react5.default.createElement("button", { className: "os-entry", "aria-label": t("entry"), title: t("entry"), onClick: () => setOpen(true) }, /* @__PURE__ */ import_react5.default.createElement(Glyph, null), props.wide !== false && /* @__PURE__ */ import_react5.default.createElement("span", null, t("entry"))))));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "orchestrator-suite", order: 15 }, () => /* @__PURE__ */ import_react5.default.createElement(Surface, null, /* @__PURE__ */ import_react5.default.createElement(Overlay, { t }))));
  ctx.effect(() => () => setOpen(false), "orchestrator-suite overlay state");
  ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({ name: "conversation.session.header.actions", id: "orchestrator-suite:progress", order: 25, locale: name }, (props) => /* @__PURE__ */ import_react5.default.createElement(Surface, null, /* @__PURE__ */ import_react5.default.createElement(ProgressStatus, { sessionId: props.sessionId, t: props.t ?? t }))));
}

return module.exports;}});
