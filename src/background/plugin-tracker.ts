import type { CopilotPlugin, CopilotWSMessage, CapturedRequest, PluginInvocation } from '../shared/types';
import { storePlugins, storePluginInvocation } from './storage';

// Track known plugins from /userconfig responses
const knownPlugins = new Map<string, CopilotPlugin>();

// Pending plugin invocations (from WebSocket) waiting for HTTP correlation
const pendingInvocations = new Map<string, Partial<PluginInvocation>>();

// Callbacks
let onPluginsUpdated: ((plugins: CopilotPlugin[]) => void) | null = null;
let onPluginInvocation: ((inv: PluginInvocation) => void) | null = null;

export function setOnPluginsUpdated(cb: (plugins: CopilotPlugin[]) => void) { onPluginsUpdated = cb; }
export function setOnPluginInvocation(cb: (inv: PluginInvocation) => void) { onPluginInvocation = cb; }

export function getKnownPlugins(): CopilotPlugin[] {
  return Array.from(knownPlugins.values());
}

// ---- Parse /userconfig response ----

export function parseUserConfigResponse(responseBody: string): CopilotPlugin[] {
  try {
    const config = JSON.parse(responseBody);
    const plugins: CopilotPlugin[] = [];
    const now = Date.now();

    // The userconfig response structure varies, try common paths
    const pluginList = config.Plugins || config.plugins ||
      config.value?.Plugins || config.RequestedConfigTypes?.Plugins ||
      (Array.isArray(config) ? config : null);

    if (!pluginList || !Array.isArray(pluginList)) {
      // Try to extract from nested structure
      extractPluginsFromObject(config, plugins, now);
    } else {
      for (const p of pluginList) {
        plugins.push(normalizePlugin(p, now));
      }
    }

    return plugins;
  } catch (err) {
    console.warn('[CopilotCurtain] Failed to parse userconfig:', err);
    return [];
  }
}

function extractPluginsFromObject(obj: any, plugins: CopilotPlugin[], now: number) {
  // Recursively search for arrays that look like plugin lists
  if (!obj || typeof obj !== 'object') return;

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value) && value.length > 0 && value[0] && (value[0].Id || value[0].id || value[0].Name || value[0].name)) {
      for (const item of value) {
        plugins.push(normalizePlugin(item, now));
      }
      return; // Found what looks like a plugin list
    }
    if (typeof value === 'object') {
      extractPluginsFromObject(value, plugins, now);
    }
  }
}

function normalizePlugin(p: any, now: number): CopilotPlugin {
  const existing = knownPlugins.get(p.Id || p.id || p.Name || p.name || '');

  return {
    id: p.Id || p.id || p.Name || p.name || crypto.randomUUID(),
    name: p.Name || p.name || p.Id || p.id || 'Unknown',
    displayName: p.DisplayName || p.displayName || p.Name || p.name || 'Unknown',
    description: p.Description || p.description || '',
    enabled: p.IsEnabled ?? p.isEnabled ?? p.enabled ?? true,
    type: inferPluginType(p),
    firstSeenAt: existing?.firstSeenAt || now,
    lastSeenAt: now,
  };
}

function inferPluginType(p: any): CopilotPlugin['type'] {
  const name = (p.Name || p.name || '').toLowerCase();
  const desc = (p.Description || p.description || '').toLowerCase();
  const type = (p.Type || p.type || '').toLowerCase();

  if (type.includes('graph') || type.includes('connector')) return 'graph-connector';
  if (type.includes('declarative') || type.includes('agent')) return 'declarative-agent';
  if (type.includes('api')) return 'api';
  if (name.includes('microsoft') || name.includes('office') || name.includes('sharepoint')) return 'first-party';
  return 'unknown';
}

// ---- Process events ----

export async function onUserConfigResponse(responseBody: string) {
  const plugins = parseUserConfigResponse(responseBody);
  if (plugins.length === 0) return;

  for (const p of plugins) {
    knownPlugins.set(p.id, p);
  }

  await storePlugins(plugins);

  if (onPluginsUpdated) {
    onPluginsUpdated(Array.from(knownPlugins.values()));
  }
}

export function onWSPluginEvent(msg: CopilotWSMessage) {
  if (msg.parsed.type !== 'plugin_call') return;

  const invocation: PluginInvocation = {
    id: crypto.randomUUID(),
    timestamp: msg.timestamp,
    conversationId: msg.conversationId,
    pluginId: msg.parsed.pluginName || 'unknown',
    pluginName: msg.parsed.pluginName || 'Unknown',
    userPrompt: '', // Will be filled from conversation context
    request: null,
    response: null,
    grounding: null,
    status: 'selected',
  };

  // Store as pending — we'll try to correlate with HTTP traffic
  pendingInvocations.set(invocation.id, invocation);

  // Set a timeout to finalize even without HTTP correlation
  setTimeout(() => finalizePendingInvocation(invocation.id), 10000);
}

export function onHttpRequest(req: CapturedRequest) {
  // Try to match HTTP requests with pending plugin invocations
  if (req.category !== 'plugin-api') return;

  // Find the most recent pending invocation that could match
  for (const [id, inv] of pendingInvocations) {
    if (inv.status === 'selected' && (Date.now() - (inv.timestamp || 0)) < 10000) {
      inv.request = {
        url: req.url,
        method: req.method,
        headers: req.requestHeaders,
        body: req.requestBody || undefined,
        timestamp: req.timestamp,
      };
      inv.response = {
        statusCode: req.statusCode,
        headers: req.responseHeaders,
        body: undefined,
        timestamp: req.timestamp + req.timeMs,
        timeMs: req.timeMs,
      };
      inv.status = req.statusCode >= 200 && req.statusCode < 400 ? 'responded' : 'failed';
      if (req.statusCode >= 400) {
        inv.errorMessage = `HTTP ${req.statusCode}`;
      }
      finalizePendingInvocation(id);
      break;
    }
  }
}

async function finalizePendingInvocation(id: string) {
  const inv = pendingInvocations.get(id);
  if (!inv) return;
  pendingInvocations.delete(id);

  const finalized = inv as PluginInvocation;
  await storePluginInvocation(finalized);

  if (onPluginInvocation) {
    onPluginInvocation(finalized);
  }
}
