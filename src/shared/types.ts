// ============================================================
// Core Copilot types
// ============================================================

// ---- Copilot Conversation ----

export interface CopilotConversation {
  id: string;
  tabId: number;
  tabUrl: string;
  tabTitle: string;
  startedAt: number;
  lastMessageAt: number;
  messageCount: number;
  surface: CopilotSurface;
}

export type CopilotSurface = 'M365 Chat' | 'Teams' | 'Word' | 'Excel' | 'PowerPoint' | 'Outlook' | 'SharePoint' | 'Unknown';

// ---- WebSocket Messages ----

export interface CopilotWSMessage {
  id: string;
  conversationId: string;
  timestamp: number;
  direction: 'sent' | 'received';
  tabId: number;
  rawPayload: string;
  messageType: number;             // 1 = streaming chunk, 2 = final, etc.
  parsed: CopilotParsedMessage;
}

export interface CopilotParsedMessage {
  type: CopilotMessageType;
  // User prompt
  promptText?: string;
  enabledPlugins?: string[];
  // Search
  searchQuery?: string;
  searchScope?: string;
  searchResultCount?: number;
  searchResults?: CopilotSource[];
  // Response
  responseText?: string;
  rawTextWithMarkers?: string;
  adaptiveCards?: object[];
  // Plugin
  pluginName?: string;
  pluginRequest?: object;
  pluginResponse?: object;
  // Sources / Grounding
  sources?: CopilotSource[];
  // Diagnostics
  contentOrigin?: string;
  diagnosticData?: Record<string, unknown>;
  // Error / Disengaged
  errorMessage?: string;
}

export type CopilotMessageType =
  | 'user_prompt'
  | 'search_query'
  | 'search_results'
  | 'response_chunk'
  | 'response_final'
  | 'plugin_call'
  | 'plugin_response'
  | 'diagnostics'
  | 'disengaged'
  | 'handshake'
  | 'unknown';

export interface CopilotSource {
  title: string;
  url?: string;
  type: 'file' | 'email' | 'chat' | 'web' | 'meeting' | 'unknown';
  snippet?: string;
  relevanceScore?: number;
}

// ---- Plugins ----

export interface CopilotPlugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
  type: 'api' | 'graph-connector' | 'declarative-agent' | 'first-party' | 'unknown';
  firstSeenAt: number;
  lastSeenAt: number;
}

export interface PluginInvocation {
  id: string;
  timestamp: number;
  conversationId: string;
  pluginId: string;
  pluginName: string;
  userPrompt: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    timestamp: number;
  } | null;
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body?: string;
    timestamp: number;
    timeMs: number;
  } | null;
  grounding: {
    wasUsedInResponse: boolean;
    citationCount: number;
  } | null;
  status: 'selected' | 'invoked' | 'responded' | 'grounded' | 'failed' | 'timeout' | 'skipped';
  errorMessage?: string;
}

// ---- HTTP Requests (Copilot-related only) ----

export interface CapturedRequest {
  id: string;
  timestamp: number;
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  requestBody?: string | null;
  statusCode: number;
  responseHeaders: Record<string, string>;
  tabId: number;
  tabUrl: string;
  tabTitle: string;
  initiator: string;
  type: string;
  timeMs: number;
  category: RequestCategory;
  service: string;
  sessionId: string | null;
  parsedUrl: ParsedUrl;
}

export type RequestCategory =
  | 'copilot-chat'        // Copilot WebSocket upgrade / related HTTP
  | 'plugin-config'       // /userconfig endpoint
  | 'plugin-api'          // Plugin API calls
  | 'graph-copilot'       // Graph calls made by Copilot
  | 'substrate-search'    // Substrate search queries
  | 'auth'                // OAuth/token requests for Copilot
  | 'other';              // Other Microsoft traffic

export interface ParsedUrl {
  host: string;
  pathname: string;
  search: string;
  apiVersion?: string;
}

// ---- Sessions ----

export interface Session {
  id: string;
  name: string;
  startedAt: number;
  stoppedAt: number | null;
  messageCount: number;
  requestCount: number;
  notes: string;
}

// ---- Monitor State ----

export interface MonitorState {
  httpEnabled: boolean;
  wsEnabled: boolean;
  activeSessionId: string | null;
  activeSessionName: string | null;
  sessionStartedAt: number | null;
  conversationCount: number;
  messageCount: number;
  pluginInvocationCount: number;
  searchQueryCount: number;
}

// ---- Messages (Background ↔ Panel/Popup) ----

export type Message =
  | { type: 'TOGGLE_HTTP_MONITOR'; enabled: boolean }
  | { type: 'TOGGLE_WS_MONITOR'; enabled: boolean }
  | { type: 'START_SESSION'; name: string }
  | { type: 'STOP_SESSION' }
  | { type: 'MONITOR_STATUS' }
  | { type: 'MONITOR_STATUS_RESPONSE'; data: MonitorState }
  | { type: 'GET_CONVERSATIONS' }
  | { type: 'GET_CONVERSATIONS_RESPONSE'; data: CopilotConversation[] }
  | { type: 'GET_CONVERSATION_MESSAGES'; conversationId: string }
  | { type: 'GET_CONVERSATION_MESSAGES_RESPONSE'; data: CopilotWSMessage[] }
  | { type: 'GET_PLUGINS' }
  | { type: 'GET_PLUGINS_RESPONSE'; data: CopilotPlugin[] }
  | { type: 'GET_PLUGIN_INVOCATIONS'; pluginId?: string }
  | { type: 'GET_PLUGIN_INVOCATIONS_RESPONSE'; data: PluginInvocation[] }
  | { type: 'GET_REQUESTS'; offset: number; limit: number }
  | { type: 'GET_REQUESTS_RESPONSE'; data: CapturedRequest[]; total: number }
  | { type: 'GET_SESSIONS' }
  | { type: 'GET_SESSIONS_RESPONSE'; data: Session[] }
  | { type: 'EXPORT_SESSION'; sessionId: string; format: ExportFormat }
  | { type: 'CLEAR_DATA' }
  | { type: 'NEW_WS_MESSAGE'; data: CopilotWSMessage }
  | { type: 'NEW_REQUEST'; data: CapturedRequest }
  | { type: 'PLUGINS_UPDATED'; data: CopilotPlugin[] };

export type ExportFormat = 'json' | 'md';

// ---- Port message for live streaming ----

export interface PortMessage {
  type: 'WS_MESSAGE_BATCH' | 'REQUEST_BATCH' | 'PLUGIN_EVENT';
  messages?: CopilotWSMessage[];
  requests?: CapturedRequest[];
  plugin?: PluginInvocation;
}
