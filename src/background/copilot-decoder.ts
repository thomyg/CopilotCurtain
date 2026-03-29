import type { CopilotParsedMessage, CopilotSource, REFERENCE_TYPE_MAP } from '../shared/types';

// M365 Copilot WebSocket Protocol Decoder
// Based on HAR analysis of real Copilot chat sessions (2026-03)
//
// Protocol: SignalR JSON over WebSocket
// Frames separated by ASCII Record Separator (0x1E)
// Endpoint: substrate.office.com/m365Copilot/Chathub/{userId}@{tenantId}
//
// SignalR message types:
//   (none) = Handshake
//   1 = Invocation (server: target="update", client: target="Metrics")
//   2 = StreamItem (final conversation state)
//   3 = Completion (stream done)
//   4 = StreamInvocation (client: target="chat" — user prompt)
//   6 = Ping

const RECORD_SEPARATOR = '\x1e';

const REF_TYPE_MAP: Record<number, string> = {
  0: 'PowerPoint', 1: 'Excel', 2: 'Word', 3: 'OneNote',
  4: 'Email', 5: 'Teams Chat', 7: 'Meeting', 9: 'SharePoint',
  10: 'Web', 11: 'PDF', 15: 'Image', 17: 'Video', 20: 'Third Party', 24: 'Loop',
};

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
      results.push({ messageType: 0, parsed: { type: 'unknown' } });
    }
  }

  return results;
}

// ============================================================
// SENT messages (client → Copilot)
// ============================================================

function parseSentMessage(json: any): CopilotParsedMessage {
  // Handshake
  if (json.protocol && json.version) {
    return { type: 'handshake', diagnosticData: { protocol: json.protocol, version: json.version } };
  }

  // Type 6: Ping
  if (json.type === 6) {
    return { type: 'unknown' };
  }

  // Type 4: StreamInvocation — THE user prompt
  if (json.type === 4 && json.target === 'chat') {
    return parseUserPrompt(json);
  }

  // Type 1, target="Metrics" — client timing telemetry
  if (json.type === 1 && json.target === 'Metrics') {
    const timestamps = json.arguments?.[0]?.Timestamps;
    return { type: 'metrics', timestamps };
  }

  // Type 1 with arguments — older prompt format (fallback)
  if (json.arguments && Array.isArray(json.arguments)) {
    const args = json.arguments[0];
    if (args) {
      const prompt = extractPromptText(args);
      if (prompt) {
        return {
          type: 'user_prompt',
          promptText: prompt,
          enabledPlugins: extractPluginList(args),
        };
      }
    }
  }

  return { type: 'unknown' };
}

function parseUserPrompt(json: any): CopilotParsedMessage {
  const args = json.arguments?.[0];
  if (!args) return { type: 'user_prompt' };

  const msg = args.message;
  const prompt = msg?.text || msg?.content || '';
  const plugins = extractPluginList(args);

  // Agent detection: gpts[] array or threadLevelGptId with .declarativeAgent
  const gpts = args.gpts;
  const threadGptId = args.threadLevelGptId?.id || '';
  const hasGpts = Array.isArray(gpts) && gpts.length > 0;
  const isAgent = hasGpts || threadGptId.includes('.declarativeAgent') || threadGptId.includes('.agent');
  const agentId = hasGpts ? gpts[0].id : (threadGptId || undefined);

  return {
    type: 'user_prompt',
    promptText: prompt,
    enabledPlugins: plugins,
    clientInfo: args.clientInfo,
    optionsSets: args.optionsSets,
    searchScope: msg?.entityAnnotationTypes?.join(', '),
    agentId,
    isAgent: isAgent || undefined,
  };
}

function extractPromptText(args: any): string | undefined {
  if (typeof args.message === 'string') return args.message;
  if (args.message?.text) return args.message.text;
  if (args.message?.content) return args.message.content;
  if (args.userMessage) return args.userMessage;
  return undefined;
}

