import React, { useState } from 'react';

interface Props {
  data: unknown;
  defaultExpanded?: number; // depth to auto-expand, default 2
}

export default function JsonTree({ data, defaultExpanded = 2 }: Props) {
  return (
    <div className="font-mono text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
      <JsonNode value={data} depth={0} defaultExpanded={defaultExpanded} keyName={undefined} isLast={true} />
    </div>
  );
}

function JsonNode({
  value,
  depth,
  defaultExpanded,
  keyName,
  isLast,
}: {
  value: unknown;
  depth: number;
  defaultExpanded: number;
  keyName: string | undefined;
  isLast: boolean;
}) {
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const [expanded, setExpanded] = useState(depth < defaultExpanded);

  const comma = isLast ? '' : ',';

  if (!isExpandable) {
    return (
      <span>
        {keyName !== undefined && <Key name={keyName} />}
        <Scalar value={value} />
        {comma}
      </span>
    );
  }

  const entries = isArray ? value : Object.entries(value as Record<string, unknown>);
  const count = isArray ? value.length : Object.keys(value as Record<string, unknown>).length;
  const open = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';

  if (count === 0) {
    return (
      <span>
        {keyName !== undefined && <Key name={keyName} />}
        <span style={{ color: 'var(--text-muted)' }}>{open}{close}</span>
        {comma}
      </span>
    );
  }

  if (!expanded) {
    return (
      <span>
        {keyName !== undefined && <Key name={keyName} />}
        <button
          onClick={() => setExpanded(true)}
          className="inline px-0 border-0 bg-transparent cursor-pointer"
          style={{ color: 'var(--text-muted)', font: 'inherit' }}
        >
          {open} <span style={{ color: 'var(--accent-text)' }}>{count} {isArray ? 'items' : 'keys'}</span> {close}
        </button>
        {comma}
      </span>
    );
  }

  return (
    <span>
      {keyName !== undefined && <Key name={keyName} />}
      <button
        onClick={() => setExpanded(false)}
        className="inline px-0 border-0 bg-transparent cursor-pointer"
        style={{ color: 'var(--text-muted)', font: 'inherit' }}
      >
        {open}
      </button>
      <div style={{ paddingLeft: '16px' }}>
        {isArray
          ? (value as unknown[]).map((item, i) => (
              <div key={i}>
                <JsonNode
                  value={item}
                  depth={depth + 1}
                  defaultExpanded={defaultExpanded}
                  keyName={undefined}
                  isLast={i === count - 1}
                />
              </div>
            ))
          : Object.entries(value as Record<string, unknown>).map(([k, v], i) => (
              <div key={k}>
                <JsonNode
                  value={v}
                  depth={depth + 1}
                  defaultExpanded={defaultExpanded}
                  keyName={k}
                  isLast={i === count - 1}
                />
              </div>
            ))}
      </div>
      <span style={{ color: 'var(--text-muted)' }}>{close}</span>
      {comma}
    </span>
  );
}

function Key({ name }: { name: string }) {
  return (
    <span>
      <span style={{ color: 'var(--accent-text)' }}>"{name}"</span>
      <span style={{ color: 'var(--text-muted)' }}>: </span>
    </span>
  );
}

function Scalar({ value }: { value: unknown }) {
  if (value === null) return <span style={{ color: 'var(--text-muted)' }}>null</span>;
  if (typeof value === 'boolean') return <span style={{ color: 'var(--warning)' }}>{String(value)}</span>;
  if (typeof value === 'number') return <span style={{ color: 'var(--success)' }}>{value}</span>;
  if (typeof value === 'string') {
    // Truncate very long strings but show full on hover
    const display = value.length > 200 ? value.slice(0, 200) + '...' : value;
    return <span title={value.length > 200 ? value : undefined} style={{ color: 'var(--danger)' }}>"{display}"</span>;
  }
  return <span style={{ color: 'var(--text-muted)' }}>{String(value)}</span>;
}
