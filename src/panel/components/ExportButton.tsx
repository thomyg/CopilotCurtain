import React, { useState } from 'react';
import type { CopilotWSMessage, CopilotConversation } from '../../shared/types';
import { useStore } from '../hooks/useStore';

interface Props {
  conversation: CopilotConversation;
}

export default function ExportButton({ conversation }: Props) {
  const [exporting, setExporting] = useState(false);
  const messages = useStore((s) => s.messages);

  const exportJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      tool: 'CopilotCurtain',
      conversation: {
        id: conversation.id,
        surface: conversation.surface,
        startedAt: new Date(conversation.startedAt).toISOString(),
        defaultChatName: conversation.defaultChatName,
        firstPrompt: conversation.firstPrompt,
        isAgent: conversation.isAgent,
        agentId: conversation.agentId,
        sensitivityLabel: conversation.sensitivityLabel,
        messageCount: conversation.messageCount,
      },
      messages: messages.map((m) => ({
        id: m.id,
        timestamp: new Date(m.timestamp).toISOString(),
        direction: m.direction,
        messageType: m.messageType,
        parsed: m.parsed,
      })),
    };
    downloadFile(
      JSON.stringify(data, null, 2),
      `copilot-trace-${slugify(conversation.defaultChatName || conversation.firstPrompt || conversation.id)}.json`,
      'application/json',
    );
  };

  const exportHTML = async () => {
    setExporting(true);
    try {
      const meaningful = messages.filter(
        (m) => m.parsed.type !== 'handshake' && m.parsed.type !== 'unknown' && m.parsed.type !== 'response_chunk' && m.parsed.type !== 'metrics',
      );

      const title = conversation.defaultChatName || conversation.firstPrompt || 'CopilotCurtain Trace';
      const html = buildHTMLReport(title, conversation, meaningful);
      downloadFile(
        html,
        `copilot-trace-${slugify(title)}.html`,
        'text/html',
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={exportJSON}
        className="text-[10px] px-1.5 py-0.5 rounded transition-all"
        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        title="Export as JSON"
      >
        JSON
      </button>
      <button
        onClick={exportHTML}
        disabled={exporting}
        className="text-[10px] px-1.5 py-0.5 rounded transition-all"
        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        title="Export as HTML report"
      >
        {exporting ? '...' : 'HTML'}
      </button>
    </div>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHTMLReport(title: string, conv: CopilotConversation, messages: CopilotWSMessage[]): string {
  const rows = messages.map((m) => {
    const p = m.parsed;
    const time = new Date(m.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dir = m.direction === 'sent' ? '→' : '←';

    let content = '';
    switch (p.type) {
      case 'user_prompt':
        content = `<div class="prompt">${escapeHtml(p.promptText || '')}</div>`;
        if (p.enabledPlugins?.length) content += `<div class="meta">Plugins: ${p.enabledPlugins.join(', ')}</div>`;
        if (p.isAgent) content += `<div class="meta agent-badge">Agent: ${escapeHtml(p.agentId || 'unknown')}</div>`;
        break;
      case 'search_progress':
        content = `<div class="search">${escapeHtml(p.progressText || p.searchQuery || '')}</div>`;
        if (p.searchScope) content += `<div class="meta">Scope: ${escapeHtml(p.searchScope)}</div>`;
        break;
      case 'response_final':
      case 'response_snapshot':
        content = `<div class="response">${escapeHtml(p.responseText || 'Response complete')}</div>`;
        if (p.sourceCount) content += `<div class="meta">${p.sourceCount} sources</div>`;
        if (p.suggestedResponses?.length) content += `<div class="meta">${p.suggestedResponses.length} suggestions</div>`;
        break;
      case 'conversation_state':
        content = `<div class="meta">${[p.defaultChatName ? `"${escapeHtml(p.defaultChatName)}"` : '', p.sensitivityLabel ? `[${escapeHtml(p.sensitivityLabel.displayName)}]` : '', p.turnState].filter(Boolean).join(' — ')}</div>`;
        break;
      case 'plugin_call':
        content = `<div class="plugin">Plugin: ${escapeHtml(p.pluginName || 'unknown')}</div>`;
        break;
      case 'disengaged':
        content = `<div class="error">${escapeHtml(p.errorMessage || 'Disengaged')}</div>`;
        break;
      default:
        content = `<div class="meta">${escapeHtml(p.contentOrigin || p.type)}</div>`;
    }

    // Sources
    if (p.sources && p.sources.length > 0) {
      content += '<div class="sources"><strong>Sources:</strong><ul>';
      for (const s of p.sources.slice(0, 20)) {
        content += `<li>${escapeHtml(s.title)}${s.fileType ? ` (${escapeHtml(s.fileType)})` : ''}${s.url ? ` — <a href="${escapeHtml(s.url)}">${escapeHtml(s.url.slice(0, 80))}</a>` : ''}</li>`;
      }
      if (p.sources.length > 20) content += `<li>... and ${p.sources.length - 20} more</li>`;
      content += '</ul></div>';
    }

    return `<tr><td class="time">${time}</td><td class="dir">${dir}</td><td class="type type-${p.type}">${p.type}</td><td>${content}</td></tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} — CopilotCurtain Trace</title>
<style>
  body { font-family: 'Segoe UI', -apple-system, sans-serif; font-size: 14px; margin: 0; padding: 20px; background: #1b1b1b; color: #e0e0e0; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .subtitle { color: #a0a0a0; font-size: 13px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #404040; color: #a0a0a0; font-size: 12px; }
  td { padding: 6px 8px; border-bottom: 1px solid #333; vertical-align: top; }
  .time { font-family: 'Cascadia Code', monospace; font-size: 12px; color: #707070; white-space: nowrap; width: 70px; }
  .dir { width: 20px; text-align: center; color: #a0a0a0; }
  .type { font-size: 11px; font-weight: 600; white-space: nowrap; width: 120px; }
  .type-user_prompt { color: #4ea8e6; }
  .type-search_progress { color: #d365c8; }
  .type-response_final, .type-response_snapshot { color: #4ea8e6; }
  .type-conversation_state { color: #4ea8e6; }
  .type-plugin_call { color: #54b054; }
  .type-disengaged { color: #f36d6d; }
  .prompt { background: rgba(78,168,230,0.1); padding: 8px; border-radius: 4px; white-space: pre-wrap; }
  .search { background: rgba(211,101,200,0.1); padding: 8px; border-radius: 4px; white-space: pre-wrap; }
  .response { background: rgba(255,255,255,0.03); padding: 8px; border-radius: 4px; white-space: pre-wrap; max-height: 300px; overflow: auto; }
  .plugin { background: rgba(84,176,84,0.1); padding: 8px; border-radius: 4px; }
  .error { background: rgba(243,109,109,0.1); padding: 8px; border-radius: 4px; color: #f36d6d; }
  .meta { font-size: 12px; color: #a0a0a0; margin-top: 4px; }
  .agent-badge { color: #54b054; }
  .sources { font-size: 12px; margin-top: 8px; color: #a0a0a0; }
  .sources ul { margin: 4px 0; padding-left: 16px; }
  .sources li { margin: 2px 0; }
  .sources a { color: #4ea8e6; }
  .footer { margin-top: 20px; font-size: 11px; color: #707070; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="subtitle">
  ${escapeHtml(conv.surface)} — ${new Date(conv.startedAt).toLocaleString()}
  ${conv.isAgent ? ' — Agent' : ' — Mainline'}
  ${conv.sensitivityLabel ? ` — [${escapeHtml(conv.sensitivityLabel)}]` : ''}
  — ${messages.length} events
</div>
<table>
<thead><tr><th>Time</th><th></th><th>Type</th><th>Content</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<div class="footer">Exported by CopilotCurtain at ${new Date().toISOString()}</div>
</body>
</html>`;
}
