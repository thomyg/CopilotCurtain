import React, { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CapturedRequest } from '../../shared/types';
import { CATEGORY_CONFIG } from '../../shared/constants';
import { useStore } from '../hooks/useStore';

export default function HttpTraffic() {
  const requests = useStore((s) => s.requests);
  const [selected, setSelected] = useState<CapturedRequest | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: requests.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 20,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>📡 HTTP Traffic</span>
        <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{requests.length} requests</span>
      </div>

      {requests.length === 0 ? (
        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
          <div className="text-center">
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>No HTTP requests captured</div>
            <div className="text-xs mt-1">Enable HTTP monitoring to see Copilot-related API calls</div>
          </div>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-auto">
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((row) => {
              const req = requests[row.index];
              const cat = CATEGORY_CONFIG[req.category] || CATEGORY_CONFIG.other;
              const isSelected = selected?.id === req.id;

              return (
                <div
                  key={req.id}
                  ref={virtualizer.measureElement}
                  data-index={row.index}
                  className={`message-row flex items-center gap-2 px-3 py-1 cursor-pointer ${isSelected ? 'selected' : ''}`}
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%',
                    transform: `translateY(${row.start}px)`,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                  onClick={() => setSelected(isSelected ? null : req)}
                >
                  <span className="text-xs" style={{ color: cat.color }}>{cat.emoji}</span>
                  <span className="text-xs font-mono font-semibold w-10 flex-shrink-0" style={{ color: 'var(--accent-text)' }}>{req.method}</span>
                  <span className="text-xs font-mono truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{req.parsedUrl.host}{req.parsedUrl.pathname}</span>
                  <span className="text-xs font-mono w-7 text-right" style={{ color: req.statusCode >= 400 ? 'var(--danger)' : 'var(--success)' }}>
                    {req.statusCode || '—'}
                  </span>
                  <span className="text-xs w-12 text-right font-mono" style={{ color: 'var(--text-muted)' }}>{req.timeMs}ms</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <div className="h-[35%] overflow-auto p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selected.method} {selected.url}</span>
            <button onClick={() => setSelected(null)} className="text-lg leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Category" value={CATEGORY_CONFIG[selected.category]?.label || selected.category} />
            <Row label="Status" value={String(selected.statusCode)} />
            <Row label="Time" value={`${selected.timeMs}ms`} />
            <Row label="Tab" value={selected.tabTitle || selected.tabUrl} />
            {selected.requestBody && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Request Body:</span>
                <pre className="font-mono text-xs mt-1 p-2 rounded whitespace-pre-wrap max-h-32 overflow-auto" style={{ background: 'var(--code-bg)', color: 'var(--text-primary)' }}>
                  {tryPretty(selected.requestBody)}
                </pre>
              </div>
            )}
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Request Headers:</span>
              <div className="mt-1 space-y-0.5">
                {Object.entries(selected.requestHeaders).map(([k, v]) => (
                  <div key={k} className="font-mono text-xs"><span style={{ color: 'var(--accent-text)' }}>{k}:</span> <span style={{ color: 'var(--text-secondary)' }}>{v}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-16 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="break-all" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function tryPretty(s: string): string {
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}
