import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { CopilotWSMessage, CopilotConversation } from '../../shared/types';
import { MESSAGE_TYPE_CONFIG } from '../../shared/constants';
import { useStore, useFetchMessages } from '../hooks/useStore';
import MessageDetail from './MessageDetail';
import ExportButton from './ExportButton';

interface Props {
  conversation: CopilotConversation;
  groupIds?: string[];
}

type FilterMode = 'all' | 'key-events' | 'searches' | 'plugins';

type TimelineEntry =
  | { type: 'message'; message: CopilotWSMessage }
  | { type: 'group'; count: number; firstTimestamp: number; lastTimestamp: number };

export default function ConversationTimeline({ conversation, groupIds }: Props) {
  const messages = useStore((s) => s.messages);
  const fetchMessages = useFetchMessages();
  const [selectedMsg, setSelectedMsg] = useState<CopilotWSMessage | null>(null);
  const [filter, setFilter] = useState<FilterMode>('key-events');
  const [detailHeight, setDetailHeight] = useState(300);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const ids = groupIds && groupIds.length > 1 ? groupIds : undefined;
  useEffect(() => {
    fetchMessages(conversation.id, ids);
    const i = setInterval(() => fetchMessages(conversation.id, ids), 2000);
    return () => clearInterval(i);
  }, [conversation.id, JSON.stringify(ids), fetchMessages]);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const meaningful = useMemo(() =>
    messages.filter((m) => m.parsed.type !== 'handshake' && m.parsed.type !== 'unknown'),
    [messages]
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case 'searches':
        return meaningful.filter((m) =>
          m.parsed.type === 'search_progress' || m.parsed.type === 'search_query' || m.parsed.type === 'search_results'
        );
      case 'plugins':
        return meaningful.filter((m) => m.parsed.type === 'plugin_call' || m.parsed.type === 'plugin_response');
      case 'key-events': {
        const noise = new Set(['response_chunk', 'response_snapshot', 'diagnostics', 'metrics', 'throttling', 'completion', 'references_complete']);
        return meaningful.filter((m) => !noise.has(m.parsed.type));
      }
      default:
        return meaningful;
    }
  }, [meaningful, filter]);

  const timeline = useMemo((): TimelineEntry[] => {
    if (filter !== 'all') {
      return filtered.map((m) => ({ type: 'message' as const, message: m }));
    }

    const entries: TimelineEntry[] = [];
    let chunkGroup: CopilotWSMessage[] = [];

    const flushGroup = () => {
      if (chunkGroup.length === 0) return;
      if (chunkGroup.length <= 2) {
        chunkGroup.forEach((m) => entries.push({ type: 'message', message: m }));
      } else {
        entries.push({
          type: 'group',
          count: chunkGroup.length,
          firstTimestamp: chunkGroup[0].timestamp,
          lastTimestamp: chunkGroup[chunkGroup.length - 1].timestamp,
        });
      }
      chunkGroup = [];
    };

    const streamingTypes = new Set(['response_chunk', 'response_snapshot']);
    for (const msg of filtered) {
      if (streamingTypes.has(msg.parsed.type)) {
        chunkGroup.push(msg);
      } else {
        flushGroup();
        entries.push({ type: 'message', message: msg });
      }
    }
    flushGroup();
    return entries;
  }, [filtered, filter]);

  const counts = useMemo(() => {
    const c = { searches: 0, plugins: 0 };
    for (const m of meaningful) {
      if (m.parsed.type === 'search_progress' || m.parsed.type === 'search_query' || m.parsed.type === 'search_results') c.searches++;
      else if (m.parsed.type === 'plugin_call' || m.parsed.type === 'plugin_response') c.plugins++;
    }
    return c;
  }, [meaningful]);

  // ---- Drag resize ----
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startY = e.clientY;
    const startHeight = detailHeight;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startY - ev.clientY;
      const containerH = containerRef.current?.clientHeight || 600;
      const newH = Math.max(120, Math.min(containerH - 100, startHeight + delta));
      setDetailHeight(newH);
    };

    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [detailHeight]);

  const filters: { id: FilterMode; label: string; count?: number }[] = [
    { id: 'key-events', label: 'Key Events' },
    { id: 'searches', label: 'Searches', count: counts.searches },
    { id: 'plugins', label: 'Plugins', count: counts.plugins },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--accent-text)' }}>🤖</span>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{conversation.surface}</span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
        <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{conversation.tabTitle}</span>
        <div className="flex-1" />
        <ExportButton conversation={conversation} />
        <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{meaningful.length} events</span>
      </div>

      {/* Filter bar */}
      <div className="flex gap-1 px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="px-2 py-1 rounded text-xs font-medium transition-all"
            style={{
              background: filter === f.id ? 'var(--accent-bg)' : 'transparent',
              color: filter === f.id ? 'var(--accent-text)' : 'var(--text-secondary)',
            }}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 && (
              <span
                className="ml-1 px-1 rounded-full text-[10px]"
                style={{
                  background: f.id === 'searches' ? 'var(--search-bg)' : 'var(--plugin-bg)',
                  color: f.id === 'searches' ? 'var(--search-color)' : 'var(--plugin-color)',
                }}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto p-2 space-y-0.5">
        {timeline.length === 0 ? (
          <div className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
            {filter !== 'all' ? 'No matching events. Try a different filter.' : 'Waiting for Copilot messages...'}
          </div>
        ) : (
          timeline.map((entry, idx) => {
            if (entry.type === 'group') {
              return (
                <div
                  key={`group-${idx}`}
                  className="flex gap-2 px-2 py-1 rounded text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="font-mono w-16 flex-shrink-0">{formatTime(entry.firstTimestamp)}</span>
                  <span>←</span>
                  <span>🤖 {entry.count} streaming chunks</span>
                  <span className="font-mono">({formatTime(entry.firstTimestamp)} – {formatTime(entry.lastTimestamp)})</span>
                </div>
              );
            }

            const msg = entry.message;
            const config = MESSAGE_TYPE_CONFIG[msg.parsed.type] || MESSAGE_TYPE_CONFIG.unknown;
            const isSelected = selectedMsg?.id === msg.id;
            const isSearch = msg.parsed.type === 'search_progress' || msg.parsed.type === 'search_query' || msg.parsed.type === 'search_results';
            const isPrompt = msg.parsed.type === 'user_prompt';

            return (
              <div
                key={msg.id}
                className={`message-row px-2 py-1.5 rounded cursor-pointer ${isSelected ? 'selected' : ''}`}
                style={isSearch ? { background: 'var(--search-bg)' } : isPrompt ? { background: 'var(--prompt-bg)' } : undefined}
                onClick={() => setSelectedMsg(isSelected ? null : msg)}
              >
                <div className="flex gap-2 items-start">
                  {/* Time */}
                  <span className="text-xs font-mono w-16 flex-shrink-0 pt-px" style={{ color: 'var(--text-muted)' }}>
                    {formatTime(msg.timestamp)}
                  </span>

                  {/* Direction */}
                  <span className="text-xs flex-shrink-0 pt-px" style={{ color: msg.direction === 'sent' ? 'var(--accent-text)' : 'var(--text-secondary)' }}>
                    {msg.direction === 'sent' ? '→' : '←'}
                  </span>

                  {/* Type badge */}
                  <span
                    className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 font-medium"
                    style={{ color: config.color }}
                  >
                    {config.emoji} {config.label}
                  </span>

                  {/* Summary — wraps for search, truncates for others */}
                  <span
                    className={`text-xs ${isSearch || isPrompt ? '' : 'truncate'}`}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {getSummary(msg)}
                  </span>
                </div>

                {/* Show scope on separate line for search queries */}
                {isSearch && msg.parsed.searchScope && (
                  <div className="flex gap-2 mt-0.5 ml-[88px]">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Scope:</span>
                    <span className="text-xs" style={{ color: 'var(--search-color)' }}>{msg.parsed.searchScope}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Resizable detail panel */}
      {selectedMsg && (
        <>
          {/* Drag handle */}
          <div
            onMouseDown={onDragStart}
            style={{
              height: '5px',
              cursor: 'row-resize',
              background: 'var(--border)',
              flexShrink: 0,
            }}
            title="Drag to resize"
          >
            <div style={{
              width: '32px',
              height: '3px',
              borderRadius: '2px',
              background: 'var(--text-muted)',
              margin: '1px auto 0',
            }} />
          </div>
          <div style={{ height: `${detailHeight}px`, flexShrink: 0 }}>
            <MessageDetail message={selectedMsg} onClose={() => setSelectedMsg(null)} />
          </div>
        </>
      )}
    </div>
  );
}

function getSummary(msg: CopilotWSMessage): string {
  const p = msg.parsed;
  switch (p.type) {
    case 'user_prompt':
      return p.promptText || 'User prompt';
    case 'search_progress':
      return p.progressText || p.searchQuery || 'Searching...';
    case 'search_query':
      return p.searchQuery || '...';
    case 'search_results':
      return `${p.searchResultCount || p.sources?.length || '?'} results found`;
    case 'response_chunk':
      return p.writeAtCursor || (p.responseText ? p.responseText.slice(0, 120) : 'Streaming...');
    case 'response_snapshot':
      return `Snapshot — ${p.sourceCount || 0} sources`;
    case 'response_final': {
      const text = p.responseText ? p.responseText.slice(0, 100) + (p.responseText.length > 100 ? '...' : '') : '';
      const sources = p.sourceCount ? ` — ${p.sourceCount} sources` : '';
      const suggestions = p.suggestedResponses?.length ? `, ${p.suggestedResponses.length} suggestions` : '';
      return text || `Response complete${sources}${suggestions}`;
    }
    case 'conversation_state': {
      const parts: string[] = [];
      if (p.defaultChatName) parts.push(`"${p.defaultChatName}"`);
      if (p.sensitivityLabel) parts.push(`[${p.sensitivityLabel.displayName}]`);
      if (p.turnState) parts.push(p.turnState);
      return parts.join(' — ') || 'Conversation state';
    }
    case 'throttling':
      return p.throttling ? `${p.throttling.current} / ${p.throttling.max} messages` : 'Throttling info';
    case 'references_complete':
      return 'All references sent';
    case 'completion':
      return 'Stream complete';
    case 'metrics':
      return p.timestamps ? Object.keys(p.timestamps).join(', ') : 'Timing data';
    case 'plugin_call':
      return `Invoking: ${p.pluginName || 'unknown plugin'}`;
    case 'plugin_response':
      return `Response from: ${p.pluginName || 'unknown plugin'}`;
    case 'diagnostics':
      return `Origin: ${p.contentOrigin || 'unknown'}`;
    case 'disengaged':
      return p.errorMessage || 'Copilot disengaged';
    default:
      return '';
  }
}
