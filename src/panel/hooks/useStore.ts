import { useEffect, useRef, useCallback } from 'react';
import { create } from 'zustand';
import type { CopilotWSMessage, CopilotConversation, CopilotPlugin, PluginInvocation, CapturedRequest, MonitorState } from '../../shared/types';
import { PORT_NAME } from '../../shared/constants';

interface AppStore {
  // Monitor
  monitorState: MonitorState;
  setMonitorState: (s: MonitorState) => void;

  // Conversations & messages
  conversations: CopilotConversation[];
  setConversations: (c: CopilotConversation[]) => void;
  messages: CopilotWSMessage[];
  addMessages: (msgs: CopilotWSMessage[]) => void;
  setMessages: (msgs: CopilotWSMessage[]) => void;
  clearMessages: () => void;

  // Plugins
  plugins: CopilotPlugin[];
  setPlugins: (p: CopilotPlugin[]) => void;
  invocations: PluginInvocation[];
  setInvocations: (i: PluginInvocation[]) => void;

  // HTTP requests
  requests: CapturedRequest[];
  addRequests: (r: CapturedRequest[]) => void;
  setRequests: (r: CapturedRequest[]) => void;
}

export const useStore = create<AppStore>((set) => ({
  monitorState: {
    httpEnabled: false, wsEnabled: false,
    activeSessionId: null, activeSessionName: null, sessionStartedAt: null,
    conversationCount: 0, messageCount: 0, pluginInvocationCount: 0, searchQueryCount: 0,
  },
  setMonitorState: (monitorState) => set({ monitorState }),

  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  messages: [],
  addMessages: (msgs) => set((s) => ({ messages: [...s.messages, ...msgs].slice(-3000) })),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),

  plugins: [],
  setPlugins: (plugins) => set({ plugins }),
  invocations: [],
  setInvocations: (invocations) => set({ invocations }),

  requests: [],
  addRequests: (r) => set((s) => ({ requests: [...r, ...s.requests].slice(0, 3000) })),
  setRequests: (requests) => set({ requests }),
}));

// Live stream hook
export function useLiveStream() {
  const addMessages = useStore((s) => s.addMessages);
  const addRequests = useStore((s) => s.addRequests);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: PORT_NAME });

    port.onMessage.addListener((msg) => {
      if (msg.type === 'WS_MESSAGE_BATCH' && msg.messages) addMessages(msg.messages);
      if (msg.type === 'REQUEST_BATCH' && msg.requests) addRequests(msg.requests);
    });

    return () => port.disconnect();
  }, [addMessages, addRequests]);
}

// Monitor status sync
export function useMonitorStatus() {
  const setMonitorState = useStore((s) => s.setMonitorState);

  const refresh = useCallback(async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'MONITOR_STATUS' });
      if (res?.data) setMonitorState(res.data);
    } catch {}
  }, [setMonitorState]);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 2000);
    return () => clearInterval(i);
  }, [refresh]);

  return refresh;
}

// Fetch conversations
export function useFetchConversations() {
  const setConversations = useStore((s) => s.setConversations);

  return useCallback(async () => {
    const res = await chrome.runtime.sendMessage({ type: 'GET_CONVERSATIONS' });
    if (res?.data) setConversations(res.data);
  }, [setConversations]);
}

// Fetch messages for a conversation or a group of conversations
export function useFetchMessages() {
  const setMessages = useStore((s) => s.setMessages);

  return useCallback(async (conversationId: string, conversationIds?: string[]) => {
    const res = await chrome.runtime.sendMessage({
      type: 'GET_CONVERSATION_MESSAGES',
      conversationId,
      conversationIds,
    });
    if (res?.data) setMessages(res.data);
  }, [setMessages]);
}

// Fetch plugins
export function useFetchPlugins() {
  const setPlugins = useStore((s) => s.setPlugins);

  return useCallback(async () => {
    const res = await chrome.runtime.sendMessage({ type: 'GET_PLUGINS' });
    if (res?.data) setPlugins(res.data);
  }, [setPlugins]);
}

// Fetch plugin invocations
export function useFetchInvocations() {
  const setInvocations = useStore((s) => s.setInvocations);

  return useCallback(async (pluginId?: string) => {
    const res = await chrome.runtime.sendMessage({ type: 'GET_PLUGIN_INVOCATIONS', pluginId });
    if (res?.data) setInvocations(res.data);
  }, [setInvocations]);
}
