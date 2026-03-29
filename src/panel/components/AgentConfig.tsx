import React from 'react';
import type { CopilotConversation, CopilotWSMessage } from '../../shared/types';
import { useStore } from '../hooks/useStore';
import JsonTree from './JsonTree';

interface Props {
  conversation: CopilotConversation;
}

export default function AgentConfig({ conversation }: Props) {
  const messages = useStore((s) => s.messages);

  // Find user_prompt messages that contain agent info
  const promptMessages = messages.filter((m) => m.parsed.type === 'user_prompt');

  // Extract gpts data from the raw frames
  const agentData = React.useMemo(() => {
    for (const msg of promptMessages) {
      // Parse raw payload to extract gpts[]
      const frames = msg.rawPayload.split('\x1e').filter(Boolean);
      for (const frame of frames) {
        try {
          const json = JSON.parse(frame);
          const args = json.arguments?.[0];
          if (!args) continue;

          const gpts = args.gpts;
          const threadLevelGptId = args.threadLevelGptId;
          const plugins = args.plugins;
          const tone = args.tone;
          const streamingMode = args.streamingMode;
          const optionsSets = args.optionsSets;
          const allowedMessageTypes = args.allowedMessageTypes;

          if (gpts || threadLevelGptId) {
            return {
              gpts,
              threadLevelGptId,
              plugins,
              tone,
              streamingMode,
              optionsSets,
              allowedMessageTypes,
              isAgent: conversation.isAgent || false,
              agentId: conversation.agentId,
            };
          }
        } catch {}
      }
    }
    return null;
  }, [promptMessages, conversation]);

  // Find conversation_state messages for additional metadata
  const stateMsg = messages.find((m) => m.parsed.type === 'conversation_state');

  if (!conversation.isAgent && !agentData?.gpts) {
    return (
      <div className="p-4">
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Agent Configuration</div>
        <div className="p-3 rounded" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            This is a <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>mainline chat</span> — no declarative agent detected.
          </div>
          <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            When a conversation uses a declarative agent, the <code style={{ background: 'var(--code-bg)', padding: '1px 4px', borderRadius: '2px' }}>gpts[]</code> array and <code style={{ background: 'var(--code-bg)', padding: '1px 4px', borderRadius: '2px' }}>threadLevelGptId</code> fields in the user prompt will be populated with agent configuration.
          </div>
        </div>

        {/* Still show general config */}
        {agentData && <GeneralConfig data={agentData} />}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Agent Configuration</div>

      {/* Agent identity */}
      <div className="p-3 rounded" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--plugin-bg)', color: 'var(--plugin-color)' }}>
            Declarative Agent
          </span>
          {conversation.defaultChatName && (
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {conversation.defaultChatName}
            </span>
          )}
        </div>

        {conversation.agentId && (
          <div className="flex gap-3 text-xs mb-1">
            <span style={{ color: 'var(--text-muted)' }}>Agent ID</span>
            <span className="font-mono break-all" style={{ color: 'var(--text-secondary)' }}>{conversation.agentId}</span>
          </div>
        )}

        {conversation.sensitivityLabel && (
          <div className="flex gap-3 text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Sensitivity</span>
            <span className="px-1.5 py-0.5 rounded" style={{
              color: conversation.sensitivityColor || 'var(--text-muted)',
              border: `1px solid ${conversation.sensitivityColor || 'var(--border)'}`,
            }}>
              {conversation.sensitivityLabel}
            </span>
          </div>
        )}
      </div>

      {/* GPTs array */}
      {agentData?.gpts && agentData.gpts.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
            GPT Configuration ({agentData.gpts.length})
          </div>
          {agentData.gpts.map((gpt: any, i: number) => (
            <div key={i} className="p-3 rounded mb-2" style={{ background: 'var(--code-bg)', border: '1px solid var(--border-subtle)' }}>
              <div className="space-y-1 text-xs mb-2">
                <KV label="ID" value={gpt.id} mono />
                <KV label="Source" value={gpt.source} />
                {gpt.version && <KV label="Version" value={gpt.version} />}
              </div>
              {gpt.clientOverrides && Object.keys(gpt.clientOverrides).length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Client Overrides</div>
                  <JsonTree data={gpt.clientOverrides} defaultExpanded={3} />
                </div>
              )}
              {gpt.metaOSGlobalIdentifier && (
                <div className="mt-2">
                  <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>MetaOS Global Identifier</div>
                  <JsonTree data={gpt.metaOSGlobalIdentifier} defaultExpanded={3} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* threadLevelGptId */}
      {agentData?.threadLevelGptId && (
        <div>
          <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Thread-Level GPT ID</div>
          <div className="p-2 rounded" style={{ background: 'var(--code-bg)' }}>
            <JsonTree data={agentData.threadLevelGptId} defaultExpanded={3} />
          </div>
        </div>
      )}

      {/* General config */}
      {agentData && <GeneralConfig data={agentData} />}

      {/* Conversation state metadata */}
      {stateMsg?.parsed.diagnosticData && (
        <div>
          <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Conversation State</div>
          <div className="p-2 rounded" style={{ background: 'var(--code-bg)' }}>
            <JsonTree data={stateMsg.parsed.diagnosticData} defaultExpanded={2} />
          </div>
        </div>
      )}
    </div>
  );
}

function GeneralConfig({ data }: { data: any }) {
  return (
    <>
      {/* Plugins */}
      {data.plugins && data.plugins.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Plugins ({data.plugins.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {data.plugins.map((p: any, i: number) => (
              <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--plugin-bg)', color: 'var(--plugin-color)' }}>
                {p.Id || p.id || p.Name || p.name || JSON.stringify(p)}
                {p.Source && <span style={{ color: 'var(--text-muted)' }}> ({p.Source})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tone & streaming */}
      {(data.tone || data.streamingMode) && (
        <div className="flex gap-4 text-xs">
          {data.tone && <KV label="Tone" value={data.tone} />}
          {data.streamingMode && <KV label="Streaming" value={data.streamingMode} />}
        </div>
      )}

      {/* Allowed message types */}
      {data.allowedMessageTypes && data.allowedMessageTypes.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Allowed Message Types ({data.allowedMessageTypes.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {data.allowedMessageTypes.map((t: string, i: number) => {
              const isInteresting = /plugin|agent|tool|code|image|memory|search/i.test(t);
              return (
                <span key={i} className="text-[11px] font-mono px-1 py-0.5 rounded" style={{
                  background: isInteresting ? 'var(--accent-bg)' : 'var(--bg-tertiary)',
                  color: isInteresting ? 'var(--accent-text)' : 'var(--text-muted)',
                }}>
                  {t}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-xs">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={mono ? 'font-mono break-all' : ''} style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
