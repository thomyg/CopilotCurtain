import type { CopilotParsedMessage, CopilotMessageType, CopilotSource } from '../shared/types';

// The Copilot WebSocket protocol uses JSON messages
// separated by ASCII Record Separator (0x1E).
// Each frame may contain one or more JSON objects.

const RECORD_SEPARATOR = '\x1e';

export interface DecodedFrame {
  messageType: number;
  parsed: CopilotParsedMessage;
}

export function decodeFrame(raw: string, direction: 'sent' | 'received'): DecodedFrame[] {
  const parts = raw.split(RECORD_SEPARATOR).filter(Boolean);
  const results: DecodedFrame[] = [];

  for (const part of parts) {
    try {
      const json = JSON.parse(part);
      results.push({
        messageType: json.type ?? 0,
        parsed: direction === 'sent' ? parseSentMessage(json) : parseReceivedMessage(json),
      });
    } catch {
      results.push({
        messageType: 0,
        parsed: { type: 'unknown' },
      });
    }
  }

  return results;
}

// ---- Parse outbound messages (user → Copilot) ----

function parseSentMessage(json: any): CopilotParsedMessage {
  // Handshake message (protocol negotiation)
  if (json.protocol && json.version) {
    return {
      type: 'handshake',
      diagnosticData: { protocol: json.protocol, version: json.version },
    };
  }

  // User prompt message
  // Structure: { type: 4, invocationId: "0", target: "chat", arguments: [{ message: "...", plugins: [...] }] }
  // Also seen: { type: 1, target: "chat", arguments: [...] }
  if (json.arguments && Array.isArray(json.arguments)) {
    const args = json.arguments[0];
    if (args) {
      const prompt = extractPromptText(args);
      const plugins = extractPluginList(args);

      if (prompt) {
        return {
          type: 'user_prompt',
          promptText: prompt,
          enabledPlugins: plugins,
        };
      }
    }
  }

  return { type: 'unknown' };
}

function extractPromptText(args: any): string | undefined {
  // Try common paths for the user's message text
  if (typeof args.message === 'string') return args.message;
  if (args.message?.text) return args.message.text;
  if (args.message?.content) return args.message.content;
  if (args.userMessage) return args.userMessage;
  return undefined;
}

function extractPluginList(args: any): string[] {
  const plugins: string[] = [];
  // Try common paths for plugin configuration
  const pluginDefs = args.plugins || args.enabledPlugins || args.options?.plugins;
  if (Array.isArray(pluginDefs)) {
    for (const p of pluginDefs) {
      if (typeof p === 'string') plugins.push(p);
      else if (p.id) plugins.push(p.id);
      else if (p.name) plugins.push(p.name);
    }
  }
  return plugins;
}

// ---- Parse inbound messages (Copilot → user) ----

function parseReceivedMessage(json: any): CopilotParsedMessage {
  const msgType = json.type;

  // Type 1: streaming data (incremental response, search events, plugin events)
  if (msgType === 1) {
    return parseStreamingMessage(json);
  }

  // Type 2: final/completion message
  if (msgType === 2) {
    return {
      type: 'response_final',
      diagnosticData: json.item || json,
    };
  }

  // Type 3: error
  if (msgType === 3) {
    return {
      type: 'disengaged',
      errorMessage: json.error || 'Unknown error',
    };
  }

  // Type 6: handshake response
  if (msgType === 6) {
    return { type: 'handshake' };
  }

  // Type 7: keep-alive ping
  if (msgType === 7) {
    return { type: 'unknown' }; // Ignore pings
  }

  return { type: 'unknown' };
}