function extractPluginList(args: any): string[] {
  const plugins: string[] = [];
  const pluginDefs = args.plugins || args.enabledPlugins || args.options?.plugins;
  if (Array.isArray(pluginDefs)) {
    for (const p of pluginDefs) {
      if (typeof p === 'string') plugins.push(p);
      else if (p.Id) plugins.push(p.Id);
      else if (p.id) plugins.push(p.id);
      else if (p.name) plugins.push(p.name);
    }
  }
  return plugins;
}

// ============================================================
// RECEIVED messages (Copilot → client)
// ============================================================

function parseReceivedMessage(json: any): CopilotParsedMessage {
  const msgType = json.type;

  // Handshake response: {} (no type field)
  if (msgType === undefined && Object.keys(json).length === 0) {
    return { type: 'handshake' };
  }

  // Type 6: Ping
  if (msgType === 6) return { type: 'unknown' };

  // Type 3: Completion — stream done
  if (msgType === 3) {
    return { type: 'completion' };
  }

  // Type 2: StreamItem — final conversation state
  if (msgType === 2) {
    return parseStreamItem(json);
  }

  // Type 1: Invocation — all server responses (target="update")
  if (msgType === 1) {
    return parseUpdateFrame(json);
  }

  return { type: 'unknown' };
}

// ---- Type 2: StreamItem (final conversation state) ----

function parseStreamItem(json: any): CopilotParsedMessage {
  const item = json.item;
  if (!item) return { type: 'conversation_state', diagnosticData: json };

  const messages: any[] = item.messages || [];
  const sources: CopilotSource[] = [];
  let responseText: string | undefined;
  let suggestedResponses: Array<{ text: string; hiddenText?: string }> | undefined;
  let hintInvocations: string[] = [];

  for (const msg of messages) {
    if (msg.author === 'user') continue;

    // HintInvocations (language detection, etc.)
    if (msg.messageType === 'HintInvocation') {
      hintInvocations.push(msg.invocation || '');
      continue;
    }

    // Bot response with sourceAttributions
    if (msg.sourceAttributions) {
      sources.push(...parseSourceAttributions(msg.sourceAttributions));
    }

    // Suggested responses
    if (msg.suggestedResponses) {
      suggestedResponses = msg.suggestedResponses.map((s: any) => ({
        text: s.text || s.commandText,
        hiddenText: s.hiddenText,
      }));
    }

    // Main response text
    if (msg.author === 'bot' && msg.text && !msg.messageType) {
      responseText = msg.text;
    }
  }

  return {
    type: 'conversation_state',
    defaultChatName: item.defaultChatName,
    turnState: item.turnState,
    serviceVersion: item.result?.serviceVersion,
    sensitivityLabel: item.conversationSensitivityLabel ? {
      displayName: item.conversationSensitivityLabel.displayName,
      color: item.conversationSensitivityLabel.color,
      tooltip: item.conversationSensitivityLabel.tooltip,
    } : undefined,
    throttling: item.throttling ? {
      max: item.throttling.maxNumUserMessagesInConversation,
      current: item.throttling.numUserMessagesInConversation,
    } : undefined,
    responseText,
    sources: sources.length > 0 ? sources : undefined,
    sourceCount: sources.length,
    suggestedResponses,
    diagnosticData: {
      hintInvocations,
      conversationId: item.conversationId,
      turnState: item.turnState,
      result: item.result?.value,
    },
  };
}

// ---- Type 1: Update frames (the bulk of the protocol) ----

