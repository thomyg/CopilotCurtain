import type { RequestCategory, CopilotSurface } from './types';

// Port name for live streaming
export const PORT_NAME = 'copilot-curtain-live';

// DB settings
export const DB_NAME = 'copilot-curtain';
export const DB_VERSION = 1;

// Batch settings
export const WRITE_BATCH_SIZE = 50;
export const WRITE_BATCH_INTERVAL_MS = 500;
export const UI_BATCH_INTERVAL_MS = 200;

// Max body size to store (100KB)
export const MAX_BODY_SIZE = 100 * 1024;

// WebSocket URL pattern for Copilot
export const COPILOT_WS_PATTERN = /substrate\.office\.com\/m365chat\/SecuredChathub\//;

// URLs that indicate Copilot-related HTTP traffic
export const COPILOT_HTTP_PATTERNS: { pattern: RegExp; category: RequestCategory; service: string }[] = [
  // Plugin/userconfig
  {
    pattern: /substrate\.office\.com\/search\/api\/v1\/userconfig/,
    category: 'plugin-config',
    service: 'Copilot Plugin Config',
  },
  // Substrate search (used by Copilot for grounding)
  {
    pattern: /substrate\.office\.com\/search\/api\//,
    category: 'substrate-search',
    service: 'Substrate Search',
  },
  // Copilot chat HTTP endpoints
  {
    pattern: /substrate\.office\.com\/m365chat\//,
    category: 'copilot-chat',
    service: 'Copilot Chat',
  },
  // Substrate OWS used during Copilot grounding
  {
    pattern: /substrate\.office\.com\/ows\//,
    category: 'substrate-search',
    service: 'Substrate OWS',
  },
  // Graph calls that Copilot makes
  {
    pattern: /graph\.microsoft\.com\/.+/,
    category: 'graph-copilot',
    service: 'Microsoft Graph',
  },
  // OAuth/auth for Copilot
  {
    pattern: /login\.microsoftonline\.com\/.*\/oauth2/,
    category: 'auth',
    service: 'Microsoft Identity',
  },
  // Power Platform / Copilot Studio
  {
    pattern: /\.powerapps\.com\/api\//,
    category: 'plugin-api',
    service: 'Power Apps',
  },
  {
    pattern: /make\.powerautomate\.com\/api\//,
    category: 'plugin-api',
    service: 'Power Automate',
  },
];

// Map tab URLs to Copilot surfaces
export const SURFACE_PATTERNS: { pattern: RegExp; surface: CopilotSurface }[] = [
  { pattern: /microsoft365\.com\/chat/i, surface: 'M365 Chat' },
  { pattern: /m365\.cloud\.microsoft\/chat/i, surface: 'M365 Chat' },
  { pattern: /copilot\.microsoft\.com/i, surface: 'M365 Chat' },
  { pattern: /teams\.microsoft\.com/i, surface: 'Teams' },
  { pattern: /word\.cloud\.microsoft/i, surface: 'Word' },
  { pattern: /excel\.cloud\.microsoft/i, surface: 'Excel' },
  { pattern: /powerpoint\.cloud\.microsoft/i, surface: 'PowerPoint' },
  { pattern: /outlook\.office\.com/i, surface: 'Outlook' },
  { pattern: /outlook\.office365\.com/i, surface: 'Outlook' },
  { pattern: /\.sharepoint\.com/i, surface: 'SharePoint' },
];

// Sensitive headers to redact
export const SENSITIVE_HEADERS = ['authorization', 'x-ms-authorization', 'cookie', 'set-cookie'];
export const SENSITIVE_KEYWORDS = ['token', 'key', 'secret', 'password', 'credential'];

// Category display config
export const CATEGORY_CONFIG: Record<RequestCategory, { label: string; color: string; emoji: string }> = {
  'copilot-chat': { label: 'Copilot Chat', color: 'var(--accent)', emoji: '🤖' },
  'plugin-config': { label: 'Plugin Config', color: 'var(--warning)', emoji: '🔌' },
  'plugin-api': { label: 'Plugin API', color: 'var(--success)', emoji: '🔌' },
  'graph-copilot': { label: 'Graph', color: 'var(--accent)', emoji: '📊' },
  'substrate-search': { label: 'Substrate Search', color: 'var(--search-color)', emoji: '🔍' },
  'auth': { label: 'Auth', color: 'var(--text-muted)', emoji: '🔑' },
  'other': { label: 'Other', color: 'var(--text-muted)', emoji: '📡' },
};

// Copilot message type display
export const MESSAGE_TYPE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  user_prompt: { label: 'User Prompt', color: 'var(--prompt-color)', emoji: '🧑' },
  search_progress: { label: 'Search', color: 'var(--search-color)', emoji: '🔍' },
  search_query: { label: 'Search Query', color: 'var(--search-color)', emoji: '🔍' },
  search_results: { label: 'Search Results', color: 'var(--search-color)', emoji: '📄' },
  response_chunk: { label: 'Streaming', color: 'var(--text-secondary)', emoji: '✏️' },
  response_snapshot: { label: 'Snapshot', color: 'var(--text-secondary)', emoji: '📸' },
  response_final: { label: 'Response', color: 'var(--accent)', emoji: '✅' },
  references_complete: { label: 'Refs Complete', color: 'var(--text-muted)', emoji: '📚' },
  conversation_state: { label: 'Conv. State', color: 'var(--accent)', emoji: '💬' },
  throttling: { label: 'Throttling', color: 'var(--text-muted)', emoji: '⏱️' },
  suggested_responses: { label: 'Suggestions', color: 'var(--accent)', emoji: '💡' },
  plugin_call: { label: 'Plugin Call', color: 'var(--plugin-color)', emoji: '🔌' },
  plugin_response: { label: 'Plugin Response', color: 'var(--plugin-color)', emoji: '📥' },
  diagnostics: { label: 'Diagnostics', color: 'var(--warning)', emoji: '🔧' },
  metrics: { label: 'Metrics', color: 'var(--text-muted)', emoji: '📊' },
  disengaged: { label: 'Disengaged', color: 'var(--danger)', emoji: '⛔' },
  completion: { label: 'Complete', color: 'var(--text-muted)', emoji: '🏁' },
  handshake: { label: 'Handshake', color: 'var(--text-muted)', emoji: '🤝' },
  unknown: { label: 'Unknown', color: 'var(--text-muted)', emoji: '❓' },
};
