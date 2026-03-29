import React, { useState } from 'react';
import type { CopilotWSMessage } from '../../shared/types';
import { MESSAGE_TYPE_CONFIG } from '../../shared/constants';

interface Props {
  message: CopilotWSMessage;
  onClose: () => void;
}

type Tab = 'parsed' | 'sources' | 'raw';

export default function MessageDetail({ message, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('parsed');
  const config = MESSAGE_TYPE_CONFIG[message.parsed.type] || MESSAGE_TYPE_CONFIG.unknown;
  const p = message.parsed;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'parsed', label: 'Parsed' },
    ...(p.sources && p.sources.length > 0 ? [{ id: 'sources' as Tab, label: `Sources (${p.sources.length})` }] : []),
    { id: 'raw', label: 'Raw Frame' },
  ];

  return (
    <div className="border-t flex flex-col h-[40%] min-h-[180px]" style={{ borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/20 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: config.color, backgroundColor: `${config.color}15` }}>
            {config.emoji} {config.label}
          </span>
          <span className="text-xs text-gray-400">
            {message.direction === 'sent' ? '→ Sent' : '← Received'} at {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white px-1 text-lg leading-none">×</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs ${tab === t.id ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-gray-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {tab === 'parsed' && (
          <div className="space-y-2 text-xs">
            {p.type === 'user_prompt' && (
              <>
                <div className="text-gray-200 bg-blue-900/20 p-2 rounded font-mono whitespace-pre-wrap">
                  {p.promptText}
                </div>
                {p.enabledPlugins && p.enabledPlugins.length > 0 && (
                  <div>
                    <span className="text-gray-500">Enabled plugins:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.enabledPlugins.map((pl, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-green-900/20 text-green-400 rounded text-xs">{pl}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {p.type === 'search_query' && (
              <>
                <Row label="Query" value={p.searchQuery || '—'} mono />
                {p.searchScope && <Row label="Scope" value={p.searchScope} />}
                <Row label="Origin" value={p.contentOrigin || '—'} />
              </>
            )}

            {p.type === 'search_results' && (
              <>
                <Row label="Results" value={`${p.searchResultCount || p.sources?.length || 0} items`} />
                <Row label="Origin" value={p.contentOrigin || '—'} />
              </>
            )}

            {(p.type === 'response_chunk' || p.type === 'response_final') && (
              <>
                {p.responseText && (
                  <div className="text-gray-200 bg-purple-900/15 p-2 rounded whitespace-pre-wrap">
                    {p.responseText}
                  </div>
                )}
                {p.rawTextWithMarkers && (
                  <div>
                    <span className="text-gray-500">Raw (with reference markers):</span>
                    <div className="text-gray-400 bg-gray-800/50 p-2 rounded font-mono text-xs mt-1 whitespace-pre-wrap">
                      {p.rawTextWithMarkers}
                    </div>
                  </div>
                )}
                {p.contentOrigin && <Row label="Origin" value={p.contentOrigin} />}
              </>
            )}

            {p.type === 'plugin_call' && (
              <>
                <Row label="Plugin" value={p.pluginName || '—'} />
                {p.pluginRequest && (
                  <div>
                    <span className="text-gray-500">Request payload:</span>
                    <pre className="text-gray-300 bg-gray-800/50 p-2 rounded font-mono text-xs mt-1 whitespace-pre-wrap">
                      {JSON.stringify(p.pluginRequest, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}

            {p.type === 'diagnostics' && (
              <>
                <Row label="Origin" value={p.contentOrigin || '—'} />
                {p.diagnosticData && (
                  <pre className="text-gray-300 bg-gray-800/50 p-2 rounded font-mono text-xs whitespace-pre-wrap max-h-60 overflow-auto">
                    {JSON.stringify(p.diagnosticData, null, 2)}
                  </pre>
                )}
              </>
            )}

            {p.type === 'disengaged' && (
              <div className="text-red-400 bg-red-900/15 p-2 rounded">
                {p.errorMessage || 'Copilot disengaged from conversation'}
              </div>
            )}

            {p.adaptiveCards && p.adaptiveCards.length > 0 && (
              <div>
                <span className="text-gray-500">Adaptive Cards ({p.adaptiveCards.length}):</span>
                <pre className="text-gray-300 bg-gray-800/50 p-2 rounded font-mono text-xs mt-1 whitespace-pre-wrap max-h-40 overflow-auto">
                  {JSON.stringify(p.adaptiveCards, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {tab === 'sources' && p.sources && (
          <div className="space-y-2">
            {p.sources.map((source, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded bg-gray-800/20 border border-gray-700/30">
                <span className="text-xs flex-shrink-0">
                  {source.type === 'file' ? '📄' : source.type === 'email' ? '📧' : source.type === 'chat' ? '💬' : source.type === 'web' ? '🌐' : source.type === 'meeting' ? '📅' : '❓'}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-200 truncate">{source.title}</div>
                  {source.url && <div className="text-xs text-blue-400 font-mono truncate">{source.url}</div>}
                  {source.snippet && <div className="text-xs text-gray-400 mt-0.5">{source.snippet}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'raw' && (
          <pre className="text-gray-300 font-mono text-xs whitespace-pre-wrap break-all">
            {tryPrettyJson(message.rawPayload)}
          </pre>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-500 w-20 flex-shrink-0">{label}</span>
      <span className={`text-gray-300 break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function tryPrettyJson(str: string): string {
  // Try to pretty-print each JSON part separated by record separator
  const parts = str.split('\x1e').filter(Boolean);
  return parts.map(part => {
    try { return JSON.stringify(JSON.parse(part), null, 2); }
    catch { return part; }
  }).join('\n\n---\n\n');
}
