import React, { useMemo } from 'react';
import type { CopilotWSMessage } from '../../shared/types';

interface Props {
  messages: CopilotWSMessage[];
}

interface Milestone {
  label: string;
  timestamp: number;
}

interface Phase {
  label: string;
  start: number;
  end: number;
  colorVar: string;
  bgVar: string;
}

function formatAbsoluteTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions);
}

function formatDelta(ms: number): string {
  if (ms < 1000) return `+${ms}ms`;
  return `+${(ms / 1000).toFixed(2)}s`;
}

function extractMilestones(messages: CopilotWSMessage[]): Milestone[] {
  const milestones: Milestone[] = [];
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  let foundSearchProgress = false;
  let foundFirstToken = false;
  let foundResponseFinal = false;
  let foundConversationState = false;

  for (const msg of sorted) {
    const t = msg.parsed.type;

    if (t === 'user_prompt') {
      milestones.push({ label: 'Request Sent', timestamp: msg.timestamp });
    } else if (t === 'search_progress' && !foundSearchProgress) {
      foundSearchProgress = true;
      milestones.push({ label: 'Search Started', timestamp: msg.timestamp });
    } else if ((t === 'response_chunk' || t === 'response_snapshot') && !foundFirstToken) {
      foundFirstToken = true;
      milestones.push({ label: 'First Token', timestamp: msg.timestamp });
    } else if (t === 'response_final' && !foundResponseFinal) {
      foundResponseFinal = true;
      milestones.push({ label: 'Response Complete', timestamp: msg.timestamp });
    } else if (t === 'conversation_state' && !foundConversationState) {
      foundConversationState = true;
      milestones.push({ label: 'Turn Complete', timestamp: msg.timestamp });
    }
  }

  return milestones.sort((a, b) => a.timestamp - b.timestamp);
}

function extractClientMetrics(messages: CopilotWSMessage[]): Milestone[] {
  const metrics: Milestone[] = [];
  for (const msg of messages) {
    if (msg.parsed.type === 'metrics' && msg.parsed.timestamps) {
      for (const [key, value] of Object.entries(msg.parsed.timestamps)) {
        const ts = typeof value === 'string' ? Date.parse(value) : Number(value);
        if (!isNaN(ts) && ts > 0) {
          // Convert camelCase/PascalCase to readable label
          const label = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
          metrics.push({ label, timestamp: ts });
        }
      }
    }
  }
  return metrics.sort((a, b) => a.timestamp - b.timestamp);
}

function buildPhases(milestones: Milestone[]): Phase[] {
  const phases: Phase[] = [];
  const byLabel = Object.fromEntries(milestones.map((m) => [m.label, m.timestamp]));

  const promptTs = byLabel['Request Sent'];
  const firstTokenTs = byLabel['First Token'];
  const responseCompleteTs = byLabel['Response Complete'];

  if (promptTs != null && firstTokenTs != null) {
    phases.push({
      label: 'Search / Processing',
      start: promptTs,
      end: firstTokenTs,
      colorVar: 'var(--search-color)',
      bgVar: 'var(--search-bg)',
    });
  }

  if (firstTokenTs != null && responseCompleteTs != null) {
    phases.push({
      label: 'Streaming',
      start: firstTokenTs,
      end: responseCompleteTs,
      colorVar: 'var(--accent)',
      bgVar: 'var(--accent-bg)',
    });
  }

  return phases;
}

const styles = {
  container: {
    padding: '12px',
    fontSize: '12px',
    color: 'var(--text-primary)',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  heading: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    marginBottom: '8px',
  } as React.CSSProperties,
  chartContainer: {
    background: 'var(--bg-secondary)',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '12px',
    border: '1px solid var(--border)',
  } as React.CSSProperties,
  phaseRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  } as React.CSSProperties,
  phaseLabel: {
    width: '110px',
    flexShrink: 0,
    fontSize: '11px',
    color: 'var(--text-secondary)',
    textAlign: 'right' as const,
  } as React.CSSProperties,
  barTrack: {
    flex: 1,
    height: '18px',
    borderRadius: '4px',
    background: 'var(--code-bg)',
    position: 'relative' as const,
    overflow: 'hidden',
  } as React.CSSProperties,
  phaseDuration: {
    width: '60px',
    flexShrink: 0,
    fontSize: '11px',
    color: 'var(--text-muted)',
    textAlign: 'right' as const,
  } as React.CSSProperties,
  totalRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px',
    paddingTop: '6px',
    borderTop: '1px solid var(--border)',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '11px',
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '4px 8px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontWeight: 500,
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  td: {
    padding: '4px 8px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  tdMuted: {
    padding: '4px 8px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
    fontSize: '11px',
  } as React.CSSProperties,
  deltaBadge: {
    display: 'inline-block',
    padding: '1px 5px',
    borderRadius: '3px',
    background: 'var(--code-bg)',
    color: 'var(--text-secondary)',
    fontFamily: 'monospace',
    fontSize: '10px',
  } as React.CSSProperties,
  empty: {
    color: 'var(--text-muted)',
    fontStyle: 'italic' as const,
    padding: '16px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  section: {
    marginTop: '12px',
  } as React.CSSProperties,
};

