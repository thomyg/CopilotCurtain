import React, { useState, useCallback } from 'react';
import { useStore, useLiveStream, useMonitorStatus } from './hooks/useStore';
import type { CopilotConversation } from '../shared/types';
import ConversationList from './components/ConversationList';
import ConversationTimeline from './components/ConversationTimeline';
import PluginDashboard from './components/PluginDashboard';
import HttpTraffic from './components/HttpTraffic';

type View = 'conversations' | 'plugins' | 'http';

export default function App() {
  const [view, setView] = useState<View>('conversations');
  const [selectedConv, setSelectedConv] = useState<CopilotConversation | null>(null);
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
    { id: 'conversations', label: 'Copilot', emoji: '🤖' },
    { id: 'plugins', label: 'Plugins', emoji: '🔌' },
    { id: 'http', label: 'HTTP', emoji: '📡' },
  ];

  return (
    <div className="flex h-screen">
      {/* Left sidebar nav */}
      <div className="w-12 flex flex-col items-center py-2 gap-1 border-r" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { setView(item.id); setSelectedConv(null); }}
            className={`w-9 h-9 rounded flex items-center justify-center text-base transition-all ${
              view === item.id ? 'bg-purple-600/20 text-purple-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/30'
            }`}
            title={item.label}
          >
            {item.emoji}
          </button>
        ))}

        <div className="flex-1" />

        {/* Status indicators */}
        <div className="flex flex-col items-center gap-1.5 mb-2">
          <button
            onClick={toggleWs}
            className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${
              monitorState.wsEnabled ? 'bg-purple-600/30 text-purple-400 animate-copilot-glow' : 'text-gray-600 hover:text-gray-400'
            }`}
            title={monitorState.wsEnabled ? 'WebSocket capture ON' : 'WebSocket capture OFF'}
          >
            WS
          </button>
          <button
            onClick={toggleHttp}
            className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${
              monitorState.httpEnabled ? 'bg-blue-600/30 text-blue-400' : 'text-gray-600 hover:text-gray-400'
            }`}
            title={monitorState.httpEnabled ? 'HTTP capture ON' : 'HTTP capture OFF'}
          >
            H
          </button>
        </div>
      </div>

      {/* Main content */}
      {view === 'conversations' && (
        <div className="flex-1 flex">
          {/* Conversation list */}
          <div className="w-64 border-r flex flex-col" style={{ borderColor: 'var(--border)' }}>
            <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-semibold text-gray-200">🤖 CopilotCurtain</span>
              {monitorState.wsEnabled && (
                <span className="flex items-center gap-1 text-xs text-purple-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse-live" />
                  Live
                </span>
              )}
            </div>

            {/* Quick stats */}
            <div className="flex gap-1 px-3 py-1.5 border-b text-xs" style={{ borderColor: 'var(--border)' }}>
              <span className="text-purple-400">{monitorState.conversationCount} convs</span>
              <span className="text-gray-600">|</span>
              <span className="text-blue-400">{monitorState.messageCount} msgs</span>
              <span className="text-gray-600">|</span>
              <span className="text-green-400">{monitorState.pluginInvocationCount} plugins</span>
              <span className="text-gray-600">|</span>
              <span className="text-pink-400">{monitorState.searchQueryCount} searches</span>
            </div>

            <ConversationList onSelect={setSelectedConv} selectedId={selectedConv?.id || null} />
          </div>

          {/* Conversation detail */}
          <div className="flex-1">
            {selectedConv ? (
              <ConversationTimeline conversation={selectedConv} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                <div className="text-center max-w-xs">
                  <div className="text-5xl mb-4">🎭</div>
                  <div className="text-lg font-medium text-gray-300 mb-2">CopilotCurtain</div>
                  <div className="text-xs text-gray-500 leading-relaxed">
                    See exactly what M365 Copilot does behind the scenes.
                    <br /><br />
                    {!monitorState.wsEnabled ? (
                      <span>Click the <strong className="text-purple-400">WS</strong> button in the sidebar to start capturing Copilot WebSocket traffic.</span>
                    ) : (
                      <span>Open M365 Copilot in another tab and start a conversation. It will appear here in real-time.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'plugins' && (
        <div className="flex-1"><PluginDashboard /></div>
      )}

      {view === 'http' && (
        <div className="flex-1"><HttpTraffic /></div>
      )}
    </div>
  );
}
