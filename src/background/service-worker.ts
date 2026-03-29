import type { Message, MonitorState, CopilotWSMessage, CapturedRequest, Session } from '../shared/types';
import { PORT_NAME, UI_BATCH_INTERVAL_MS } from '../shared/constants';
import {
  startWebSocketCapture,
  stopWebSocketCapture,
  autoAttachCopilotTabs,
  watchForCopilotTabs,
  setOnNewMessage,
  setOnConversationUpdate,
  getConversations as getWSConversations,
} from './websocket-interceptor';
import {
  startListeners,
  stopListeners,
  setMonitoring,
  setActiveSession,
  setOnNewRequest,
  setStoreCallback,
  getMonitoring,
  getActiveSessionId,
} from './http-interceptor';
import {
  storeRequests,
  storeWSMessage,
  storeConversation,
  getConversations,
  getConversationMessages,
  getPlugins,
  getPluginInvocations,
  getRequests,
  getSessions,
  storeSession,
  updateSession,
  clearAllData,
} from './storage';
import {
  onUserConfigResponse,
  onWSPluginEvent,
  onHttpRequest,
  setOnPluginsUpdated,
  setOnPluginInvocation,
  getKnownPlugins,
} from './plugin-tracker';

// ---- State ----

let wsEnabled = false;
let conversationCount = 0;
let messageCount = 0;
let pluginInvocationCount = 0;
let searchQueryCount = 0;
let sessionStartedAt: number | null = null;
let sessionName: string | null = null;

// ---- Connected ports ----

const connectedPorts = new Set<chrome.runtime.Port>();
let wsBatchBuffer: CopilotWSMessage[] = [];
let requestBatchBuffer: CapturedRequest[] = [];
let uiBatchTimer: ReturnType<typeof setTimeout> | null = null;

function pushToUI() {
  if (wsBatchBuffer.length === 0 && requestBatchBuffer.length === 0) return;
  const wsMessages = wsBatchBuffer.splice(0);
  const requests = requestBatchBuffer.splice(0);

  for (const port of connectedPorts) {
    try {
      if (wsMessages.length > 0) port.postMessage({ type: 'WS_MESSAGE_BATCH', messages: wsMessages });
      if (requests.length > 0) port.postMessage({ type: 'REQUEST_BATCH', requests });
    } catch { connectedPorts.delete(port); }
  }
}

function scheduleUIPush() {
  if (uiBatchTimer) return;
  uiBatchTimer = setTimeout(() => { uiBatchTimer = null; pushToUI(); }, UI_BATCH_INTERVAL_MS);
}

// ---- Wire up callbacks ----

// HTTP interceptor → storage
setStoreCallback(storeRequests);

// HTTP interceptor → UI + plugin tracker
setOnNewRequest((req: CapturedRequest) => {
  // Check if this is a userconfig response (to extract plugins)
  if (req.category === 'plugin-config' && req.requestBody) {
    // We capture the request body, but ideally we want the response body.
    // For now, the plugin registry will be populated from WebSocket diagnostics.
  }

  // Feed to plugin tracker
  onHttpRequest(req);

  // Buffer for UI
  if (connectedPorts.size > 0) {
    requestBatchBuffer.push(req);
    scheduleUIPush();
  }
});

// WebSocket interceptor → storage + UI + plugin tracker
setOnNewMessage((msg: CopilotWSMessage) => {
  messageCount++;

  // Track search queries
  if (msg.parsed.type === 'search_query' || msg.parsed.type === 'search_results') {
    searchQueryCount++;
  }

  // Feed to plugin tracker
  if (msg.parsed.type === 'plugin_call') {
    pluginInvocationCount++;
    onWSPluginEvent(msg);
  }

  // Store
  storeWSMessage(msg).catch(console.error);

  // Buffer for UI
  if (connectedPorts.size > 0) {
    wsBatchBuffer.push(msg);
    scheduleUIPush();
  }

  updateBadge();
});

setOnConversationUpdate((conv) => {
  conversationCount = getWSConversations().length;
  storeConversation(conv).catch(console.error);
  updateBadge();
});

setOnPluginsUpdated((plugins) => {
  for (const port of connectedPorts) {
    try { port.postMessage({ type: 'PLUGIN_EVENT', plugins }); } catch { connectedPorts.delete(port); }
  }
});

setOnPluginInvocation((inv) => {
  for (const port of connectedPorts) {
    try { port.postMessage({ type: 'PLUGIN_EVENT', plugin: inv }); } catch { connectedPorts.delete(port); }
  }
});

// ---- Badge ----

