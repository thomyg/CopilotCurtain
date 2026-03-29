import React, { useEffect } from 'react';
import type { CopilotConversation } from '../../shared/types';
import { useStore, useFetchConversations } from '../hooks/useStore';

interface Props {
  onSelect: (conv: CopilotConversation) => void;
  selectedId: string | null;
}

export default function ConversationList({ onSelect, selectedId }: Props) {
  const conversations = useStore((s) => s.conversations);
  const fetchConversations = useFetchConversations();

  useEffect(() => {
    fetchConversations();
    const i = setInterval(fetchConversations, 3000);
    return () => clearInterval(i);
  }, [fetchConversations]);

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-4">
        <div className="text-center">
          <div className="text-4xl mb-3">🤖</div>
          <div className="font-medium">No Copilot conversations yet</div>
          <div className="text-xs mt-2 text-gray-600">
            Enable WebSocket capture and open M365 Copilot.<br />
            Conversations will appear here in real-time.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => onSelect(conv)}
          className={`px-3 py-2.5 cursor-pointer border-b transition-all ${
            selectedId === conv.id
              ? 'bg-purple-900/20 border-l-2 border-l-purple-500'
              : 'border-transparent hover:bg-gray-800/30'
          }`}
          style={{ borderBottomColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-purple-400 text-xs">🤖</span>
              <span className="text-xs font-medium text-gray-200">{conv.surface}</span>
            </div>
            <span className="text-xs text-gray-500">{formatTime(conv.startedAt)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-400 truncate max-w-[180px]">{conv.tabTitle || conv.tabUrl}</span>
            <span className="text-xs text-gray-500">{conv.messageCount} msgs</span>
          </div>
        </div>
      ))}
    </div>
  );
}