function parseStreamingMessage(json: any): CopilotParsedMessage {
  // Type 1 messages carry data in arguments[0].messages[]
  const args = json.arguments?.[0];
  if (!args) {
    return { type: 'response_chunk' };
  }

  const messages = args.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    // May be a throttling/progress indicator
    return { type: 'response_chunk' };
  }

  // Process each sub-message
  for (const msg of messages) {
    const contentOrigin = msg.contentOrigin || msg.author;

    // Search query event
    if (msg.messageType === 'InternalSearchQuery' || contentOrigin === 'SubstrateSearchService') {
      return parseSearchMessage(msg);
    }

    // Plugin invocation
    if (msg.messageType === 'InternalToolInvocation' || msg.contentType === 'TOOL_INVOCATION') {
      return parsePluginMessage(msg);
    }

    // Content filter / safety
    if (contentOrigin === 'OffensiveRequestClassifier') {
      return {
        type: 'diagnostics',
        contentOrigin,
        diagnosticData: msg,
      };
    }

    // Regular response text
    if (msg.text || msg.adaptiveCards) {
      return parseResponseMessage(msg, contentOrigin);
    }
  }

  return { type: 'response_chunk' };
}

function parseSearchMessage(msg: any): CopilotParsedMessage {
  const result: CopilotParsedMessage = {
    type: 'search_query',
    contentOrigin: msg.contentOrigin || 'SubstrateSearchService',
  };

  // Extract the search query text
  if (msg.text) {
    try {
      const parsed = JSON.parse(msg.text);
      result.searchQuery = parsed.query || parsed.QueryString || msg.text;
      result.searchScope = parsed.scope || parsed.EntityTypes?.join(', ');
    } catch {
      result.searchQuery = msg.text;
    }
  }

  // Extract search results if present
  if (msg.groundingInfo || msg.sourceAttributions) {
    result.type = 'search_results';
    result.sources = extractSources(msg);
    result.searchResultCount = result.sources.length;
  }

  return result;
}

function parsePluginMessage(msg: any): CopilotParsedMessage {
  return {
    type: 'plugin_call',
    pluginName: msg.toolName || msg.pluginName || msg.invocationInfo?.toolName || 'Unknown Plugin',
    pluginRequest: msg.invocationInfo || msg,
    contentOrigin: msg.contentOrigin,
  };
}

function parseResponseMessage(msg: any, contentOrigin?: string): CopilotParsedMessage {
  const result: CopilotParsedMessage = {
    type: 'response_chunk',
    contentOrigin,
  };

  // Extract response text
  if (msg.text) {
    result.responseText = msg.text;
  }

  // Hidden text with reference markers
  if (msg.hiddenText) {
    result.rawTextWithMarkers = msg.hiddenText;
  }

  // Adaptive cards
  if (msg.adaptiveCards && Array.isArray(msg.adaptiveCards)) {
    result.adaptiveCards = msg.adaptiveCards;
  }

  // Source attributions
  if (msg.sourceAttributions) {
    result.sources = extractSources(msg);
  }

  return result;
}

// ---- Source extraction ----

function extractSources(msg: any): CopilotSource[] {
  const sources: CopilotSource[] = [];

  // From sourceAttributions array
  const attributions = msg.sourceAttributions || [];
  for (const attr of attributions) {
    sources.push({
      title: attr.displayName || attr.providerDisplayName || attr.seeMoreUrl || 'Unknown',
      url: attr.seeMoreUrl || attr.url,
      type: inferSourceType(attr),
      snippet: attr.searchResultSnippet || attr.snippet,
    });
  }

  // From groundingInfo
  if (msg.groundingInfo?.web_search_results) {
    for (const r of msg.groundingInfo.web_search_results) {
      sources.push({
        title: r.title || r.name || 'Web Result',
        url: r.url,
        type: 'web',
        snippet: r.snippet,
      });
    }
  }

  return sources;
}

function inferSourceType(attr: any): CopilotSource['type'] {
  const url = (attr.seeMoreUrl || attr.url || '').toLowerCase();
  if (url.includes('sharepoint.com') || url.includes('onedrive')) return 'file';
  if (url.includes('outlook') || url.includes('mail')) return 'email';
  if (url.includes('teams')) return 'chat';
  if (url.includes('calendar') || url.includes('event')) return 'meeting';
  if (url.startsWith('http')) return 'web';
  return 'unknown';
}
