import React, { useEffect, useState } from 'react';
import type { CopilotWSMessage, CopilotConversation } from '../../shared/types';
import { MESSAGE_TYPE_CONFIG } from '../../shared/constants';
import { useStore, useFetchMessages } from '../hooks/useStore';
import MessageDetail from './MessageDetail';

interface Props {
  conversation: CopilotConversation;
}

export default function ConversationTimeline({ conversation }: Props) {
  const messages = useStore((s) => s.messages);
  const fetchMessages = useFetchMessages();
  const [selectedMsg, setSelectedMsg] = useState<CopilotWSMessage | null>(null);

  useEffect(() => {
    fetchMessages(conversation.id);
    const i = setInterval(() => fetchMessages(conversation.id), 2000);
    return () => clearInterval(i);
  }, [conversation.id, fetchMessages]);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Filter out noise (handshakes, unknowns with no useful data)
  const meaningful = messages.filter((m) =>
    m.parsed.type !== 'handshake' && m.parsed.type !== 'unknown'
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
        <span className="text-purple-400">🤖</span>
        <span className="text-sm font-medium text-gray-200">{conversation.surface}</span>
        <span className="text-xs text-gray-500">—</span>
        <span className="text-xs text-gray-400 truncate">{conversation.tabTitle}</span>
        <div className="flex-1" />
        <span className="text-xs text-gray-500">{meaningful.length} events</span>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto p-3 space-y-1.5">
        {meaningful.length === 0 ? (
          <div className="text-center text-gray-500 text-xs py-8">
            Waiting for Copilot messages...
          </div>
        ) : (
          meaningful.map((msg) => {
            const config = MESSAGE_TYPE_CONFIG[msg.parsed.type] || MESSAGE_TYPE_CONFIG.unknown;
            const isSelected = selectedMsg?.id === msg.id;

            return (
              <div
                key={msg.id}
                className={`message-row flex gap-2 px-2 py-1.5 rounded cursor-pointer ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedMsg(isSelected ? null : msg)}
              >
                {/* Time */}
                <span className="text-xs text-gray-600 font-mono w-16 flex-shrink-0">
                  {formatTime(msg.timestamp)}
                </span>

                {/* Direction arrow */}
                <span className={`text-xs flex-shrink-0 ${msg.direction === 'sent' ? 'text-blue-400' : 'text-purple-400'}`}>
                  {msg.direction === 'sent' ? '→' : '←'}
                </span>

                {/* Type badge */}
                <span
                  className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ color: config.color, backgroundColor: `${config.color}15` }}
                >
                  {config.emoji} {config.label}
                </span>

                {/* Summary text */}
                <span className="text-xs text-gray-400 truncate">
                  {getSummary(msg)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Detail panel */}
      {selectedMsg && (
        <MessageDetail message={selectedMsg} onClose={() => setSelectedMsg(null)} />
      )}
    </div>
  );
}

function getSummary(msg: CopilotWSMessage): string {
  const p = msg.parsed;
  switch (p.type) {
    case 'user_prompt':
      return p.promptText || 'User prompt';
    case 'search_query':
      return `Query: "${p.searchQuery || '...'}"${p.searchScope ? ` (${p.searchScope})` : ''}`;
    case 'search_results':
      return `${p.searchResultCount || p.sources?.length || '?'} results found`;
    case 'response_chunk':
      return p.responseText ? p.responseText.slice(0, 100) + (p.responseText.length > 100 ? '...' : '') : 'Streaming...';
    case 'response_final':
      return 'Response complete';
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
