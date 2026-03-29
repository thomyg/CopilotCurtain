import React, { useEffect, useState, useMemo } from 'react';
import type { CopilotWSMessage, CopilotConversation } from '../../shared/types';
import { useStore, useFetchMessages } from '../hooks/useStore';
import MessageDetail from './MessageDetail';

interface Props {
  conversation: CopilotConversation;
  groupIds?: string[];
}

// A flow step — represents a meaningful event in the pipeline
interface FlowStep {
  id: string;
  type: 'prompt' | 'search' | 'streaming' | 'response' | 'sources' | 'state' | 'plugin' | 'error';
  label: string;
  detail: string;
  timestamp: number;
  duration?: number;         // ms from this step to the next
  icon: string;
  color: string;
  sourceCount?: number;
  suggestedCount?: number;
  message?: CopilotWSMessage; // click to show detail
  children?: FlowStep[];     // nested steps (e.g. multiple search queries)
}

export default function ConversationFlow({ conversation, groupIds }: Props) {
  const messages = useStore((s) => s.messages);
  const fetchMessages = useFetchMessages();
  const [selectedMsg, setSelectedMsg] = useState<CopilotWSMessage | null>(null);
  const [detailHeight, setDetailHeight] = useState(300);
  const isDragging = React.useRef(false);

  const ids = groupIds && groupIds.length > 1 ? groupIds : undefined;
  useEffect(() => {
    fetchMessages(conversation.id, ids);
    const i = setInterval(() => fetchMessages(conversation.id, ids), 2000);
    return () => clearInterval(i);
  }, [conversation.id, JSON.stringify(ids), fetchMessages]);

  // Build flow steps from messages
  const steps = useMemo(() => buildFlowSteps(messages), [messages]);

  const onDragStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startY = e.clientY;
    const startH = detailHeight;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setDetailHeight(Math.max(120, Math.min(window.innerHeight - 100, startH + (startY - ev.clientY))));
    };
    const onUp = () => { isDragging.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [detailHeight]);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--accent-text)' }}>⚡</span>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Flow — {conversation.surface}</span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>—</span>
        <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
          {conversation.defaultChatName || conversation.firstPrompt || conversation.tabTitle}
        </span>
      </div>

      {/* Flow visualization */}
      <div className="flex-1 overflow-auto p-4">
        {steps.length === 0 ? (
          <div className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
            Waiting for conversation events...
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-[18px] top-4 bottom-4"
              style={{ width: '2px', background: 'var(--border)' }}
            />

            {steps.map((step, i) => {
              const isSelected = selectedMsg?.id === step.message?.id;
              const isLast = i === steps.length - 1;

              return (
                <div key={step.id} className="relative flex gap-3 mb-1">
                  {/* Node dot */}
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: '38px' }}>
                    <div
                      className="w-[38px] h-[38px] rounded-lg flex items-center justify-center text-base z-10 transition-all cursor-pointer"
                      style={{
                        background: isSelected ? step.color : 'var(--bg-primary)',
                        border: `2px solid ${step.color}`,
                        filter: isSelected ? 'brightness(1.2)' : undefined,
                      }}
                      onClick={() => step.message && setSelectedMsg(isSelected ? null : step.message)}
                    >
                      {step.icon}
                    </div>
                    {/* Duration connector */}
                    {step.duration && !isLast && step.duration > 500 && (
                      <div className="text-[10px] font-mono my-0.5 px-1 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                        {step.duration > 1000 ? `${(step.duration / 1000).toFixed(1)}s` : `${step.duration}ms`}
                      </div>
                    )}
                  </div>

                  {/* Content card */}
                  <div
                    className="flex-1 pb-3 cursor-pointer"
                    onClick={() => step.message && setSelectedMsg(isSelected ? null : step.message)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatTime(step.timestamp)}</span>
                      <span className="text-xs font-semibold" style={{ color: step.color }}>{step.label}</span>
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>
                      {step.detail}
                    </div>

                    {/* Source/suggestion badges */}
                    {(step.sourceCount || step.suggestedCount) && (
                      <div className="flex gap-2 mt-1">
                        {step.sourceCount ? (
                          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-bg)', color: 'var(--accent-text)' }}>
                            📄 {step.sourceCount} sources
                          </span>
                        ) : null}
                        {step.suggestedCount ? (
                          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                            💡 {step.suggestedCount} suggestions
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Nested steps (search sub-steps) */}
                    {step.children && step.children.length > 0 && (
                      <div className="mt-2 ml-2 pl-3 space-y-1" style={{ borderLeft: `2px solid ${step.color}40` }}>
                        {step.children.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-start gap-2 py-0.5 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); child.message && setSelectedMsg(child.message); }}
                          >
                            <span className="text-xs">{child.icon}</span>
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{child.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail pane */}
      {selectedMsg && (
        <>
          <div
            onMouseDown={onDragStart}
            style={{ height: '5px', cursor: 'row-resize', background: 'var(--border)', flexShrink: 0 }}
          >
            <div style={{ width: '32px', height: '3px', borderRadius: '2px', background: 'var(--text-muted)', margin: '1px auto 0' }} />
          </div>
          <div style={{ height: `${detailHeight}px`, flexShrink: 0 }}>
            <MessageDetail message={selectedMsg} onClose={() => setSelectedMsg(null)} />
          </div>
        </>
      )}
    </div>
  );
}

// ---- Build flow steps from raw messages ----

function buildFlowSteps(messages: CopilotWSMessage[]): FlowStep[] {
  const steps: FlowStep[] = [];
  const meaningful = messages.filter((m) =>
    m.parsed.type !== 'handshake' && m.parsed.type !== 'unknown' && m.parsed.type !== 'metrics'
  );

  let searchSteps: FlowStep[] = [];
  let streamingStart: number | null = null;
  let streamingCount = 0;
  let lastSnapshotSources = 0;

  const flushSearches = () => {
    if (searchSteps.length === 0) return;
    steps.push({
      id: `search-group-${searchSteps[0].timestamp}`,
      type: 'search',
      label: 'Search & Grounding',
      detail: `${searchSteps.length} search ${searchSteps.length === 1 ? 'query' : 'queries'}`,
      timestamp: searchSteps[0].timestamp,
      icon: '🔍',
      color: 'var(--search-color)',
      message: searchSteps[0].message,
      children: searchSteps,
    });
    searchSteps = [];
  };

  const flushStreaming = (nextTimestamp: number) => {
    if (streamingStart === null) return;
    steps.push({
      id: `streaming-${streamingStart}`,
      type: 'streaming',
      label: 'Streaming Response',
      detail: `${streamingCount} tokens, ${lastSnapshotSources} sources accumulated`,
      timestamp: streamingStart,
      duration: nextTimestamp - streamingStart,
      icon: '✏️',
      color: 'var(--text-muted)',
    });
    streamingStart = null;
    streamingCount = 0;
  };

  for (let i = 0; i < meaningful.length; i++) {
    const msg = meaningful[i];
    const next = meaningful[i + 1];
    const duration = next ? next.timestamp - msg.timestamp : undefined;
    const p = msg.parsed;

    switch (p.type) {
      case 'user_prompt':
        flushSearches();
        flushStreaming(msg.timestamp);
        steps.push({
          id: msg.id,
          type: 'prompt',
          label: 'User Prompt',
          detail: p.promptText || '',
          timestamp: msg.timestamp,
          duration,
          icon: '🧑',
          color: 'var(--prompt-color)',
          message: msg,
        });
        break;

      case 'search_progress':
      case 'search_query':
      case 'search_results':
        flushStreaming(msg.timestamp);
        searchSteps.push({
          id: msg.id,
          type: 'search',
          label: 'Search',
          detail: p.progressText || p.searchQuery || `${p.searchResultCount || '?'} results`,
          timestamp: msg.timestamp,
          icon: '🔍',
          color: 'var(--search-color)',
          message: msg,
        });
        break;

      case 'response_chunk':
      case 'response_snapshot':
        flushSearches();
        if (streamingStart === null) streamingStart = msg.timestamp;
        streamingCount++;
        if (p.sourceCount) lastSnapshotSources = p.sourceCount;
        break;

      case 'response_final':
        flushSearches();
        flushStreaming(msg.timestamp);
        steps.push({
          id: msg.id,
          type: 'response',
          label: 'Final Response',
          detail: p.responseText
            ? p.responseText.slice(0, 150) + (p.responseText.length > 150 ? '...' : '')
            : 'Response complete',
          timestamp: msg.timestamp,
          duration,
          icon: '✅',
          color: 'var(--accent)',
          sourceCount: p.sourceCount || p.sources?.length,
          suggestedCount: p.suggestedResponses?.length,
          message: msg,
        });
        break;

      case 'conversation_state':
        flushSearches();
        flushStreaming(msg.timestamp);
        steps.push({
          id: msg.id,
          type: 'state',
          label: 'Conversation State',
          detail: [
            p.defaultChatName ? `"${p.defaultChatName}"` : null,
            p.sensitivityLabel ? `[${p.sensitivityLabel.displayName}]` : null,
            p.turnState,
          ].filter(Boolean).join(' — '),
          timestamp: msg.timestamp,
          icon: '💬',
          color: 'var(--accent)',
          sourceCount: p.sourceCount,
          message: msg,
        });
        break;

      case 'plugin_call':
      case 'plugin_response':
        flushSearches();
        flushStreaming(msg.timestamp);
        steps.push({
          id: msg.id,
          type: 'plugin',
          label: p.type === 'plugin_call' ? 'Plugin Call' : 'Plugin Response',
          detail: p.pluginName || 'Unknown plugin',
          timestamp: msg.timestamp,
          duration,
          icon: '🔌',
          color: 'var(--plugin-color)',
          message: msg,
        });
        break;

      case 'disengaged':
        flushSearches();
        flushStreaming(msg.timestamp);
        steps.push({
          id: msg.id,
          type: 'error',
          label: 'Disengaged',
          detail: p.errorMessage || 'Copilot disengaged',
          timestamp: msg.timestamp,
          icon: '⛔',
          color: 'var(--danger)',
          message: msg,
        });
        break;

      case 'throttling':
        // Show throttling at start
        if (steps.length <= 1) {
          steps.push({
            id: msg.id,
            type: 'state',
            label: 'Throttling',
            detail: p.throttling ? `${p.throttling.current} / ${p.throttling.max} messages` : '',
            timestamp: msg.timestamp,
            icon: '⏱️',
            color: 'var(--text-muted)',
            message: msg,
          });
        }
        break;

      // Skip noise
      case 'references_complete':
      case 'completion':
      case 'diagnostics':
        break;
    }
  }

  flushSearches();
  flushStreaming(Date.now());

  // Calculate durations between steps
  for (let i = 0; i < steps.length - 1; i++) {
    if (!steps[i].duration) {
      steps[i].duration = steps[i + 1].timestamp - steps[i].timestamp;
    }
  }

  return steps;
}