export default function TimingBreakdown({ messages }: Props) {
  const milestones = useMemo(() => extractMilestones(messages), [messages]);
  const clientMetrics = useMemo(() => extractClientMetrics(messages), [messages]);
  const phases = useMemo(() => buildPhases(milestones), [milestones]);

  if (milestones.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>No timing data available for this conversation turn.</div>
      </div>
    );
  }

  const totalStart = milestones[0].timestamp;
  const totalEnd = milestones[milestones.length - 1].timestamp;
  const totalDuration = totalEnd - totalStart;

  return (
    <div style={styles.container}>
      {/* Waterfall Chart */}
      <div style={styles.heading}>Latency Breakdown</div>
      <div style={styles.chartContainer}>
        {phases.map((phase) => {
          const duration = phase.end - phase.start;
          const offsetPct = totalDuration > 0 ? ((phase.start - totalStart) / totalDuration) * 100 : 0;
          const widthPct = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;

          return (
            <div key={phase.label} style={styles.phaseRow}>
              <div style={styles.phaseLabel}>{phase.label}</div>
              <div style={styles.barTrack}>
                <div
                  style={{
                    position: 'absolute',
                    left: `${offsetPct}%`,
                    width: `${Math.max(widthPct, 1)}%`,
                    height: '100%',
                    borderRadius: '3px',
                    background: phase.bgVar,
                    border: `1px solid ${phase.colorVar}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {widthPct > 15 && (
                    <span
                      style={{
                        fontSize: '10px',
                        color: phase.colorVar,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`}
                    </span>
                  )}
                </div>
              </div>
              <div style={styles.phaseDuration}>
                {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`}
              </div>
            </div>
          );
        })}

        {/* Total row */}
        <div style={styles.totalRow}>
          <div style={styles.phaseLabel}>Total Turn</div>
          <div style={{ ...styles.barTrack, opacity: 0.5 }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: '3px',
                background: 'var(--text-muted)',
                opacity: 0.15,
              }}
            />
          </div>
          <div style={{ ...styles.phaseDuration, fontWeight: 600, color: 'var(--text-primary)' }}>
            {totalDuration < 1000 ? `${totalDuration}ms` : `${(totalDuration / 1000).toFixed(2)}s`}
          </div>
        </div>
      </div>

      {/* Milestones Table */}
      <div style={styles.heading}>Milestones</div>
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Event</th>
              <th style={styles.th}>Time</th>
              <th style={styles.th}>Delta</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((m, i) => {
              const prevTs = i > 0 ? milestones[i - 1].timestamp : null;
              const delta = prevTs != null ? m.timestamp - prevTs : null;

              return (
                <tr key={`${m.label}-${m.timestamp}`}>
                  <td style={styles.td}>{m.label}</td>
                  <td style={styles.tdMuted}>{formatAbsoluteTime(m.timestamp)}</td>
                  <td style={styles.td}>
                    {delta != null ? (
                      <span style={styles.deltaBadge}>{formatDelta(delta)}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Client Metrics */}
      {clientMetrics.length > 0 && (
        <div style={styles.section}>
          <div style={styles.heading}>Client Metrics</div>
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Metric</th>
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>Delta</th>
                </tr>
              </thead>
              <tbody>
                {clientMetrics.map((m, i) => {
                  const prevTs = i > 0 ? clientMetrics[i - 1].timestamp : null;
                  const delta = prevTs != null ? m.timestamp - prevTs : null;

                  return (
                    <tr key={`${m.label}-${m.timestamp}`}>
                      <td style={styles.td}>{m.label}</td>
                      <td style={styles.tdMuted}>{formatAbsoluteTime(m.timestamp)}</td>
                      <td style={styles.td}>
                        {delta != null ? (
                          <span style={styles.deltaBadge}>{formatDelta(delta)}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
