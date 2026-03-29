import React, { useEffect, useState } from 'react';
import type { CopilotPlugin, PluginInvocation } from '../../shared/types';
import { useStore, useFetchPlugins, useFetchInvocations } from '../hooks/useStore';

export default function PluginDashboard() {
  const plugins = useStore((s) => s.plugins);
  const invocations = useStore((s) => s.invocations);
  const fetchPlugins = useFetchPlugins();
  const fetchInvocations = useFetchInvocations();
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>🔌 Plugin Registry & Health</span>
      </div>

      <div className="flex-1 overflow-auto">
        {plugins.length === 0 ? (
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
                  onClick={() => setSelectedPlugin(isSelected ? null : plugin.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full`} style={{ background: plugin.enabled ? 'var(--success)' : 'var(--text-muted)' }} />
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

                  {isSelected && stats.total > 0 && (
                    <div className="mt-3 pt-2 space-y-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="flex gap-3 text-xs">
                        <span style={{ color: 'var(--success)' }}>✓ {stats.success} success</span>
                        {stats.failed > 0 && <span style={{ color: 'var(--danger)' }}>✗ {stats.failed} failed</span>}
                        <span style={{ color: 'var(--text-secondary)' }}>⏱ {Math.round(stats.avgLatency)}ms avg</span>
                      </div>

                      <div className="space-y-1 mt-2">
                        {(invocationsByPlugin.get(plugin.id) || []).slice(0, 5).map((inv) => (
                          <div key={inv.id} className="flex items-center gap-2 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full" style={{
                              background: inv.status === 'responded' || inv.status === 'grounded' ? 'var(--success)' :
                                inv.status === 'failed' || inv.status === 'timeout' ? 'var(--danger)' : 'var(--warning)',
                            }} />
                            <span className="font-mono w-14" style={{ color: 'var(--text-muted)' }}>
                              {new Date(inv.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span style={{ color: 'var(--text-secondary)' }}>{inv.status}</span>
                            {inv.response?.timeMs && <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>{inv.response.timeMs}ms</span>}
                          </div>
                        ))}
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

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 p-2 rounded" style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
