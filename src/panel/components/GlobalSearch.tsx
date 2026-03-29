import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useStore, useFetchConversations } from '../hooks/useStore';
import type { CopilotWSMessage, CopilotConversation, CapturedRequest } from '../../shared/types';
import { MESSAGE_TYPE_CONFIG } from '../../shared/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterType = 'all' | 'prompts' | 'searches' | 'responses' | 'plugins' | 'errors';

interface SearchResult {
  id: string;
  type: 'message' | 'request';
  filterType: FilterType;
  timestamp: number;
  matchedText: string;
  fieldLabel: string;
  typeLabel: string;
  typeColor: string;
  typeEmoji: string;
  conversationId: string | null;
  conversationName: string | null;
}

// ---------------------------------------------------------------------------
// Filter chip definitions
// ---------------------------------------------------------------------------

const FILTER_CHIPS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'prompts', label: 'Prompts' },
  { key: 'searches', label: 'Searches' },
  { key: 'responses', label: 'Responses' },
  { key: 'plugins', label: 'Plugins' },
  { key: 'errors', label: 'Errors' },
];

// Map message types to filter categories
const TYPE_TO_FILTER: Record<string, FilterType> = {
  user_prompt: 'prompts',
  search_progress: 'searches',
  search_query: 'searches',
  search_results: 'searches',
  response_chunk: 'responses',
  response_snapshot: 'responses',
  response_final: 'responses',
  conversation_state: 'responses',
  suggested_responses: 'responses',
  plugin_call: 'plugins',
  plugin_response: 'plugins',
  disengaged: 'errors',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_RESULTS = 100;
const CONTEXT_CHARS = 120;

function truncateAroundMatch(text: string, query: string, contextChars: number = CONTEXT_CHARS): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, contextChars * 2);
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + query.length + contextChars);
  let result = text.slice(start, end);
  if (start > 0) result = '...' + result;
  if (end < text.length) result = result + '...';
  return result;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span key={i} style={{ background: 'var(--accent-bg)', color: 'var(--accent-text)' }}>{part}</span>
    ) : (
      part
    )
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---------------------------------------------------------------------------
// Search logic
// ---------------------------------------------------------------------------

function searchMessages(
  messages: CopilotWSMessage[],
  query: string,
  convMap: Map<string, CopilotConversation>,
): SearchResult[] {
  const results: SearchResult[] = [];
  const lowerQ = query.toLowerCase();

  for (const msg of messages) {
    if (results.length >= MAX_RESULTS) break;

    const p = msg.parsed;
    const config = MESSAGE_TYPE_CONFIG[p.type] ?? MESSAGE_TYPE_CONFIG['unknown'];
    const filterType = TYPE_TO_FILTER[p.type] ?? 'all';
    const conv = convMap.get(msg.conversationId);

    // Fields to search, with labels
    const fields: [string | undefined, string][] = [
      [p.promptText, 'Prompt'],
      [p.progressText, 'Progress'],
      [p.searchQuery, 'Search Query'],
      [p.responseText, 'Response'],
      [p.pluginName, 'Plugin'],
      [p.errorMessage, 'Error'],
      [p.defaultChatName, 'Chat Name'],
    ];

    for (const [value, label] of fields) {
      if (!value) continue;
      if (!value.toLowerCase().includes(lowerQ)) continue;

      results.push({
        id: `${msg.id}-${label}`,
        type: 'message',
        filterType,
        timestamp: msg.timestamp,
        matchedText: truncateAroundMatch(value, query),
        fieldLabel: label,
        typeLabel: config.label,
        typeColor: config.color,
        typeEmoji: config.emoji,
        conversationId: msg.conversationId,
        conversationName: conv?.defaultChatName ?? conv?.firstPrompt?.slice(0, 60) ?? null,
      });

      // Only one match per message to avoid noise
      break;
    }
  }

  return results;
}

