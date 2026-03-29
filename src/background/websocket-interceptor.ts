import type { CopilotWSMessage, CopilotConversation, CopilotSurface } from '../shared/types';
import { COPILOT_WS_PATTERN, SURFACE_PATTERNS } from '../shared/constants';
import { decodeFrame } from './copilot-decoder';

// Track attached tabs
const attachedTabs = new Set<number>();

// Map Chrome's requestId → our conversationId
const socketConversations = new Map<string, string>();

// Active conversations
const conversations = new Map<string, CopilotConversation>();

// Callbacks
let onNewMessage: ((msg: CopilotWSMessage) => void) | null = null;
let onConversationUpdate: ((conv: CopilotConversation) => void) | null = null;

export function setOnNewMessage(cb: (msg: CopilotWSMessage) => void) {
  onNewMessage = cb;
}

export function setOnConversationUpdate(cb: (conv: CopilotConversation) => void) {
  onConversationUpdate = cb;
}

export function getConversations(): CopilotConversation[] {
  return Array.from(conversations.values()).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

// ---- Tab management ----

function detectSurface(url: string): CopilotSurface {
  for (const { pattern, surface } of SURFACE_PATTERNS) {
    if (pattern.test(url)) return surface;
  }
  return 'Unknown';
}

async function getTabInfo(tabId: number): Promise<{ url: string; title: string }> {
  try {
    if (tabId < 0) return { url: '', title: '' };
    const tab = await chrome.tabs.get(tabId);
    return { url: tab.url || '', title: tab.title || '' };
  } catch {
    return { url: '', title: '' };
  }
}

// ---- Debugger management ----

export function attachToTab(tabId: number) {
  if (attachedTabs.has(tabId)) return;

  chrome.debugger.attach({ tabId }, '1.3', () => {
    if (chrome.runtime.lastError) {
      // Common: user denied debugger, tab closed, etc.
      console.warn('[CopilotCurtain] Debugger attach failed:', chrome.runtime.lastError.message);
      return;
    }

    attachedTabs.add(tabId);
    chrome.debugger.sendCommand({ tabId }, 'Network.enable', {});
    console.log(`[CopilotCurtain] Debugger attached to tab ${tabId}`);
  });
}

export function detachFromTab(tabId: number) {
  if (!attachedTabs.has(tabId)) return;

  chrome.debugger.detach({ tabId }, () => {
    if (chrome.runtime.lastError) {
      // Tab may already be closed
    }
  });
  attachedTabs.delete(tabId);

  // Clean up socket mappings
  for (const [requestId, convId] of socketConversations) {
    // Remove sockets from this tab (we can't easily track which tab owns which socket)
    // They'll be cleaned up naturally
  }
}

export function detachAll() {
  for (const tabId of attachedTabs) {
    detachFromTab(tabId);
  }
}

export function isAttached(tabId: number): boolean {
  return attachedTabs.has(tabId);
}

export function getAttachedTabs(): number[] {
  return Array.from(attachedTabs);
}

// ---- Orphan socket adoption ----
// When the debugger attaches after a WebSocket is already open, we never get
// Network.webSocketCreated. Detect Copilot traffic by inspecting frame content
// and create a conversation on-the-fly.

const rejectedRequestIds = new Set<string>();

function looksLikeCopilotFrame(raw: string): boolean {
  if (!raw) return false;
  // SignalR frames use Record Separator (0x1E) delimiter
  const hasRecordSeparator = raw.includes('\x1e');
  // Check for Copilot-specific JSON structure
  try {
    const cleaned = raw.split('\x1e').filter(Boolean)[0];
    if (!cleaned) return hasRecordSeparator;
    const json = JSON.parse(cleaned);
    // SignalR handshake
    if (json.protocol && json.version) return true;
    // SignalR hub invocation (target: "chat" or arguments with Copilot structure)
    if (json.target === 'chat') return true;
    // Streaming messages with arguments containing messages array
    if (json.type && json.arguments?.[0]?.messages) return true;
    // Type 1-7 are SignalR message types
    if (hasRecordSeparator && typeof json.type === 'number' && json.type >= 1 && json.type <= 7) return true;
  } catch {
    // Not JSON — could be binary MessagePack; accept if it has record separators
  }
  return false;
}

function tryAdoptOrphanSocket(tabId: number, requestId: string, raw: string): string | undefined {
  if (rejectedRequestIds.has(requestId)) return undefined;

  if (!looksLikeCopilotFrame(raw)) {
    rejectedRequestIds.add(requestId);
    return undefined;
  }

  // This looks like Copilot traffic — create a conversation
  const conversationId = crypto.randomUUID();
  socketConversations.set(requestId, conversationId);

  getTabInfo(tabId).then(({ url: tabUrl, title: tabTitle }) => {
    const conversation: CopilotConversation = {
      id: conversationId,
      tabId,
      tabUrl,
      tabTitle,
      startedAt: Date.now(),
      lastMessageAt: Date.now(),
      messageCount: 0,
      surface: detectSurface(tabUrl),
    };
    conversations.set(conversationId, conversation);

    if (onConversationUpdate) {
      onConversationUpdate(conversation);
    }

    console.log(`[CopilotCurtain] Adopted pre-existing Copilot WebSocket (requestId=${requestId})`);
  });

  return conversationId;
}

// ---- Redact tokens from WebSocket URL ----

function redactWsUrl(url: string): string {
  return url.replace(/access_token=[^&]+/, 'access_token=[REDACTED]');
}

// ---- CDP Event Handling ----

function handleWebSocketCreated(tabId: number, params: any) {
  const url = params.url || '';

  // Only track Copilot WebSocket connections
  if (!COPILOT_WS_PATTERN.test(url)) return;

  const conversationId = crypto.randomUUID();
  socketConversations.set(params.requestId, conversationId);

  getTabInfo(tabId).then(({ url: tabUrl, title: tabTitle }) => {
    const conversation: CopilotConversation = {
      id: conversationId,
      tabId,
      tabUrl,
      tabTitle,
      startedAt: Date.now(),
      lastMessageAt: Date.now(),
      messageCount: 0,
      surface: detectSurface(tabUrl),
    };
    conversations.set(conversationId, conversation);

    if (onConversationUpdate) {
      onConversationUpdate(conversation);
    }

    console.log(`[CopilotCurtain] Copilot WebSocket opened: ${redactWsUrl(url)}`);
  });
}

function handleFrameSent(tabId: number, params: any) {
  let conversationId = socketConversations.get(params.requestId);

  if (!conversationId) {
    // WebSocket was open before debugger attached — try to adopt it
    conversationId = tryAdoptOrphanSocket(tabId, params.requestId, params.response?.payloadData || '');
    if (!conversationId) return;
  }

  const raw = params.response?.payloadData || '';
  processFrame(conversationId, tabId, raw, 'sent');
}

function handleFrameReceived(tabId: number, params: any) {
  let conversationId = socketConversations.get(params.requestId);

  if (!conversationId) {
    // WebSocket was open before debugger attached — try to adopt it
    conversationId = tryAdoptOrphanSocket(tabId, params.requestId, params.response?.payloadData || '');
    if (!conversationId) return;
  }

  const raw = params.response?.payloadData || '';
  processFrame(conversationId, tabId, raw, 'received');
}

function processFrame(conversationId: string, tabId: number, raw: string, direction: 'sent' | 'received') {
  if (!raw || raw.length === 0) return;

  const decoded = decodeFrame(raw, direction);

  for (const frame of decoded) {
    // Skip pings/handshakes for cleaner output (but still record handshakes)
    if (frame.parsed.type === 'unknown' && frame.messageType === 7) continue;

    const message: CopilotWSMessage = {
      id: crypto.randomUUID(),
      conversationId,
      timestamp: Date.now(),
      direction,
      tabId,
      rawPayload: raw.length > 500000 ? raw.slice(0, 500000) + '\n[TRUNCATED]' : raw,
      messageType: frame.messageType,
      parsed: frame.parsed,
    };

    // Update conversation
    const conversation = conversations.get(conversationId);
    if (conversation) {
      conversation.lastMessageAt = Date.now();
      conversation.messageCount++;

      // Capture first user prompt as conversation name + agent detection
      if (frame.parsed.type === 'user_prompt') {
        if (!conversation.firstPrompt && frame.parsed.promptText) {
          conversation.firstPrompt = frame.parsed.promptText;
        }
        if (frame.parsed.isAgent) {
          conversation.isAgent = true;
          conversation.agentId = frame.parsed.agentId;
        }
      }

      // Capture defaultChatName and sensitivity from Type 2 conversation_state
      if (frame.parsed.type === 'conversation_state') {
        if (frame.parsed.defaultChatName) {
          conversation.defaultChatName = frame.parsed.defaultChatName;
        }
        if (frame.parsed.sensitivityLabel) {
          conversation.sensitivityLabel = frame.parsed.sensitivityLabel.displayName;
          conversation.sensitivityColor = frame.parsed.sensitivityLabel.color;
        }
      }
      if (onConversationUpdate) {
        onConversationUpdate(conversation);
      }
    }

    // Notify listeners
    if (onNewMessage) {
      onNewMessage(message);
    }
  }
}

function handleWebSocketClosed(tabId: number, params: any) {
  const conversationId = socketConversations.get(params.requestId);
  if (conversationId) {
    console.log(`[CopilotCurtain] Copilot WebSocket closed (conversation ${conversationId})`);
    socketConversations.delete(params.requestId);
  }
}

// ---- Debugger event listener ----

function onDebuggerEvent(source: chrome.debugger.Debuggee, method: string, params: any) {
  if (!source.tabId) return;

  switch (method) {
    case 'Network.webSocketCreated':
      handleWebSocketCreated(source.tabId, params);
      break;
    case 'Network.webSocketFrameSent':
      handleFrameSent(source.tabId, params);
      break;
    case 'Network.webSocketFrameReceived':
      handleFrameReceived(source.tabId, params);
      break;
    case 'Network.webSocketClosed':
      handleWebSocketClosed(source.tabId, params);
      break;
  }
}

// ---- Start / Stop ----

let isListening = false;

export function startWebSocketCapture() {
  if (isListening) return;

  chrome.debugger.onEvent.addListener(onDebuggerEvent);
  chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId) {
      attachedTabs.delete(source.tabId);
    }
  });

  isListening = true;
  console.log('[CopilotCurtain] WebSocket capture started');
}

export function stopWebSocketCapture() {
  if (!isListening) return;

  chrome.debugger.onEvent.removeListener(onDebuggerEvent);
  detachAll();

  isListening = false;
  console.log('[CopilotCurtain] WebSocket capture stopped');
}

// ---- Auto-attach to Copilot tabs ----

export function autoAttachCopilotTabs() {
  // Attach to tabs that are likely running Copilot
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        const surface = detectSurface(tab.url);
        if (surface !== 'Unknown') {
          attachToTab(tab.id);
        }
      }
    }
  });
}

// Listen for new tabs / navigation to Copilot pages
export function watchForCopilotTabs() {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && isListening) {
      const surface = detectSurface(tab.url);
      if (surface !== 'Unknown') {
        attachToTab(tabId);
      }
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    if (attachedTabs.has(tabId)) {
      attachedTabs.delete(tabId);
      // Clean up socket mappings
      for (const [requestId, convId] of socketConversations) {
        // Can't determine tab from requestId alone, but the socket will be dead
      }
    }
  });
}
