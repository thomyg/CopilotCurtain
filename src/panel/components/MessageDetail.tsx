import React, { useState } from 'react';
import type { CopilotWSMessage } from '../../shared/types';
import { MESSAGE_TYPE_CONFIG } from '../../shared/constants';
import JsonTree from './JsonTree';

interface Props {
  message: CopilotWSMessage;
  onClose: () => void;
}

type Tab = 'parsed' | 'sources' | 'raw';

export default function MessageDetail({ message, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('parsed');
  const config = MESSAGE_TYPE_CONFIG[message.parsed.type] || MESSAGE_TYPE_CONFIG.unknown;
  const p = message.parsed;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'parsed', label: 'Parsed' },
    ...(p.sources && p.sources.length > 0 ? [{ id: 'sources' as Tab, label: `Sources (${p.sources.length})` }] : []),
    { id: 'raw', label: 'Raw Frame' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color: config.color }}>
            {config.emoji} {config.label}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {message.direction === 'sent' ? '→ Sent' : '← Received'} at {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <button onClick={onClose} className="px-1 text-lg leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-1.5 text-xs font-medium"
            style={{
              color: tab === t.id ? 'var(--accent-text)' : 'var(--text-secondary)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {tab === 'parsed' && (
          <ParsedView parsed={p} />
        )}

        {tab === 'sources' && p.sources && (
          <SourcesList sources={p.sources} />
        )}

        {tab === 'raw' && (
          <RawFrameView rawPayload={message.rawPayload} />
        )}
      </div>
    </div>
  );
}

// ---- Parsed view: shows all parsed fields in structured sections ----

import type { CopilotParsedMessage } from '../../shared/types';

