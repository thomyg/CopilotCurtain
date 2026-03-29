import React from 'react';
import type { CopilotWSMessage, CapturedRequest } from '../../shared/types';
import { useStore } from '../hooks/useStore';
import JsonTree from './JsonTree';

interface Props {
  messages: CopilotWSMessage[];
}

interface CorrelatedSearch {
  wsMessage: CopilotWSMessage;
  httpRequests: CapturedRequest[];
}

export default function SearchCorrelation({ messages }: Props) {
  const requests = useStore((s) => s.requests);

  const correlations = React.useMemo(() => {
    // Find all search progress messages
    const searchMsgs = messages.filter(
      (m) => m.parsed.type === 'search_progress' || m.parsed.type === 'search_query' || m.parsed.type === 'search_results'
    );

    if (searchMsgs.length === 0) return [];

    // Find substrate-search HTTP requests within the conversation timeframe
    const firstMsg = messages[0]?.timestamp || 0;
    const lastMsg = messages[messages.length - 1]?.timestamp || Date.now();
    const searchRequests = requests.filter(
      (r) => r.category === 'substrate-search' && r.timestamp >= firstMsg - 5000 && r.timestamp <= lastMsg + 5000
    ).sort((a, b) => a.timestamp - b.timestamp);

    // Correlate: match each WS search message to nearby HTTP requests
    const results: CorrelatedSearch[] = [];
    const usedRequests = new Set<string>();

    for (const wsMsg of searchMsgs) {
      const nearby = searchRequests.filter(
        (r) => !usedRequests.has(r.id) && Math.abs(r.timestamp - wsMsg.timestamp) < 10000
      );
      for (const r of nearby) usedRequests.add(r.id);

      results.push({ wsMessage: wsMsg, httpRequests: nearby });
    }

    // Add any unmatched search requests
    const unmatchedHttp = searchRequests.filter((r) => !usedRequests.has(r.id));
    if (unmatchedHttp.length > 0) {
      results.push({
        wsMessage: {
          id: 'unmatched',
          conversationId: '',
          timestamp: unmatchedHttp[0].timestamp,
          direction: 'received' as const,
          tabId: 0,
          rawPayload: '',
          messageType: 1,
          parsed: { type: 'search_query', searchQuery: 'Additional HTTP search requests' },
        },
        httpRequests: unmatchedHttp,
      });
    }

    return results;
  }, [messages, requests]);

  if (correlations.length === 0 && requests.filter((r) => r.category === 'substrate-search').length === 0) {
    return (
      <div className="p-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        No search requests captured. Enable HTTP monitoring to correlate search queries with WebSocket messages.
      </div>
    );
  }

  if (correlations.length === 0) {
    return (
      <div className="p-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        No search events in this conversation.
      </div>
    );
  }

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
        Search Correlation — WebSocket events matched to Substrate Search HTTP calls
      </div>

      {correlations.map((corr, idx) => (
        <div key={idx} className="rounded p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          {/* WS search message */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatTime(corr.wsMessage.timestamp)}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--search-color)' }}>WS Search</span>
            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
              {corr.wsMessage.parsed.progressText || corr.wsMessage.parsed.searchQuery || ''}
            </span>
          </div>

          {/* Correlated HTTP requests */}
          {corr.httpRequests.length > 0 ? (
            <div className="space-y-2 ml-4" style={{ borderLeft: '2px solid var(--search-color)', paddingLeft: '12px' }}>
              {corr.httpRequests.map((req) => (
                <HttpSearchDetail key={req.id} request={req} />
              ))}
            </div>
          ) : (
            <div className="text-xs ml-4" style={{ color: 'var(--text-muted)' }}>
              No matching HTTP requests (search may be server-side only)
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HttpSearchDetail({ request }: { request: CapturedRequest }) {
  const [expanded, setExpanded] = React.useState(false);
  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Parse query parameters from URL
  const queryParams = React.useMemo(() => {
    try {
      const u = new URL(request.url);
      const params: Record<string, string> = {};
      u.searchParams.forEach((v, k) => { params[k] = v; });
      return Object.keys(params).length > 0 ? params : null;
    } catch { return null; }
  }, [request.url]);

  // Parse request body
  const parsedBody = React.useMemo(() => {
    if (!request.requestBody) return null;
    try { return JSON.parse(request.requestBody); }
    catch { return request.requestBody; }
  }, [request.requestBody]);

  return (
    <div>
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs" style={{ color: expanded ? 'var(--accent-text)' : 'var(--text-muted)' }}>
          {expanded ? '▼' : '▶'}
        </span>
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatTime(request.timestamp)}</span>
        <span className="text-xs font-semibold" style={{ color: 'var(--accent-text)' }}>HTTP {request.method}</span>
        <span className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
          {request.parsedUrl.pathname}
        </span>
        <span className="text-xs font-mono" style={{ color: request.statusCode >= 400 ? 'var(--danger)' : 'var(--success)' }}>
          {request.statusCode}
        </span>
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{request.timeMs}ms</span>
      </div>

      {expanded && (
        <div className="mt-2 ml-4 space-y-2 text-xs">
          <div className="font-mono break-all" style={{ color: 'var(--text-secondary)' }}>{request.url}</div>

          {queryParams && (
            <div>
              <div className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Query Parameters</div>
              <div className="p-2 rounded" style={{ background: 'var(--code-bg)' }}>
                <JsonTree data={queryParams} defaultExpanded={3} />
              </div>
            </div>
          )}

          {parsedBody && (
            <div>
              <div className="font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Request Body</div>
              <div className="p-2 rounded" style={{ background: 'var(--code-bg)' }}>
                <JsonTree data={parsedBody} defaultExpanded={4} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