function searchRequests(
  requests: CapturedRequest[],
  query: string,
): SearchResult[] {
  const results: SearchResult[] = [];
  const lowerQ = query.toLowerCase();

  for (const req of requests) {
    if (results.length >= MAX_RESULTS) break;

    const fields: [string | undefined | null, string][] = [
      [req.url, 'URL'],
      [req.service, 'Service'],
      [req.requestBody, 'Request Body'],
    ];

    for (const [value, label] of fields) {
      if (!value) continue;
      if (!value.toLowerCase().includes(lowerQ)) continue;

      results.push({
        id: `req-${req.id}-${label}`,
        type: 'request',
        filterType: 'all',
        timestamp: req.timestamp,
        matchedText: truncateAroundMatch(value, query),
        fieldLabel: label,
        typeLabel: `HTTP ${req.method}`,
        typeColor: 'var(--text-secondary)',
        typeEmoji: '🌐',
        conversationId: null,
        conversationName: null,
      });

      break;
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GlobalSearch() {
  const messages = useStore((s) => s.messages);
  const requests = useStore((s) => s.requests);
  const conversations = useStore((s) => s.conversations);
  const fetchConversations = useFetchConversations();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch conversations on mount so we can resolve names
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Debounce the search query
  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(val.trim()), 300);
  }, []);

  // Conversation lookup map
  const convMap = useMemo(() => {
    const map = new Map<string, CopilotConversation>();
    for (const c of conversations) map.set(c.id, c);
    return map;
  }, [conversations]);

  // Compute search results
  const results = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];

    const msgResults = searchMessages(messages, debouncedQuery, convMap);
    const reqResults = searchRequests(requests, debouncedQuery);

    const combined = [...msgResults, ...reqResults];
    combined.sort((a, b) => b.timestamp - a.timestamp);
    return combined.slice(0, MAX_RESULTS);
  }, [debouncedQuery, messages, requests, convMap]);

  // Apply active filter
  const filteredResults = useMemo(() => {
    if (activeFilter === 'all') return results;
    return results.filter((r) => r.filterType === activeFilter);
  }, [results, activeFilter]);

  // Group by filterType for summary counts
  const counts = useMemo(() => {
    const c: Record<FilterType, number> = { all: 0, prompts: 0, searches: 0, responses: 0, plugins: 0, errors: 0 };
    for (const r of results) {
      c.all++;
      if (r.filterType !== 'all') c[r.filterType]++;
    }
    return c;
  }, [results]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: '14px' }}>
      {/* Search input */}
      <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search across all conversations and traffic..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              fontSize: '14px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              fontSize: '14px',
              pointerEvents: 'none',
            }}
          >
            &#x1F50D;
          </span>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeFilter === chip.key;
            const count = counts[chip.key];
            return (
              <button
                key={chip.key}
                onClick={() => setActiveFilter(chip.key)}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 400,
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--accent-bg)' : 'var(--border)',
                  background: isActive ? 'var(--accent-bg)' : 'transparent',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  lineHeight: '1.4',
                }}
              >
                {chip.label}
                {debouncedQuery && count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {!debouncedQuery || debouncedQuery.length < 2 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '28px' }}>&#x1F50E;</span>
            <span>Type at least 2 characters to search</span>
          </div>
        ) : filteredResults.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '28px' }}>&#x1F6AB;</span>
            <span>No results found for "{debouncedQuery}"</span>
          </div>
        ) : (
          <>
            <div
              style={{
                padding: '4px 16px 8px',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
              {filteredResults.length >= MAX_RESULTS ? ` (limited to ${MAX_RESULTS})` : ''}
            </div>
            {filteredResults.map((result) => (
              <ResultRow key={result.id} result={result} query={debouncedQuery} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result row sub-component
// ---------------------------------------------------------------------------

function ResultRow({ result, query }: { result: SearchResult; query: string }) {
  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        cursor: 'default',
        transition: 'background 0.1s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {/* Header row: timestamp + type badge + field label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px',
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {formatTimestamp(result.timestamp)}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '1px 6px',
            borderRadius: '4px',
            background: 'var(--code-bg)',
            color: result.typeColor,
          }}
        >
          <span>{result.typeEmoji}</span>
          {result.typeLabel}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          in {result.fieldLabel}
        </span>
        {result.type === 'request' && (
          <span
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              borderRadius: '3px',
              background: 'var(--search-bg)',
              color: 'var(--search-color)',
              fontWeight: 600,
            }}
          >
            HTTP
          </span>
        )}
      </div>

      {/* Matched text with highlighting */}
      <div
        style={{
          fontSize: '13px',
          color: 'var(--text-primary)',
          lineHeight: '1.5',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        {highlightMatch(result.matchedText, query)}
      </div>

      {/* Conversation attribution */}
      {result.conversationName && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
          Conversation: {result.conversationName}
        </div>
      )}
    </div>
  );
}
