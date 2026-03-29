import React from 'react';
import type { CopilotParsedMessage } from '../../shared/types';

interface Props {
  parsed: CopilotParsedMessage;
}

// Keywords that mark an option-set flag as "interesting" (accent-colored)
const ACCENT_KEYWORDS = ['plugin', 'agent', 'code_interpreter', 'memory', 'image'];

function isAccentOption(opt: string): boolean {
  const lower = opt.toLowerCase();
  return ACCENT_KEYWORDS.some((kw) => lower.includes(kw));
}

// Entity annotation type labels derived from searchScope string
const ENTITY_TYPES = ['People', 'File', 'Event', 'Email', 'TeamsMessage'] as const;

function extractEntityTypes(searchScope: string): string[] {
  return ENTITY_TYPES.filter((t) => searchScope.toLowerCase().includes(t.toLowerCase()));
}

// Client-info key → display label mapping
const CLIENT_INFO_LABELS: Record<string, string> = {
  platform: 'Platform',
  appName: 'App Name',
  entryPoint: 'Entry Point',
  deviceOS: 'Device OS',
  deviceType: 'Device Type',
  clientName: 'App Name',
  appPlatform: 'Platform',
};

// ---- Section wrapper ----

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.06em' }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

// ---- Entity annotation types sub-component ----

function EntityAnnotationTypes({ types }: { types: string[] }) {
  if (types.length === 0) return null;
  return (
    <Section label="Entity Annotation Types">
      <div className="flex flex-wrap gap-1.5">
        {types.map((et) => (
          <span
            key={et}
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{
              background: 'var(--accent-bg)',
              color: 'var(--accent-text)',
            }}
          >
            {et}
          </span>
        ))}
      </div>
    </Section>
  );
}

// ---- Main component ----

export default function PromptInspector({ parsed }: Props) {
  const p = parsed;

  const hasPlugins = p.enabledPlugins && p.enabledPlugins.length > 0;
  const hasOptionsSets = p.optionsSets && p.optionsSets.length > 0;
  const hasClientInfo = p.clientInfo && Object.keys(p.clientInfo).length > 0;
  const entityTypes: string[] = p.searchScope ? extractEntityTypes(p.searchScope) : [];

  return (
    <div className="text-sm" style={{ color: 'var(--text-primary)', fontSize: 14 }}>

      {/* 1. Prompt Text */}
      {p.promptText && (
        <Section label="Prompt Text">
          <div
            className="rounded"
            style={{
              background: 'var(--code-bg)',
              padding: '10px 12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.55,
              color: 'var(--text-primary)',
              borderRadius: 6,
            }}
          >
            {p.promptText}
          </div>
        </Section>
      )}

      {/* 2. Type */}
      <Section label="Type">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: p.isAgent ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-tertiary)',
              color: p.isAgent ? '#22c55e' : 'var(--text-secondary)',
            }}
          >
            {p.isAgent ? 'Agent' : 'Mainline'}
          </span>
          {p.agentId && (
            <span
              className="text-xs font-mono"
              style={{ color: 'var(--text-muted)' }}
            >
              {p.agentId}
            </span>
          )}
        </div>
      </Section>

      {/* 3. Plugins */}
      {hasPlugins && (
        <Section label="Plugins">
          <div className="flex flex-wrap gap-1.5">
            {p.enabledPlugins!.map((plugin) => (
              <span
                key={plugin}
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--plugin-bg)',
                  color: 'var(--plugin-color)',
                }}
              >
                {plugin}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* 4. Entity Annotation Types */}
      <EntityAnnotationTypes types={entityTypes} />

      {/* 5. Options Sets */}
      {hasOptionsSets && (
        <Section label={`Options Sets (${p.optionsSets!.length})`}>
          <div className="flex flex-wrap gap-1" style={{ lineHeight: 1 }}>
            {p.optionsSets!.map((opt) => {
              const accent = isAccentOption(opt);
              return (
                <span
                  key={opt}
                  className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: accent ? 'var(--accent-bg)' : 'var(--bg-tertiary)',
                    color: accent ? 'var(--accent-text)' : 'var(--text-muted)',
                    fontSize: 11,
                  }}
                >
                  {opt}
                </span>
              );
            })}
          </div>
        </Section>
      )}

      {/* 6. Client Info */}
      {hasClientInfo && (
        <Section label="Client Info">
          <div
            className="grid gap-y-1"
            style={{ gridTemplateColumns: 'auto 1fr', columnGap: 12 }}
          >
            {Object.entries(p.clientInfo!).map(([key, value]) => {
              const label = CLIENT_INFO_LABELS[key] || key;
              return (
                <React.Fragment key={key}>
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {String(value)}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </Section>
      )}

      {/* 7. Streaming Mode */}
      {p.streamingMode && (
        <Section label="Streaming Mode">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
          >
            {p.streamingMode}
          </span>
        </Section>
      )}

      {/* 8. Tone (from diagnosticData if available) */}
      {p.diagnosticData?.tone != null ? (
        <Section label="Tone">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
          >
            {String(p.diagnosticData.tone)}
          </span>
        </Section>
      ) : null}
    </div>
  );
}
