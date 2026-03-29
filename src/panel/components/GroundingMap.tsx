import React, { useMemo, useState } from 'react';
import { CopilotSource } from '../../shared/types';

interface Props {
  responseText: string;
  adaptiveCardText?: string;
  sources: CopilotSource[];
}

const REFERENCE_TYPE_ICONS: Record<number, string> = {
  0: '📊',   // PowerPoint
  1: '📗',   // Excel
  2: '📝',   // Word
  3: '📓',   // OneNote
  4: '📧',   // Email
  5: '💬',   // Teams Chat
  7: '📅',   // Meeting
  9: '📄',   // SharePoint
  10: '🌐',  // Web
  11: '📕',  // PDF
  15: '🖼️',  // Image
  17: '🎥',  // Video
  24: '🔄',  // Loop
};

interface ParsedCitation {
  refId: string;       // e.g. "turn1search30"
  index: number;       // display number (1-based, deduplicated order)
}

interface TextSegment {
  type: 'text' | 'citation';
  content: string;
  citations?: ParsedCitation[];
}

/**
 * Parse citeturn\d+search\d+ patterns from response text.
 * They may be concatenated: "citeturn1search30turn1search33"
 * should yield ["turn1search30", "turn1search33"].
 */
function extractCiteRefs(raw: string): string[] {
  const refs: string[] = [];
  const pattern = /turn\d+search\d+/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(raw)) !== null) {
    refs.push(m[0]);
  }
  return refs;
}

/**
 * Parse [N](url) markdown links from adaptive card text.
 */
function extractAdaptiveCardLinks(text: string): { index: number; url: string }[] {
  const results: { index: number; url: string }[] = [];
  const pattern = /\[(\d+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    results.push({ index: parseInt(m[1], 10), url: m[2] });
  }
  return results;
}

/**
 * Build a stable mapping from refId -> display number (1-based, in order of first appearance).
 */
function buildRefIndexMap(responseText: string): Map<string, number> {
  const map = new Map<string, number>();
  const allRefs = extractCiteRefs(responseText);
  let counter = 1;
  for (const ref of allRefs) {
    if (!map.has(ref)) {
      map.set(ref, counter++);
    }
  }
  return map;
}

/**
 * Split the response text into segments of plain text and citation groups.
 */
function parseResponseText(
  responseText: string,
  refIndexMap: Map<string, number>
): TextSegment[] {
  const segments: TextSegment[] = [];
  // Match one or more concatenated cite references: "citeturn1search30turn1search33"
  const citeBlockPattern = /cite((?:turn\d+search\d+)+)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = citeBlockPattern.exec(responseText)) !== null) {
    // Text before this cite block
    if (m.index > lastIndex) {
      segments.push({ type: 'text', content: responseText.slice(lastIndex, m.index) });
    }
    // Extract individual refs from the block
    const refs = extractCiteRefs(m[1]);
    const citations: ParsedCitation[] = refs.map((refId) => ({
      refId,
      index: refIndexMap.get(refId) ?? 0,
    }));
    segments.push({
      type: 'citation',
      content: m[0],
      citations,
    });
    lastIndex = m.index + m[0].length;
  }

  // Trailing text
  if (lastIndex < responseText.length) {
    segments.push({ type: 'text', content: responseText.slice(lastIndex) });
  }

  return segments;
}

