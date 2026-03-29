import React, { useEffect, useState } from 'react';
import type { CopilotPlugin, PluginInvocation } from '../../shared/types';
import { useStore, useFetchPlugins, useFetchInvocations } from '../hooks/useStore';
import JsonTree from './JsonTree';

export default function PluginDashboard() {
  const plugins = useStore((s) => s.plugins);
  const invocations = useStore((s) => s.invocations);
  const requests = useStore((s) => s.requests);
  const fetchPlugins = useFetchPlugins();
  const fetchInvocations = useFetchInvocations();
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [selectedInvocation, setSelectedInvocation] = useState<PluginInvocation | null>(null);

  useEffect(() => {
    fetchPlugins();
    fetchInvocations();
    const i = setInterval(() => { fetchPlugins(); fetchInvocations(); }, 5000);
    return () => clearInterval(i);
  }, [fetchPlugins, fetchInvocations]);

  const invocationsByPlugin = new Map<string, PluginInvocation[]>();
  for (const inv of invocations) {
    const key = inv.pluginId;
    if (!invocationsByPlugin.has(key)) invocationsByPlugin.set(key, []);
    invocationsByPlugin.get(key)!.push(inv);
  }

  const getPluginStats = (pluginId: string) => {
    const invs = invocationsByPlugin.get(pluginId) || [];
    const total = invs.length;
    const success = invs.filter(i => i.status === 'responded' || i.status === 'grounded').length;
    const failed = invs.filter(i => i.status === 'failed' || i.status === 'timeout').length;
    const avgLatency = invs.filter(i => i.response?.timeMs).reduce((sum, i) => sum + (i.response?.timeMs || 0), 0) / (invs.filter(i => i.response?.timeMs).length || 1);
    return { total, success, failed, avgLatency, rate: total > 0 ? (success / total * 100) : 0 };
  };

  // Find HTTP requests that might correlate with a plugin invocation
  const findCorrelatedRequests = (inv: PluginInvocation) => {
    const timeWindow = 15000; // 15s window
    return requests.filter(r =>
      r.category === 'plugin-api' &&
      Math.abs(r.timestamp - inv.timestamp) < timeWindow
    ).sort((a, b) => a.timestamp - b.timestamp);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Plugin Registry & Invocations</span>
      </div>

      <div className="flex-1 overflow-auto">
        {plugins.length === 0 && invocations.length === 0 ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
            <div className="text-center">
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No plugins detected yet</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Plugins are discovered when Copilot loads its configuration.<br />
                Start a Copilot conversation to detect available plugins.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {/* Summary */}
            <div className="flex gap-3 mb-3">
              <StatCard label="Plugins Loaded" value={String(plugins.length)} color="var(--accent)" />
              <StatCard label="Enabled" value={String(plugins.filter(p => p.enabled).length)} color="var(--success)" />
              <StatCard label="Invocations" value={String(invocations.length)} color="var(--warning)" />
            </div>

            {/* Plugin list */}
            {plugins.map((plugin) => {
              const stats = getPluginStats(plugin.id);
              const isSelected = selectedPlugin === plugin.id;

              return (
                <div
                  key={plugin.id}
                  className="p-3 rounded cursor-pointer transition-all"
                  style={{
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: isSelected ? 'var(--surface-selected)' : 'var(--bg-secondary)',
                  }}
                  onClick={() => { setSelectedPlugin(isSelected ? null : plugin.id); setSelectedInvocation(null); }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: plugin.enabled ? 'var(--success)' : 'var(--text-muted)' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{plugin.displayName}</span>
                      <span className="text-xs px-1 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{plugin.type}</span>
                    </div>
                    {stats.total > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{stats.total} calls</span>
                        <span className="text-xs font-mono" style={{ color: stats.rate >= 80 ? 'var(--success)' : stats.rate >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                          {stats.rate.toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {plugin.description && (
                    <div className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{plugin.description}</div>
                  )}

                  {isSelected && (
                    <div className="mt-3 pt-2 space-y-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      {stats.total > 0 && (
                        <div className="flex gap-3 text-xs mb-2">
                          <span style={{ color: 'var(--success)' }}>✓ {stats.success} success</span>
                          {stats.failed > 0 && <span style={{ color: 'var(--danger)' }}>✗ {stats.failed} failed</span>}
                          <span style={{ color: 'var(--text-secondary)' }}>{Math.round(stats.avgLatency)}ms avg</span>
                        </div>
                      )}

                      {/* Invocation list */}
                      <div className="space-y-1">
                        {(invocationsByPlugin.get(plugin.id) || []).map((inv) => {
                          const isInvSelected = selectedInvocation?.id === inv.id;
                          return (
                            <div key={inv.id}>
                              <div
                                className="flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer"
                                style={{ background: isInvSelected ? 'var(--accent-bg)' : 'transparent' }}
                                onClick={(e) => { e.stopPropagation(); setSelectedInvocation(isInvSelected ? null : inv); }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
                                  background: inv.status === 'responded' || inv.status === 'grounded' ? 'var(--success)' :
                                    inv.status === 'failed' || inv.status === 'timeout' ? 'var(--danger)' : 'var(--warning)',
                                }} />
                                <span className="font-mono w-14 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  {new Date(inv.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                                <span style={{ color: 'var(--text-primary)' }}>{inv.status}</span>
                                {inv.response?.timeMs && <span className="ml-auto font-mono" style={{ color: 'var(--text-muted)' }}>{inv.response.timeMs}ms</span>}
                              </div>

                              {/* Invocation detail — full flow */}
                              {isInvSelected && (
                                <InvocationFlow invocation={inv} correlatedRequests={findCorrelatedRequests(inv)} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Invocation flow: WS trigger → HTTP request → HTTP response → result ----

function InvocationFlow({ invocation: inv, correlatedRequests }: {
  invocation: PluginInvocation;
  correlatedRequests: Array<{ method: string; url: string; statusCode: number; timeMs: number; timestamp: number; requestHeaders: Record<string, string>; requestBody?: string | null }>;
}) {
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const steps = [
    {
      label: 'WS Plugin Call',
      time: formatTime(inv.timestamp),
      color: 'var(--plugin-color)',
      detail: inv.userPrompt ? `Prompt: "${inv.userPrompt.slice(0, 80)}${inv.userPrompt.length > 80 ? '...' : ''}"` : null,
    },
    ...(inv.request ? [{
      label: `HTTP ${inv.request.method}`,
      time: formatTime(inv.request.timestamp),
      color: 'var(--accent-text)',
      detail: inv.request.url,
    }] : []),
    ...(inv.response ? [{
      label: `HTTP ${inv.response.statusCode}`,
      time: formatTime(inv.response.timestamp),
      color: inv.response.statusCode >= 400 ? 'var(--danger)' : 'var(--success)',
      detail: `${inv.response.timeMs}ms latency`,
    }] : []),
    {
      label: `Result: ${inv.status}`,
      time: '',
      color: inv.status === 'responded' || inv.status === 'grounded' ? 'var(--success)' :
        inv.status === 'failed' || inv.status === 'timeout' ? 'var(--danger)' : 'var(--warning)',
      detail: inv.errorMessage || (inv.grounding ? `Cited ${inv.grounding.citationCount}x in response` : null),
    },
  ];

  return (
    <div className="ml-6 mt-2 mb-2 p-2 rounded text-xs space-y-2" style={{ background: 'var(--code-bg)', border: '1px solid var(--border-subtle)' }} onClick={(e) => e.stopPropagation()}>
      {/* Flow steps */}
      <div className="space-y-1">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: step.color }} />
            <div>
              <span className="font-medium" style={{ color: step.color }}>{step.label}</span>
              {step.time && <span className="font-mono ml-2" style={{ color: 'var(--text-muted)' }}>{step.time}</span>}
              {step.detail && <div className="mt-0.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{step.detail}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Request/Response payloads */}
      {inv.request?.body && (
        <div>
          <div className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Request Body</div>
          <div className="p-1.5 rounded" style={{ background: 'var(--bg-secondary)' }}>
            <JsonTree data={tryParse(inv.request.body)} defaultExpanded={3} />
          </div>
        </div>
      )}
      {inv.response?.body && (
        <div>
          <div className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Response Body</div>
          <div className="p-1.5 rounded" style={{ background: 'var(--bg-secondary)' }}>
            <JsonTree data={tryParse(inv.response.body)} defaultExpanded={3} />
          </div>
        </div>
      )}

      {/* Correlated HTTP requests */}
      {correlatedRequests.length > 0 && (
        <div>
          <div className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Correlated HTTP Requests ({correlatedRequests.length})</div>
          <div className="space-y-0.5">
            {correlatedRequests.map((r, i) => (
              <div key={i} className="flex items-center gap-2 font-mono">
                <span className="font-semibold" style={{ color: 'var(--accent-text)' }}>{r.method}</span>
                <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{r.url}</span>
                <span style={{ color: r.statusCode >= 400 ? 'var(--danger)' : 'var(--success)' }}>{r.statusCode}</span>
                <span style={{ color: 'var(--text-muted)' }}>{r.timeMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function tryParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 p-2 rounded" style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