function parseUpdateFrame(json: any): CopilotParsedMessage {
  const args = json.arguments?.[0];
  if (!args) return { type: 'response_chunk' };

  // 1. Throttling frame (has throttling, no messages)
  if (args.throttling && !args.messages) {
    return {
      type: 'throttling',
      throttling: {
        max: args.throttling.maxNumUserMessagesInConversation,
        current: args.throttling.numUserMessagesInConversation,
      },
    };
  }

  // 2. Streaming token frame (has writeAtCursor)
  if (args.writeAtCursor !== undefined) {
    const sources = args.sourceAttributions?.length > 0
      ? parseSourceAttributions(args.sourceAttributions)
      : undefined;
    return {
      type: 'response_chunk',
      writeAtCursor: args.writeAtCursor,
      streamingMode: 'Delta',
      sources,
      sourceCount: args.sourceAttributions?.length || 0,
    };
  }

  // 3. Message frame (has messages[])
  if (args.messages && Array.isArray(args.messages) && args.messages.length > 0) {
    return parseMessageFrame(args);
  }

  return { type: 'response_chunk' };
}

function parseMessageFrame(args: any): CopilotParsedMessage {
  const msg = args.messages[0];
  const messageType = msg.messageType || '';
  const contentType = msg.contentType || '';
  const contentOrigin = msg.contentOrigin || msg.author || '';

  // Progress message (search indicator)
  if (messageType === 'Progress') {
    return {
      type: 'search_progress',
      progressText: msg.text || '',
      searchQuery: msg.text || '',
      contentOrigin,
      searchScope: contentType === 'SearchResults' ? 'SearchResults' : contentType,
    };
  }

  // ReferencesListComplete
  if (messageType === 'ReferencesListComplete') {
    return { type: 'references_complete' };
  }

  // HintInvocation (rare in update frames, common in Type 2)
  if (messageType === 'HintInvocation') {
    return {
      type: 'diagnostics',
      contentOrigin: msg.contentOrigin || 'HintGenerator',
      diagnosticData: { invocation: msg.invocation, messageType },
    };
  }

  // Plugin invocation
  if (messageType === 'InternalToolInvocation' || messageType === 'TriggerPlugin') {
    return {
      type: 'plugin_call',
      pluginName: msg.toolName || msg.pluginName || msg.invocationInfo?.toolName || 'Unknown Plugin',
      pluginRequest: msg.invocationInfo || msg,
      contentOrigin,
    };
  }

  // Content filter / safety
  if (contentOrigin === 'OffensiveRequestClassifier') {
    return { type: 'diagnostics', contentOrigin, diagnosticData: msg };
  }

  // Disengaged
  if (messageType === 'Disengaged') {
    return { type: 'disengaged', errorMessage: msg.text || 'Copilot disengaged' };
  }

  // Regular response snapshot (streamingMode=Full)
  const sources = msg.sourceAttributions?.length > 0
    ? parseSourceAttributions(msg.sourceAttributions)
    : undefined;

  const suggestedResponses = msg.suggestedResponses?.map((s: any) => ({
    text: s.text || s.commandText,
    hiddenText: s.hiddenText,
  }));

  // Is this the FINAL complete message? (has suggestedResponses or large sourceAttributions)
  const isFinal = suggestedResponses && suggestedResponses.length > 0;

  return {
    type: isFinal ? 'response_final' : 'response_snapshot',
    responseText: msg.text,
    rawTextWithMarkers: msg.hiddenText,
    adaptiveCards: msg.adaptiveCards,
    sources,
    sourceCount: msg.sourceAttributions?.length || 0,
    suggestedResponses,
    contentOrigin,
    streamingMode: args.streamingMode || 'Full',
    sensitivityLabel: msg.sensitivityLabel ? {
      displayName: msg.sensitivityLabel.displayName,
      color: msg.sensitivityLabel.color,
    } : undefined,
    diagnosticData: msg.scores ? { scores: msg.scores } : undefined,
  };
}

// ============================================================
// Source attribution parsing
// ============================================================

function parseSourceAttributions(attributions: any[]): CopilotSource[] {
  const sources: CopilotSource[] = [];

  for (const attr of attributions) {
    if (!attr.sourceType && !attr.providerDisplayName && !attr.seeMoreUrl) continue;

    if (attr.sourceType === 'ANNOTATION') {
      sources.push(parseAnnotationSource(attr));
    } else {
      // CITATION or legacy format
      sources.push(parseCitationSource(attr));
    }
  }

  return sources;
}

