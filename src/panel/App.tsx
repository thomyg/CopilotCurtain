import React, { useState, useCallback } from 'react';
import { useStore, useLiveStream, useMonitorStatus } from './hooks/useStore';
import type { CopilotConversation } from '../shared/types';
import ConversationList from './components/ConversationList';
import ConversationTimeline from './components/ConversationTimeline';
import ConversationFlow from './components/ConversationFlow';
import PluginDashboard from './components/PluginDashboard';
import HttpTraffic from './components/HttpTraffic';

type View = 'conversations' | 'flow' | 'plugins' | 'http';

export default function App() {
  const [view, setView] = useState<View>('conversations');
  const [selectedConv, setSelectedConv] = useState<CopilotConversation | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const monitorState = useStore((s) => s.monitorState);

  useLiveStream();
  useMonitorStatus();

  const toggleHttp = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'TOGGLE_HTTP_MONITOR', enabled: !monitorState.httpEnabled });
  }, [monitorState.httpEnabled]);

  const toggleWs = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'TOGGLE_WS_MONITOR', enabled: !monitorState.wsEnabled });
  }, [monitorState.wsEnabled]);

  const navItems: { id: View; label: string; emoji: string }[] = [
    { id: 'conversations', label: 'Timeline', emoji: '🤖' },
    { id: 'flow', label: 'Flow', emoji: '⚡' },
    { id: 'plugins', label: 'Plugins', emoji: '🔌' },
    { id: 'http', label: 'HTTP', emoji: '📡' },
  ];

  // Shared conversation picker for both conversations and flow views
  const showConvList = view === 'conversations' || view === 'flow';

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Left sidebar nav */}
      <div
        className="w-11 flex flex-col items-center py-2 gap-1"
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { setView(item.id); if (!showConvList) setSelectedConv(null); }}
            className="w-8 h-8 rounded flex items-center justify-center text-sm transition-all"
            style={{
              background: view === item.id ? 'var(--accent-bg)' : 'transparent',
              color: view === item.id ? 'var(--accent-text)' : 'var(--text-muted)',
            }}
            title={item.label}
          >
            {item.emoji}
          </button>
        ))}

        <div className="flex-1" />

        {/* Capture toggles */}
        <div className="flex flex-col items-center gap-1.5 mb-2">
          <button
            onClick={toggleWs}
            className="rounded flex items-center justify-center transition-all"
            style={{
              width: '34px', height: '20px', fontSize: '9px', fontWeight: 600,
              background: monitorState.wsEnabled ? 'var(--accent-bg)' : 'transparent',
              color: monitorState.wsEnabled ? 'var(--accent-text)' : 'var(--text-muted)',
              border: `1px solid ${monitorState.wsEnabled ? 'var(--accent)' : 'var(--border)'}`,
            }}
            title={monitorState.wsEnabled ? 'WebSocket capture ON — click to stop' : 'WebSocket capture OFF — click to start'}
          >
            WS
          </button>
          <button
            onClick={toggleHttp}
            className="rounded flex items-center justify-center transition-all"
            style={{
              width: '34px', height: '20px', fontSize: '9px', fontWeight: 600,
              background: monitorState.httpEnabled ? 'var(--success-bg)' : 'transparent',
              color: monitorState.httpEnabled ? 'var(--success)' : 'var(--text-muted)',
              border: `1px solid ${monitorState.httpEnabled ? 'var(--success)' : 'var(--border)'}`,
            }}
            title={monitorState.httpEnabled ? 'HTTP capture ON — click to stop' : 'HTTP capture OFF — click to start'}
          >
            HTTP
          </button>
        </div>
      </div>

      {/* Main content */}
      {showConvList && (
        <div className="flex-1 flex">
          {/* Conversation list */}
          <div className="w-60 flex flex-col" style={{ borderRight: '1px solid var(--border)' }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>CopilotCurtain</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await chrome.runtime.sendMessage({ type: 'CLEAR_DATA' });
                    setSelectedConv(null);
                    setGroupIds([]);
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded transition-all"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  title="Clear all captured data"
                >
                  Clear
                </button>
                {monitorState.wsEnabled && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--accent-text)' }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse-live" style={{ background: 'var(--accent)' }} />
                    Live
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 px-3 py-1.5 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--accent-text)' }}>{monitorState.conversationCount} convs</span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ color: 'var(--text-secondary)' }}>{monitorState.messageCount} msgs</span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ color: 'var(--plugin-color)' }}>{monitorState.pluginInvocationCount} plugins</span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ color: 'var(--search-color)' }}>{monitorState.searchQueryCount} searches</span>
            </div>

            <ConversationList
              onSelect={(conv, ids) => { setSelectedConv(conv); setGroupIds(ids); }}
              selectedId={selectedConv?.id || null}
            />
          </div>

          {/* Right side: Timeline or Flow */}
          <div className="flex-1">
            {selectedConv ? (
              view === 'flow'
                ? <ConversationFlow conversation={selectedConv} groupIds={groupIds} />
                : <ConversationTimeline conversation={selectedConv} groupIds={groupIds} />
            ) : (
              <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
                <div className="text-center max-w-xs">
                  <div className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>CopilotCurtain</div>
                  <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {!monitorState.wsEnabled
                      ? <span>Click <strong style={{ color: 'var(--accent-text)' }}>WS</strong> to start capturing WebSocket traffic.</span>
                      : <span>Open M365 Copilot in another tab. Conversations will appear in real-time.</span>
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'plugins' && <div className="flex-1"><PluginDashboard /></div>}
      {view === 'http' && <div className="flex-1"><HttpTraffic /></div>}
    </div>
  );
}
