/** Structural DSH 0.2 interfaces; no second runtime service instance is imported. */
import type { Asset } from '../shared';
export interface Agent { id: string; ctx: object; session: { header: { parentSession?: string; cwd?: string } } }
export interface Message { content: Array<{ type: string; text?: string }>; source?: { kind: string } }
export interface Execution {
  agent?: Agent; signal: AbortSignal; callId: string; rootCallId?: string; token: symbol;
  deferContext(context: unknown): void;
}
export interface ToolResult { isError: boolean; content: Array<{ type: string; text?: string }>; value?: unknown; additionalContexts?: unknown[] }
export interface ToolDescriptor {
  name: string; description: string; parameters: object;
  output: { schema: object; render(args: unknown, value: unknown): Array<{ type: 'text'; text: string }> };
  execute(args: unknown, exec: Execution): Promise<unknown>;
}
export interface SkillInfo { name: string; description: string; path?: string; source: string; invocation: { modelInvocable: boolean } }
export interface PluginInfo { entryId: string; moduleName: string; enabled: boolean; fiberPhase: string | null; meta?: { title?: string | Record<string, string>; description?: string | Record<string, string> } }
export interface BundleInfo { name: string; description?: string; version?: string; enabled: boolean; error?: object; rows?: Array<{ rowId: string; moduleName: string; entryId?: string }> }
export interface Context {
  logger: { warn(message: string): void };
  effect(callback: () => unknown, label?: string): unknown;
  inject(names: string[], callback: (ctx: Context) => void): unknown;
  on(event: 'agent/pre-step', listener: (payload: { agent: Agent; messages: Message[]; turn: number; step: number; signal: AbortSignal }, next: () => Promise<{ kind: string; messages?: Message[] }>) => Promise<{ kind: string; messages?: Message[] }>): unknown;
  on(event: 'agent/inbox/claimed', listener: (payload: { agent: Agent; message: Message; turn: number }) => void): unknown;
  on(event: 'agent/status', listener: (payload: { agent: Agent; status: 'idle' | 'running' }) => void): unknown;
  on(event: 'agent/error', listener: (payload: { agent: Agent; turn: number; error: unknown }) => void): unknown;
  on(event: 'system-prompt/assemble', listener: (assembly: { sections: Array<{ name: string; text: string; interpolate?: boolean }> }, context: { scope?: object; agent?: Agent; signal?: AbortSignal }, next: () => Promise<{ sections: Array<{ name: string; text: string; interpolate?: boolean }> }>) => Promise<{ sections: Array<{ name: string; text: string; interpolate?: boolean }> }>): unknown;
  systemPrompt: { section(section: { name: string; order: number; interpolate: boolean; text: (context: { scope?: object; agent?: Agent }) => string }): () => void };
  tools: {
    register(tool: ToolDescriptor): () => void;
    schemas(scope?: object): Array<{ name: string; description: string }>;
    get(name: string, scope?: object): object | undefined;
    execute(exec: { agent: Agent; signal: AbortSignal; callId: string; rootCallId: string; parent: symbol; name: string; arguments: unknown }): Promise<ToolResult>;
  };
  skills: { list(options: { scope?: object; cwd?: string; signal?: AbortSignal }): Promise<SkillInfo[]> };
  workingDirectory?: { ensure(agent: Agent, signal: AbortSignal): Promise<string> };
  agentPresets: { composedPreset(ctx: object): string | undefined; compositionInventory(): Promise<Array<{ id: string; rows: PluginInfo[] }>> };
  agents: { get(id: string): Agent | undefined; list(): Agent[] };
  pluginManager?: { listPlugins(): Promise<PluginInfo[]>; listBundles(): Promise<BundleInfo[]> };
  connection: { fetch: { register(route: { path: string; methods: string[]; requestBody: 'buffered'; fetch(request: Request): Promise<Response> }): () => Promise<void> } };
}
export function toolAssets(ctx: Context, scope?: object): Asset[] {
  return ctx.tools.schemas(scope).map(t => ({ id: t.name, name: t.name, kind: 'tool', description: t.description, status: 'available' }));
}
