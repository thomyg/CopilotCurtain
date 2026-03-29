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

  // Group invocations by plugin
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
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-semibold text-gray-200">🔌 Plugin Registry & Health</span>
      </div>

      <div className="flex-1 overflow-auto">
        {plugins.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <div className="text-center">
              <div className="text-3xl mb-2">🔌</div>
              <div>No plugins detected yet</div>
              <div className="text-xs mt-1 text-gray-600">
                Plugins are discovered when Copilot loads its configuration.<br />
                Start a Copilot conversation to detect available plugins.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {/* Summary */}
            <div className="flex gap-3 mb-3">
              <StatCard label="Plugins Loaded" value={String(plugins.length)} color="#7c3aed" />
              <StatCard label="Enabled" value={String(plugins.filter(p => p.enabled).length)} color="#10b981" />
              <StatCard label="Invocations" value={String(invocations.length)} color="#f59e0b" />
            </div>

            {/* Plugin list */}
            {plugins.map((plugin) => {
              const stats = getPluginStats(plugin.id);
              const isSelected = selectedPlugin === plugin.id;

              return (
                <div
                  key={plugin.id}
                  className={`p-3 rounded border cursor-pointer transition-all ${
                    isSelected ? 'border-purple-500/50 bg-purple-900/10' : 'border-gray-700/30 bg-gray-800/10 hover:bg-gray-800/30'
                  }`}
                  onClick={() => setSelectedPlugin(isSelected ? null : plugin.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${plugin.enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <span className="text-xs font-medium text-gray-200">{plugin.displayName}</span>
                      <span className="text-xs text-gray-500 px-1 py-0.5 bg-gray-800/50 rounded">{plugin.type}</span>
                    </div>
                    {stats.total > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{stats.total} calls</span>
                        <span className={`text-xs font-mono ${stats.rate >= 80 ? 'text-green-400' : stats.rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {stats.rate.toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {plugin.description && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{plugin.description}</div>
                  )}

                  {/* Expanded detail */}
                  {isSelected && stats.total > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-700/30 space-y-1.5">
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-400">✓ {stats.success} success</span>
                        {stats.failed > 0 && <span className="text-red-400">✗ {stats.failed} failed</span>}
                        <span className="text-gray-400">⏱ {Math.round(stats.avgLatency)}ms avg</span>
                      </div>

                      {/* Recent invocations */}
                      <div className="space-y-1 mt-2">
                        {(invocationsByPlugin.get(plugin.id) || []).slice(0, 5).map((inv) => (
                          <div key={inv.id} className="flex items-center gap-2 text-xs">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              inv.status === 'responded' || inv.status === 'grounded' ? 'bg-green-500' :
                              inv.status === 'failed' || inv.status === 'timeout' ? 'bg-red-500' : 'bg-yellow-500'
                            }`} />
                            <span className="text-gray-500 font-mono w-14">
                              {new Date(inv.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-gray-400 truncate">{inv.status}</span>
                            {inv.response?.timeMs && <span className="text-gray-500 ml-auto">{inv.response.timeMs}ms</span>}
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
    <div className="flex-1 p-2 rounded border border-gray-700/30 bg-gray-800/10">
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