function updateBadge() {
  const active = getMonitoring() || wsEnabled || getActiveSessionId() !== null;

  if (!active) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  if (messageCount > 0) {
    chrome.action.setBadgeText({ text: messageCount > 999 ? '999+' : String(messageCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' }); // Copilot purple
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ---- Port connections ----

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT_NAME) return;
  connectedPorts.add(port);
  port.onDisconnect.addListener(() => connectedPorts.delete(port));
});

// ---- Message handling ----

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: Message): Promise<any> {
  switch (message.type) {
    case 'TOGGLE_HTTP_MONITOR': {
      setMonitoring(message.enabled);
      if (message.enabled) startListeners();
      else if (!getActiveSessionId()) stopListeners();
      await chrome.storage.local.set({ httpEnabled: message.enabled });
      updateBadge();
      return { success: true };
    }

    case 'TOGGLE_WS_MONITOR': {
      wsEnabled = message.enabled;
      if (message.enabled) {
        startWebSocketCapture();
        autoAttachCopilotTabs();
      } else {
        stopWebSocketCapture();
      }
      await chrome.storage.local.set({ wsEnabled: message.enabled });
      updateBadge();
      return { success: true };
    }

    case 'START_SESSION': {
      const session: Session = {
        id: crypto.randomUUID(),
        name: message.name,
        startedAt: Date.now(),
        stoppedAt: null,
        messageCount: 0,
        requestCount: 0,
        notes: '',
      };
      await storeSession(session);
      setActiveSession(session.id);
      sessionStartedAt = session.startedAt;
      sessionName = session.name;
      messageCount = 0;
      searchQueryCount = 0;
      pluginInvocationCount = 0;
      startListeners();
      if (wsEnabled) { startWebSocketCapture(); autoAttachCopilotTabs(); }
      await chrome.storage.local.set({ activeSessionId: session.id, sessionName: session.name, sessionStartedAt: session.startedAt });
      updateBadge();
      return { success: true, session };
    }

    case 'STOP_SESSION': {
      const sessionId = getActiveSessionId();
      if (sessionId) {
        await updateSession(sessionId, { stoppedAt: Date.now(), messageCount, requestCount: 0 });
      }
      setActiveSession(null);
      sessionStartedAt = null;
      sessionName = null;
      if (!getMonitoring()) stopListeners();
      await chrome.storage.local.remove(['activeSessionId', 'sessionName', 'sessionStartedAt']);
      updateBadge();
      return { success: true };
    }

    case 'MONITOR_STATUS': {
      const state: MonitorState = {
        httpEnabled: getMonitoring(),
        wsEnabled,
        activeSessionId: getActiveSessionId(),
        activeSessionName: sessionName,
        sessionStartedAt,
        conversationCount,
        messageCount,
        pluginInvocationCount,
        searchQueryCount,
      };
      return { type: 'MONITOR_STATUS_RESPONSE', data: state };
    }

    case 'GET_CONVERSATIONS': {
      const convs = await getConversations();
      return { type: 'GET_CONVERSATIONS_RESPONSE', data: convs };
    }

    case 'GET_CONVERSATION_MESSAGES': {
      const msgs = await getConversationMessages(message.conversationId);
      return { type: 'GET_CONVERSATION_MESSAGES_RESPONSE', data: msgs };
    }

    case 'GET_PLUGINS': {
      const plugins = await getPlugins();
      return { type: 'GET_PLUGINS_RESPONSE', data: plugins };
    }

    case 'GET_PLUGIN_INVOCATIONS': {
      const invocations = await getPluginInvocations(message.pluginId);
      return { type: 'GET_PLUGIN_INVOCATIONS_RESPONSE', data: invocations };
    }

    case 'GET_REQUESTS': {
      const result = await getRequests(message.offset, message.limit);
      return { type: 'GET_REQUESTS_RESPONSE', data: result.data, total: result.total };
    }

    case 'GET_SESSIONS': {
      const sessions = await getSessions();
      return { type: 'GET_SESSIONS_RESPONSE', data: sessions };
    }

    case 'CLEAR_DATA': {
      await clearAllData();
      messageCount = 0;
      conversationCount = 0;
      pluginInvocationCount = 0;
      searchQueryCount = 0;
      updateBadge();
      return { success: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// ---- Initialization ----

async function initialize() {
  const stored = await chrome.storage.local.get(['httpEnabled', 'wsEnabled', 'activeSessionId', 'sessionName', 'sessionStartedAt']);

  if (stored.httpEnabled) {
    setMonitoring(true);
    startListeners();
  }

  if (stored.wsEnabled) {
    wsEnabled = true;
    startWebSocketCapture();
    autoAttachCopilotTabs();
  }

  if (stored.activeSessionId) {
    setActiveSession(stored.activeSessionId);
    sessionName = stored.sessionName || null;
    sessionStartedAt = stored.sessionStartedAt || null;
    if (!stored.httpEnabled) startListeners();
  }

  // Watch for new tabs navigating to Copilot
  watchForCopilotTabs();

  updateBadge();
  console.log('[CopilotCurtain] Service worker initialized');
}

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

initialize();
