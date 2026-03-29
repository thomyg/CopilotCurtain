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
  firstPrompt?: string;
  defaultChatName?: string;           // from Type 2 StreamItem
  sensitivityLabel?: string;          // e.g. "Intern", "Allgemein"
  sensitivityColor?: string;          // e.g. "#3A96DD"
  isAgent?: boolean;                  // true if threadLevelGptId contains .declarativeAgent
  agentId?: string;                   // the agent ID from threadLevelGptId
  agentName?: string;                 // extracted agent display name if available
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
  clientInfo?: Record<string, unknown>;
  optionsSets?: string[];
  // Agent detection
  agentId?: string;                    // threadLevelGptId.id
  isAgent?: boolean;                   // true if .declarativeAgent in agentId
  // Search / Progress
  searchQuery?: string;
  searchScope?: string;
  searchResultCount?: number;
  searchResults?: CopilotSource[];
  progressText?: string;                // "OK, I'll search for..."
  // Response
  responseText?: string;
  rawTextWithMarkers?: string;
  adaptiveCards?: object[];
  suggestedResponses?: Array<{ text: string; hiddenText?: string }>;
  // Streaming
  writeAtCursor?: string;               // Delta token text
  streamingMode?: 'Full' | 'Delta';
  // Plugin
  pluginName?: string;
  pluginRequest?: object;
  pluginResponse?: object;
  // Sources / Grounding
  sources?: CopilotSource[];
  sourceCount?: number;                 // Running count during streaming
  // Conversation state (from Type 2)
  defaultChatName?: string;             // Auto-generated conversation title
  sensitivityLabel?: { displayName: string; color: string; tooltip?: string };
  turnState?: string;                   // "Completed"
  serviceVersion?: string;
  // Throttling
  throttling?: { max: number; current: number };
  // Diagnostics
  contentOrigin?: string;
  diagnosticData?: Record<string, unknown>;
  // Metrics
  timestamps?: Record<string, string>;
  // Error / Disengaged
  errorMessage?: string;
}

export type CopilotMessageType =
  | 'user_prompt'
  | 'search_progress'       // Progress message with contentType=SearchResults
  | 'search_query'          // kept for backwards compat
  | 'search_results'        // kept for backwards compat
  | 'response_chunk'        // writeAtCursor delta token
  | 'response_snapshot'     // Full snapshot with accumulated text + growing sourceAttributions
  | 'response_final'        // Final complete message with all sources + suggestedResponses
  | 'references_complete'   // ReferencesListComplete signal
  | 'conversation_state'    // Type 2 StreamItem — full conversation state
  | 'throttling'            // Throttling info frame
  | 'suggested_responses'   // Follow-up suggestions
  | 'plugin_call'
  | 'plugin_response'
  | 'diagnostics'
  | 'metrics'               // Client timing telemetry
  | 'disengaged'
  | 'handshake'
  | 'completion'            // Type 3 — stream done
  | 'unknown';

export interface CopilotSource {
  title: string;
  url?: string;
  type: 'file' | 'email' | 'chat' | 'web' | 'meeting' | 'event' | 'person' | 'unknown';
  snippet?: string;
  relevanceScore?: number;
  // Rich metadata from referenceMetadata (parsed from CITATION)
  sourceType?: 'CITATION' | 'ANNOTATION';
  referenceType?: number;          // 0=PPT, 1=XLS, 2=DOC, 3=OneNote, 4=Outlook, 5=Teams, 7=Meeting, 9=SP, 10=Web, 11=PDF
  fileType?: string;               // Human-readable: "PowerPoint", "Word", etc.
  dataSource?: string;             // "Exchange", "OneDriveBusiness", "Teams", "SharePoint"
  context?: string;                // "With Thomas Golles", "modified on 3/9/2026"
  authorName?: string;
  authorEmail?: string;
  citationRefId?: string;          // "turn1search30" — maps to citeturn references in text
  isCitedInResponse?: boolean;
  // For ANNOTATION type (People, Events)
  annotationType?: string;         // "People", "Event"
  personName?: string;
  personEmail?: string;
  eventSubject?: string;
  eventStart?: string;
}

// referenceType → human-readable file type mapping
export const REFERENCE_TYPE_MAP: Record<number, string> = {
  0: 'PowerPoint',
  1: 'Excel',
  2: 'Word',
  3: 'OneNote',
  4: 'Email',
  5: 'Teams Chat',
  7: 'Meeting',
  9: 'SharePoint',
  10: 'Web',
  11: 'PDF',
  15: 'Image',
  17: 'Video',
  20: 'Third Party',
  24: 'Loop',
};

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
  | { type: 'GET_CONVERSATION_MESSAGES'; conversationId: string; tabId?: number; conversationIds?: string[] }
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