function parseCitationSource(attr: any): CopilotSource {
  const source: CopilotSource = {
    title: attr.providerDisplayName || attr.displayName || 'Unknown',
    url: attr.seeMoreUrl || attr.url,
    type: 'unknown',
    sourceType: 'CITATION',
    isCitedInResponse: attr.isCitedInResponse === 'True' || attr.isCitedInResponse === true,
  };

  // Parse referenceMetadata (double-encoded JSON string)
  if (attr.referenceMetadata) {
    try {
      const meta = typeof attr.referenceMetadata === 'string'
        ? JSON.parse(attr.referenceMetadata)
        : attr.referenceMetadata;

      source.referenceType = meta.referenceType;
      source.fileType = REF_TYPE_MAP[meta.referenceType] || meta.type || meta.typeDescription;
      source.dataSource = meta.dataSource;
      source.context = meta.context;
      source.authorName = meta.authorName;
      source.authorEmail = meta.authorEmail;
      source.citationRefId = meta.citationRefId;

      // Better URL from metadata
      if (!source.url && meta.defaultEncodingUrl) {
        source.url = meta.defaultEncodingUrl;
      }

      // Map referenceType to source.type
      source.type = mapReferenceTypeToSourceType(meta.referenceType, meta.dataSource);

      // Better title from metadata if displayName is a URL
      if (source.title.startsWith('http') && meta.type) {
        source.title = meta.type;
      }
    } catch {
      // referenceMetadata parse failed — use URL-based inference
      source.type = inferSourceTypeFromUrl(source.url || '');
    }
  } else {
    source.type = inferSourceTypeFromUrl(source.url || '');
  }

  // Snippet
  if (attr.searchResultSnippet || attr.snippet) {
    source.snippet = attr.searchResultSnippet || attr.snippet;
  }

  return source;
}

function parseAnnotationSource(attr: any): CopilotSource {
  const source: CopilotSource = {
    title: '',
    url: attr.seeMoreUrl,
    type: 'unknown',
    sourceType: 'ANNOTATION',
    annotationType: attr.type,
    isCitedInResponse: attr.isCitedInResponse === 'True',
  };

  // Parse metadata (JSON string)
  if (attr.metadata) {
    try {
      const meta = typeof attr.metadata === 'string' ? JSON.parse(attr.metadata) : attr.metadata;

      if (attr.type === 'People') {
        source.type = 'person';
        source.personName = meta.name || meta.address;
        source.personEmail = meta.address;
        source.title = meta.name || meta.address || 'Person';
      } else if (attr.type === 'Event') {
        source.type = 'event';
        const eventData = meta.Source || meta;
        source.eventSubject = eventData.Subject;
        source.eventStart = eventData.Start;
        source.title = eventData.Subject || 'Event';
      } else {
        source.title = attr.type || 'Annotation';
      }
    } catch {
      source.title = attr.type || 'Annotation';
    }
  }

  return source;
}

function mapReferenceTypeToSourceType(refType: number, dataSource?: string): CopilotSource['type'] {
  switch (refType) {
    case 0: case 1: case 2: case 3: case 11: case 15: case 17: case 24:
      return 'file';
    case 4:
      return 'email';
    case 5:
      return 'chat';
    case 7:
      return 'meeting';
    case 9:
      return dataSource === 'SharePoint' ? 'file' : 'web';
    case 10:
      return 'web';
    default:
      return 'unknown';
  }
}

function inferSourceTypeFromUrl(url: string): CopilotSource['type'] {
  const u = url.toLowerCase();
  if (u.includes('sharepoint.com') || u.includes('onedrive')) return 'file';
  if (u.includes('outlook') || u.includes('/owa/')) return 'email';
  if (u.includes('teams.microsoft.com/l/message')) return 'chat';
  if (u.includes('/meeting/details') || u.includes('eventid=')) return 'meeting';
  if (u.startsWith('http')) return 'web';
  return 'unknown';
}
