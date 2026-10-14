/** Generic public-catalog classification. No foreign package imports or private calls. */
import type { Asset, Catalog, LayerObservation } from '../shared';
export function layerCatalog(plugins: Asset[], tools: Asset[]) {
  const matches = (asset: Asset, pattern: RegExp) => pattern.test(`${asset.id} ${asset.name} ${asset.description}`);
  const evidence = (asset: Asset): Asset => ({ ...asset, children: undefined, evidence: 'Public registry metadata matched this layer; capability and current selection need read-only confirmation.' });
  const memoryTools = tools.filter(tool => (/memory|synabun|lingshu|recall|记忆|召回/i.test(tool.id) || /conversation memory|对话记忆|记忆数据库/i.test(tool.description)) && /recall|search|status|query|read|召回|检索/i.test(tool.id) && !/(?:remember|forget|delete|remove|export|migrate|write|update|create|browser|click|写入|删除|导出|迁移)/i.test(tool.id));
  const memorySystems = plugins.filter(plugin => matches(plugin, /memory|synabun|lingshu|记忆/i)).map(plugin => ({ ...evidence(plugin), kind: 'memory-system' }));
  const memoryDatabases: Asset[] = memoryTools.filter(tool => /recall|search|query|召回|检索/i.test(tool.id)).map(tool => ({ ...evidence(tool), id: `database:${tool.id}`, name: tool.id, kind: 'memory-database', description: 'Conversation memory query interface; storage implementation and transport not independently confirmed.', protocol: tool.id.startsWith('mcp__') ? 'mcp (transport unknown)' : 'host public tool (backend unknown)', toolNames: [tool.id] }));
  const identity = [...plugins.filter(plugin => matches(plugin, /cosplay|persona|identity|role-card|身份|角色卡/i)).map(evidence), ...tools.filter(tool => matches(tool, /cosplay|persona|identity|角色卡/i)).map(evidence)];
  const organization = [...plugins.filter(plugin => matches(plugin, /agent[-_]?(?:team|swarm|warm)|subagent|teammate|workflow-ptc|智能体团队|组织协作/i)).map(evidence), ...tools.filter(tool => matches(tool, /subagent|teammate|team_task|list_agents|wait_agent|send_message|swarm|团队|子智能体/i)).map(evidence)];
  const verification: Asset[] = ['verifier_compare', 'verifier_current_session'].map((name, index) => {
    const tool = tools.find(tool => tool.id === name);
    return { id: name, name, kind: 'verifier-tool', status: tool ? 'available' : 'unavailable', description: index === 0 ? 'dispatch_review → verifier_compare · proposal review; never delivery acceptance' : 'dispatch_accept → verifier_current_session · delivery evidence evaluation; returned score is not a claimed pass', toolNames: [index === 0 ? 'dispatch_review' : 'dispatch_accept', name], evidence: tool ? 'Visible in the current public tool schema registry; not called by discovery.' : 'Not visible in this scope; report degraded/unknown and continue independent work.' };
  });
  return { memory: [...memorySystems, ...memoryDatabases, ...memoryTools.map(tool => ({ ...evidence(tool), kind: 'memory-tool' }))], identity, organization, verification };
}
export function applyObservations(catalog: Catalog, observations: LayerObservation[]): Catalog {
  // Clone layer arrays so a route snapshot cannot mutate a stored task catalog.
  const result = { ...catalog, memory: [...catalog.memory], identity: [...catalog.identity], organization: [...catalog.organization] };
  for (const observation of observations) {
    const rows = result[observation.layer];
    rows.push({ id: `observation:${observation.resourceId}`, name: observation.resourceId, kind: 'observation', status: 'reported', description: observation.summary, evidence: `${observation.source} · ${observation.recordedAt} · model-reported; not independent probing`, endpoint: observation.endpoint, protocol: observation.protocol, port: observation.port });
  }
  return result;
}
/** Record transport only from submitted public observations, with no credentials. */
export function parseConnection(endpoint: string, protocol: string): { endpoint?: string; protocol: string; port?: number } {
  const normalized = protocol.trim().toLowerCase();
  if (!['stdio', 'http', 'https', 'sse', 'streamable-http', 'unknown'].includes(normalized)) throw new Error('Use stdio/http/https/sse/streamable-http/unknown');
  if (normalized === 'stdio') {
    if (endpoint.trim()) throw new Error('stdio has no network endpoint or TCP port');
    return { protocol: 'stdio' };
  }
  if (!endpoint.trim()) return { protocol: normalized };
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Endpoint must be an HTTP(S) URL without credentials, query or fragment');
  if ((normalized === 'http' && url.protocol !== 'http:') || (normalized === 'https' && url.protocol !== 'https:')) throw new Error('Protocol does not match endpoint');
  return { endpoint: url.href, protocol: normalized, port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)) };
}
