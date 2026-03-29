import React, { useEffect, useMemo } from 'react';
import type { CopilotConversation } from '../../shared/types';
import { useStore, useFetchConversations } from '../hooks/useStore';

interface Props {
  onSelect: (conv: CopilotConversation, groupIds: string[]) => void;
  selectedId: string | null;
}

// Group conversations that share the same defaultChatName (= same Copilot chat session).
// Ungrouped conversations (no defaultChatName) stay as individual entries.
interface ConversationGroup {
  key: string;
  displayName: string;
  conversations: CopilotConversation[];
  totalMessages: number;
  startedAt: number;
  lastMessageAt: number;
  surface: string;
  sensitivityLabel?: string;
  sensitivityColor?: string;
  isAgent?: boolean;
  primary: CopilotConversation;
}

export default function ConversationList({ onSelect, selectedId }: Props) {
  const conversations = useStore((s) => s.conversations);
  const fetchConversations = useFetchConversations();

  useEffect(() => {
    fetchConversations();
    const i = setInterval(fetchConversations, 3000);
    return () => clearInterval(i);
  }, [fetchConversations]);

  const groups = useMemo(() => {
    const byName = new Map<string, CopilotConversation[]>();
    const ungrouped: CopilotConversation[] = [];

    for (const conv of conversations) {
      if (conv.defaultChatName) {
        const key = conv.defaultChatName;
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key)!.push(conv);
      } else {
        ungrouped.push(conv);
      }
    }

    const result: ConversationGroup[] = [];

    // Named groups
    for (const [name, convs] of byName) {
      convs.sort((a, b) => a.startedAt - b.startedAt);
      const primary = convs.reduce((best, c) => c.messageCount > best.messageCount ? c : best, convs[0]);
      let sensitivityLabel: string | undefined;
      let sensitivityColor: string | undefined;
      for (const c of convs) {
        if (c.sensitivityLabel) { sensitivityLabel = c.sensitivityLabel; sensitivityColor = c.sensitivityColor; }
      }

      result.push({
        key: `named-${name}`,
        displayName: name,
        conversations: convs,
        totalMessages: convs.reduce((sum, c) => sum + c.messageCount, 0),
        startedAt: convs[0].startedAt,
        lastMessageAt: Math.max(...convs.map(c => c.lastMessageAt)),
        surface: convs[0].surface,
        sensitivityLabel,
        sensitivityColor,
        isAgent: convs.some(c => c.isAgent),
        primary,
      });
    }

    // Ungrouped — each is its own group
    for (const conv of ungrouped) {
      result.push({
        key: conv.id,
        displayName: conv.firstPrompt || conv.tabTitle || conv.tabUrl,
        conversations: [conv],
        totalMessages: conv.messageCount,
        startedAt: conv.startedAt,
        lastMessageAt: conv.lastMessageAt,
        surface: conv.surface,
        sensitivityLabel: conv.sensitivityLabel,
        sensitivityColor: conv.sensitivityColor,
        isAgent: conv.isAgent,
        primary: conv,
      });
    }

    // Sort by most recent
    result.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return result;
  }, [conversations]);

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  if (groups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4" style={{ color: 'var(--text-muted)' }}>
        <div className="text-center">
          <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No conversations yet</div>
          <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Enable WebSocket capture and open M365 Copilot.<br />
            Conversations will appear here in real-time.
          </div>
        </div>
      </div>
    );
  }

  const selectedGroupKey = selectedId
    ? groups.find(g => g.conversations.some(c => c.id === selectedId))?.key
    : null;

  return (
    <div className="flex-1 overflow-auto">
      {groups.map((group) => {
        const isSelected = group.key === selectedGroupKey;
        const turnCount = group.conversations.length;

        return (
          <div
            key={group.key}
            onClick={() => onSelect(group.primary, group.conversations.map(c => c.id))}
            className="px-3 py-2.5 cursor-pointer transition-all"
            style={{
              borderBottom: '1px solid var(--border-subtle)',
              background: isSelected ? 'var(--surface-selected)' : 'transparent',
              borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
            }}
            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{group.surface}</span>
                <span className="text-[10px] px-1 py-px rounded font-medium" style={{
                  background: group.isAgent ? 'var(--plugin-bg)' : 'var(--bg-tertiary)',
                  color: group.isAgent ? 'var(--plugin-color)' : 'var(--text-muted)',
                }}>
                  {group.isAgent ? 'Agent' : 'Mainline'}
                </span>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatTime(group.startedAt)}</span>
            </div>
            <div className="mt-1">
              <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
                {group.displayName.length > 55 ? group.displayName.slice(0, 55) + '...' : group.displayName}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {group.totalMessages} msgs{turnCount > 1 ? ` · ${turnCount} turns` : ''}
                </span>
                {group.sensitivityLabel && (
                  <span className="text-[10px] px-1 rounded" style={{
                    color: group.sensitivityColor || 'var(--text-muted)',
                    border: `1px solid ${group.sensitivityColor || 'var(--border)'}`,
                  }}>
                    {group.sensitivityLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