const GroundingMap: React.FC<Props> = ({ responseText, adaptiveCardText, sources }) => {
  const [hoveredRefIds, setHoveredRefIds] = useState<Set<string>>(new Set());

  const refIndexMap = useMemo(() => buildRefIndexMap(responseText), [responseText]);
  const segments = useMemo(() => parseResponseText(responseText, refIndexMap), [responseText, refIndexMap]);
  const adaptiveLinks = useMemo(
    () => (adaptiveCardText ? extractAdaptiveCardLinks(adaptiveCardText) : []),
    [adaptiveCardText]
  );

  // Build a set of all cited refIds
  const citedRefIds = useMemo(() => {
    const set = new Set<string>();
    refIndexMap.forEach((_val, refId) => {
      set.add(refId);
    });
    return set;
  }, [refIndexMap]);

  // Partition sources into cited vs uncited
  const { citedSources, uncitedSources } = useMemo(() => {
    const cited: (CopilotSource & { displayIndex: number })[] = [];
    const uncited: CopilotSource[] = [];

    for (const src of sources) {
      if (src.citationRefId && citedRefIds.has(src.citationRefId)) {
        cited.push({ ...src, displayIndex: refIndexMap.get(src.citationRefId) ?? 0 });
      } else {
        uncited.push(src);
      }
    }

    // Sort cited sources by display index
    cited.sort((a, b) => a.displayIndex - b.displayIndex);

    return { citedSources: cited, uncitedSources: uncited };
  }, [sources, citedRefIds, refIndexMap]);

  const getTypeIcon = (src: CopilotSource): string => {
    if (src.referenceType !== undefined && REFERENCE_TYPE_ICONS[src.referenceType]) {
      return REFERENCE_TYPE_ICONS[src.referenceType];
    }
    // Fallback by type string
    switch (src.type) {
      case 'email': return '📧';
      case 'chat': return '💬';
      case 'web': return '🌐';
      case 'meeting': return '📅';
      case 'file': return '📄';
      default: return '📄';
    }
  };

  const isSourceHighlighted = (src: CopilotSource): boolean => {
    return !!src.citationRefId && hoveredRefIds.has(src.citationRefId);
  };

  const handleBadgeHover = (citations: ParsedCitation[]) => {
    setHoveredRefIds(new Set(citations.map((c) => c.refId)));
  };

  const handleBadgeLeave = () => {
    setHoveredRefIds(new Set());
  };

  // If there are no citations and no sources, show a minimal message
  if (segments.length <= 1 && citedSources.length === 0 && uncitedSources.length === 0) {
    return (
      <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>
        No grounding data available for this message.
      </div>
    );
  }

  return (
    <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
      {/* Response text with inline citation badges */}
      <div
        style={{
          padding: '12px 14px',
          background: 'var(--bg-secondary)',
          borderRadius: 6,
          border: '1px solid var(--border)',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {segments.map((seg, i) => {
          if (seg.type === 'text') {
            return <span key={i}>{seg.content}</span>;
          }
          // Citation badges
          return (
            <span
              key={i}
              onMouseEnter={() => seg.citations && handleBadgeHover(seg.citations)}
              onMouseLeave={handleBadgeLeave}
              style={{ display: 'inline' }}
            >
              {seg.citations?.map((cite, j) => (
                <span
                  key={j}
                  style={{
                    display: 'inline-block',
                    background: 'var(--accent-bg)',
                    color: 'var(--accent-text)',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: 4,
                    marginLeft: 1,
                    marginRight: 1,
                    cursor: 'pointer',
                    verticalAlign: 'super',
                    lineHeight: 1,
                    transition: 'opacity 0.15s',
                  }}
                  title={cite.refId}
                >
                  [{cite.index}]
                </span>
              ))}
            </span>
          );
        })}
      </div>

      {/* Adaptive card links, if any */}
      {adaptiveLinks.length > 0 && (
        <div style={{ marginTop: 10, padding: '8px 14px', background: 'var(--code-bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Adaptive Card Links
          </div>
          {adaptiveLinks.map((link, i) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 2 }}>
              <span style={{ color: 'var(--accent-text)', fontWeight: 600 }}>[{link.index}]</span>{' '}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent-text)', textDecoration: 'underline', wordBreak: 'break-all' }}
              >
                {link.url}
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Cited sources */}
      {citedSources.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Cited Sources
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {citedSources.map((src) => (
              <div
                key={src.displayIndex}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 5,
                  border: '1px solid var(--border)',
                  background: isSourceHighlighted(src) ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                  transition: 'background 0.15s, border-color 0.15s',
                  borderColor: isSourceHighlighted(src) ? 'var(--accent-text)' : 'var(--border)',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 24,
                    height: 24,
                    borderRadius: 4,
                    background: 'var(--accent-bg)',
                    color: 'var(--accent-text)',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {src.displayIndex}
                </span>
                <span style={{ fontSize: 16, lineHeight: '24px', flexShrink: 0 }}>
                  {getTypeIcon(src)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13, lineHeight: '20px' }}>
                    {src.title}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                    {src.citationRefId && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--code-bg)', padding: '1px 4px', borderRadius: 3 }}>
                        {src.citationRefId}
                      </span>
                    )}
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}
                        title={src.url}
                      >
                        {src.url}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uncited sources */}
      {uncitedSources.length > 0 && (
        <div style={{ marginTop: 12, opacity: 0.6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Uncited Sources
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {uncitedSources.map((src, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 5,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                }}
              >
                <span style={{ fontSize: 14, lineHeight: '20px', flexShrink: 0 }}>
                  {getTypeIcon(src)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 13, lineHeight: '20px' }}>
                    {src.title}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                    {src.citationRefId && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--code-bg)', padding: '1px 4px', borderRadius: 3 }}>
                        {src.citationRefId}
                      </span>
                    )}
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}
                        title={src.url}
                      >
                        {src.url}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroundingMap;
