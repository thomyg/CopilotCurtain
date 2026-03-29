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
  'copilot-chat': { label: 'Copilot Chat', color: '#7c3aed', emoji: '🤖' },
  'plugin-config': { label: 'Plugin Config', color: '#f59e0b', emoji: '🔌' },
  'plugin-api': { label: 'Plugin API', color: '#10b981', emoji: '🔌' },
  'graph-copilot': { label: 'Graph', color: '#3b82f6', emoji: '📊' },
  'substrate-search': { label: 'Substrate Search', color: '#ec4899', emoji: '🔍' },
  'auth': { label: 'Auth', color: '#6b7280', emoji: '🔑' },
  'other': { label: 'Other', color: '#475569', emoji: '📡' },
};

// Copilot message type display
export const MESSAGE_TYPE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  user_prompt: { label: 'User Prompt', color: '#60a5fa', emoji: '🧑' },
  search_query: { label: 'Search Query', color: '#ec4899', emoji: '🔍' },
  search_results: { label: 'Search Results', color: '#a78bfa', emoji: '📄' },
  response_chunk: { label: 'Response (streaming)', color: '#7c3aed', emoji: '🤖' },
  response_final: { label: 'Response (final)', color: '#7c3aed', emoji: '✅' },
  plugin_call: { label: 'Plugin Call', color: '#10b981', emoji: '🔌' },
  plugin_response: { label: 'Plugin Response', color: '#34d399', emoji: '📥' },
  diagnostics: { label: 'Diagnostics', color: '#f59e0b', emoji: '🔧' },
  disengaged: { label: 'Disengaged', color: '#ef4444', emoji: '⛔' },
  handshake: { label: 'Handshake', color: '#6b7280', emoji: '🤝' },
  unknown: { label: 'Unknown', color: '#475569', emoji: '❓' },
};