function ParsedView({ parsed: p }: { parsed: CopilotParsedMessage }) {
  // Build sections from all available parsed fields
  const sections: Array<{ title: string; content: React.ReactNode }> = [];

  // 1. Primary content (text blocks shown prominently)
  if (p.promptText) {
    sections.push({
      title: 'Prompt',
      content: (
        <div className="p-2 rounded font-mono text-sm whitespace-pre-wrap" style={{ background: 'var(--prompt-bg)', color: 'var(--text-primary)' }}>
          {p.promptText}
        </div>
      ),
    });
  }

  if (p.progressText && p.type === 'search_progress') {
    sections.push({
      title: 'Search Progress',
      content: (
        <div className="p-2 rounded text-sm whitespace-pre-wrap" style={{ background: 'var(--search-bg)', color: 'var(--text-primary)' }}>
          {p.progressText}
        </div>
      ),
    });
  }

  if (p.responseText) {
    sections.push({
      title: 'Response Text',
      content: (
        <div className="p-2 rounded text-sm whitespace-pre-wrap" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
          {p.responseText}
        </div>
      ),
    });
  }

  if (p.writeAtCursor) {
    sections.push({
      title: 'Delta Token',
      content: <code className="text-sm font-mono" style={{ color: 'var(--accent-text)' }}>{p.writeAtCursor}</code>,
    });
  }

  if (p.errorMessage) {
    sections.push({
      title: 'Error',
      content: (
        <div className="p-2 rounded text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
          {p.errorMessage}
        </div>
      ),
    });
  }

  // 2. Key-value metadata
  const kvPairs: Array<[string, string | number | boolean | undefined]> = [
    ['Type', p.type],
    ['Content Origin', p.contentOrigin],
    ['Streaming Mode', p.streamingMode],
    ['Search Query', p.type !== 'search_progress' ? p.searchQuery : undefined],
    ['Search Scope', p.searchScope],
    ['Source Count', p.sourceCount],
    ['Default Chat Name', p.defaultChatName],
    ['Turn State', p.turnState],
    ['Service Version', p.serviceVersion],
  ];
  const validKv = kvPairs.filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (validKv.length > 0) {
    sections.push({
      title: 'Details',
      content: (
        <div className="space-y-1">
          {validKv.map(([label, value]) => (
            <div key={label} className="flex gap-3 text-sm">
              <span className="w-32 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{String(value)}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  // 3. Sensitivity label
  if (p.sensitivityLabel) {
    sections.push({
      title: 'Sensitivity Label',
      content: (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{
            color: p.sensitivityLabel.color,
            border: `1px solid ${p.sensitivityLabel.color}`,
          }}>
            {p.sensitivityLabel.displayName}
          </span>
          {p.sensitivityLabel.tooltip && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.sensitivityLabel.tooltip}</span>
          )}
        </div>
      ),
    });
  }

  // 4. Throttling
  if (p.throttling) {
    sections.push({
      title: 'Throttling',
      content: (
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
          {p.throttling.current} / {p.throttling.max} messages used
        </span>
      ),
    });
  }

  // 5. Plugins
  if (p.enabledPlugins && p.enabledPlugins.length > 0) {
    sections.push({
      title: 'Enabled Plugins',
      content: (
        <div className="flex flex-wrap gap-1">
          {p.enabledPlugins.map((pl, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--plugin-bg)', color: 'var(--plugin-color)' }}>{pl}</span>
          ))}
        </div>
      ),
    });
  }

  if (p.pluginName) {
    sections.push({
      title: 'Plugin',
      content: <span className="text-sm font-medium" style={{ color: 'var(--plugin-color)' }}>{p.pluginName}</span>,
    });
  }

  // 6. Suggested responses
  if (p.suggestedResponses && p.suggestedResponses.length > 0) {
    sections.push({
      title: 'Suggested Responses',
      content: (
        <div className="space-y-1">
          {p.suggestedResponses.map((s, i) => (
            <div key={i} className="px-2 py-1 rounded text-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              {s.text}
            </div>
          ))}
        </div>
      ),
    });
  }

  // 7. Metrics timestamps
  if (p.timestamps) {
    sections.push({
      title: 'Timestamps',
      content: (
        <div className="space-y-0.5">
          {Object.entries(p.timestamps).map(([k, v]) => (
            <div key={k} className="flex gap-3 text-xs font-mono">
              <span className="w-48 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{k}</span>
              <span style={{ color: 'var(--text-primary)' }}>{v}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  // 8. Raw text with markers (citation references)
  if (p.rawTextWithMarkers) {
    sections.push({
      title: 'Raw Text (with citation markers)',
      content: (
        <pre className="font-mono text-xs p-2 rounded whitespace-pre-wrap" style={{ background: 'var(--code-bg)', color: 'var(--text-secondary)' }}>
          {p.rawTextWithMarkers}
        </pre>
      ),
    });
  }

  // 9. Adaptive cards
  if (p.adaptiveCards && p.adaptiveCards.length > 0) {
    sections.push({
      title: `Adaptive Cards (${p.adaptiveCards.length})`,
      content: (
        <div className="p-2 rounded" style={{ background: 'var(--code-bg)' }}>
          <JsonTree data={p.adaptiveCards} defaultExpanded={3} />
        </div>
      ),
    });
  }

  // 10. Plugin request/response payloads
  if (p.pluginRequest) {
    sections.push({
      title: 'Plugin Request',
      content: (
        <div className="p-2 rounded" style={{ background: 'var(--code-bg)' }}>
          <JsonTree data={p.pluginRequest} defaultExpanded={4} />
        </div>
      ),
    });
  }
  if (p.pluginResponse) {
    sections.push({
      title: 'Plugin Response',
      content: (
        <div className="p-2 rounded" style={{ background: 'var(--code-bg)' }}>
          <JsonTree data={p.pluginResponse} defaultExpanded={4} />
        </div>
      ),
    });
  }

  // 11. Client info / options (for user_prompt)
  if (p.clientInfo) {
    sections.push({
      title: 'Client Info',
      content: (
        <div className="p-2 rounded" style={{ background: 'var(--code-bg)' }}>
          <JsonTree data={p.clientInfo} defaultExpanded={2} />
        </div>
      ),
    });
  }
  if (p.optionsSets && p.optionsSets.length > 0) {
    sections.push({
      title: `Options Sets (${p.optionsSets.length})`,
      content: (
        <div className="flex flex-wrap gap-1">
          {p.optionsSets.map((o, i) => (
            <span key={i} className="px-1 py-0.5 rounded text-[11px] font-mono" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{o}</span>
          ))}
        </div>
      ),
    });
  }

  // 12. Diagnostic data (catch-all for anything else)
  if (p.diagnosticData && Object.keys(p.diagnosticData).length > 0) {
    sections.push({
      title: 'Diagnostic Data',
      content: (
        <div className="p-2 rounded" style={{ background: 'var(--code-bg)' }}>
          <JsonTree data={p.diagnosticData} defaultExpanded={3} />
        </div>
      ),
    });
  }

  if (sections.length === 0) {
    return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No parsed data available</div>;
  }

  return (
    <div className="space-y-3">
      {sections.map((s, i) => (
        <div key={i}>
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{s.title}</div>
          {s.content}
        </div>
      ))}
    </div>
  );
}

// ---- Raw Frame view: full JSON tree with deep expansion ----

function RawFrameView({ rawPayload }: { rawPayload: string }) {
  const frames = parseRawFrames(rawPayload);
  return (
    <div className="space-y-3">
      {frames.map((frame, i) => (
        <div key={i}>
          {frames.length > 1 && (
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Frame {i + 1}</div>
          )}
          <div className="p-2 rounded" style={{ background: 'var(--code-bg)' }}>
            <JsonTree data={frame} defaultExpanded={5} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 flex-shrink-0 text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span
        className={`break-all text-sm ${mono ? 'font-mono' : ''}`}
        style={{
          color: highlight ? 'var(--search-color)' : 'var(--text-primary)',
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function parseRawFrames(str: string): unknown[] {
  const parts = str.split('\x1e').filter(Boolean);
  return parts.map(part => {
    try { return JSON.parse(part); }
    catch { return part; }
  });
}

// ---- Source list with rich metadata from referenceMetadata ----

import type { CopilotSource } from '../../shared/types';

// referenceType → icon + label + color
const REF_TYPE_DISPLAY: Record<number, { icon: string; label: string; color: string }> = {
  0:  { icon: '📊', label: 'PowerPoint', color: '#d04423' },
  1:  { icon: '📗', label: 'Excel', color: '#217346' },
  2:  { icon: '📝', label: 'Word', color: '#2b579a' },
  3:  { icon: '📓', label: 'OneNote', color: '#7719aa' },
  4:  { icon: '📧', label: 'Email', color: 'var(--accent-text)' },
  5:  { icon: '💬', label: 'Teams Chat', color: 'var(--accent-text)' },
  7:  { icon: '📅', label: 'Meeting', color: 'var(--warning)' },
  9:  { icon: '📄', label: 'SharePoint', color: 'var(--accent-text)' },
  10: { icon: '🌐', label: 'Web', color: 'var(--text-secondary)' },
  11: { icon: '📕', label: 'PDF', color: '#e44c2c' },
  15: { icon: '🖼️', label: 'Image', color: 'var(--success)' },
  17: { icon: '🎥', label: 'Video', color: 'var(--warning)' },
  20: { icon: '🔗', label: 'Third Party', color: 'var(--text-secondary)' },
  24: { icon: '🔄', label: 'Loop', color: 'var(--accent-text)' },
};

// source.type fallback → icon + label + color
const TYPE_DISPLAY: Record<string, { icon: string; label: string; color: string }> = {
  file:    { icon: '📄', label: 'File', color: 'var(--accent-text)' },
  email:   { icon: '📧', label: 'Email', color: 'var(--accent-text)' },
  chat:    { icon: '💬', label: 'Teams Chat', color: 'var(--accent-text)' },
  meeting: { icon: '📅', label: 'Meeting', color: 'var(--warning)' },
  event:   { icon: '📅', label: 'Event', color: 'var(--warning)' },
  person:  { icon: '👤', label: 'Person', color: 'var(--accent-text)' },
  web:     { icon: '🌐', label: 'Web', color: 'var(--text-secondary)' },
};

interface SourceDisplay {
  icon: string;
  label: string;
  labelColor: string;
  displayName: string;
  context: string;    // "With Thomas Golles", "OneDrive", etc.
  cited: boolean;
}

function getSourceDisplay(source: CopilotSource): SourceDisplay {
  // ANNOTATION type (People, Events)
  if (source.sourceType === 'ANNOTATION') {
    if (source.annotationType === 'People') {
      return {
        icon: '👤', label: 'Person', labelColor: 'var(--accent-text)',
        displayName: source.personName || source.title,
        context: source.personEmail || '',
        cited: source.isCitedInResponse || false,
      };
    }
    if (source.annotationType === 'Event') {
      return {
        icon: '📅', label: 'Event', labelColor: 'var(--warning)',
        displayName: source.eventSubject || source.title,
        context: source.eventStart ? `Starts: ${new Date(source.eventStart).toLocaleString()}` : '',
        cited: source.isCitedInResponse || false,
      };
    }
  }

  // CITATION type — use referenceType for precise identification
  const refDisplay = source.referenceType !== undefined
    ? REF_TYPE_DISPLAY[source.referenceType]
    : undefined;

  const typeDisplay = TYPE_DISPLAY[source.type] || { icon: '📎', label: 'Source', color: 'var(--text-muted)' };
  const display = refDisplay || typeDisplay;

  // Check for meeting recordings (referenceType 17 or title/URL patterns)
  const title = source.title || '';
  const isRecording = source.referenceType === 17 ||
    title.toLowerCase().includes('recording') ||
    title.toLowerCase().includes('besprechungsaufzeichnung') ||
    title.toLowerCase().includes('aufnahme');

  return {
    icon: isRecording ? '🎥' : display.icon,
    label: isRecording ? 'Recording' : (source.fileType || display.label),
    labelColor: isRecording ? 'var(--warning)' : display.color,
    displayName: cleanTitle(title),
    context: source.context || source.dataSource || '',
    cited: source.isCitedInResponse || false,
  };
}

function cleanTitle(title: string): string {
  if (!title) return 'Unknown';
  if (title.startsWith('http://') || title.startsWith('https://')) return 'Unknown';
  try { title = decodeURIComponent(title); } catch {}
  return title;
}

function SourcesList({ sources }: { sources: CopilotSource[] }) {
  // Group by label
  const grouped = new Map<string, { display: SourceDisplay; source: CopilotSource }[]>();
  for (const source of sources) {
    const display = getSourceDisplay(source);
    const key = display.label;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push({ display, source });
  }

  // Sort groups
  const order = ['Word', 'PowerPoint', 'Excel', 'PDF', 'OneNote', 'Loop', 'SharePoint', 'File',
    'Recording', 'Video', 'Image', 'Meeting', 'Event', 'Teams Chat', 'Email', 'Person', 'Web', 'Third Party'];
  const sortedGroups = [...grouped.entries()].sort((a, b) => {
    const ai = order.indexOf(a[0]);
    const bi = order.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="space-y-3">
      {sortedGroups.map(([groupLabel, items]) => (
        <div key={groupLabel}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">{items[0].display.icon}</span>
            <span className="text-xs font-semibold" style={{ color: items[0].display.labelColor }}>{groupLabel}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({items.length})</span>
          </div>
          <div className="space-y-1 ml-1">
            {items.map(({ display, source }, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-2 py-1.5 rounded"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  opacity: display.cited ? 1 : 0.6,
                }}
              >
                <span className="text-sm flex-shrink-0 mt-px">{display.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {display.displayName}
                    </span>
                    {source.citationRefId && (
                      <span className="text-[10px] font-mono px-1 rounded" style={{ background: 'var(--accent-bg)', color: 'var(--accent-text)' }}>
                        {source.citationRefId}
                      </span>
                    )}
                    {!display.cited && (
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>not cited</span>
                    )}
                  </div>
                  {display.context && (
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{display.context}</div>
                  )}
                  {source.authorName && (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {source.authorName}{source.authorEmail ? ` (${source.authorEmail})` : ''}
                    </div>
                  )}
                  {source.snippet && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{source.snippet}</div>
                  )}
                  {source.url && (
                    <div className="text-[11px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{source.url}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
