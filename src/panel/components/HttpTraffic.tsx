import React, { useEffect, useState, useRef } from 'react';
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
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-semibold text-gray-200">📡 HTTP Traffic</span>
        <span className="text-xs text-gray-500 ml-2">{requests.length} requests</span>
      </div>

      {requests.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          <div className="text-center">
            <div className="text-3xl mb-2">📡</div>
            <div>No HTTP requests captured</div>
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
                  className={`message-row flex items-center gap-2 px-3 py-1 cursor-pointer border-b border-gray-800/30 ${isSelected ? 'selected' : ''}`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start}px)` }}
                  onClick={() => setSelected(isSelected ? null : req)}
                >
                  <span className="text-xs" style={{ color: cat.color }}>{cat.emoji}</span>
                  <span className="text-xs font-mono font-semibold w-10 flex-shrink-0 text-blue-300">{req.method}</span>
                  <span className="text-xs font-mono text-gray-400 truncate flex-1">{req.parsedUrl.host}{req.parsedUrl.pathname}</span>
                  <span className={`text-xs font-mono w-7 text-right ${req.statusCode >= 400 ? 'text-red-400' : 'text-green-400'}`}>
                    {req.statusCode || '—'}
                  </span>
                  <span className="text-xs text-gray-500 w-12 text-right font-mono">{req.timeMs}ms</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail */}
      {selected && (
        <div className="border-t h-[35%] overflow-auto p-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-200">{selected.method} {selected.url}</span>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
          </div>
          <div className="space-y-2 text-xs">
            <Row label="Category" value={CATEGORY_CONFIG[selected.category]?.label || selected.category} />
            <Row label="Status" value={String(selected.statusCode)} />
            <Row label="Time" value={`${selected.timeMs}ms`} />
            <Row label="Tab" value={selected.tabTitle || selected.tabUrl} />
            {selected.requestBody && (
              <div>
                <span className="text-gray-500">Request Body:</span>
                <pre className="text-gray-300 bg-gray-800/50 p-2 rounded font-mono text-xs mt-1 whitespace-pre-wrap max-h-32 overflow-auto">
                  {tryPretty(selected.requestBody)}
                </pre>
              </div>
            )}
            <div>
              <span className="text-gray-500">Request Headers:</span>
              <div className="mt-1 space-y-0.5">
                {Object.entries(selected.requestHeaders).map(([k, v]) => (
                  <div key={k} className="font-mono text-xs"><span className="text-blue-300">{k}:</span> <span className="text-gray-400">{v}</span></div>
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
    <div className="flex gap-3 text-xs">
      <span className="text-gray-500 w-16 flex-shrink-0">{label}</span>
      <span className="text-gray-300 break-all">{value}</span>
    </div>
  );
}

function tryPretty(s: string): string {
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}
