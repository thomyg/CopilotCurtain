import React, { useState, useEffect, useCallback } from 'react';
import type { MonitorState } from '../shared/types';

const style = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 280px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0f0f1a; color: #e2e8f0; font-size: 13px; }
  .container { padding: 12px; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .title { font-size: 14px; font-weight: 600; color: #a78bfa; }
  .version { font-size: 10px; color: #64748b; }
  .section { margin-bottom: 10px; }
  .label { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
  .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
  .toggle-label { font-size: 12px; color: #e2e8f0; }
  .toggle { position: relative; width: 40px; height: 22px; border-radius: 11px; cursor: pointer; transition: background 0.2s; border: none; }
  .toggle.off { background: #334155; }
  .toggle.on-purple { background: #7c3aed; }
  .toggle.on-blue { background: #3b82f6; }
  .toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background: white; border-radius: 50%; transition: transform 0.2s; }
  .toggle.on-purple::after, .toggle.on-blue::after { transform: translateX(18px); }
  .btn { width: 100%; padding: 8px; border: 1px solid #7c3aed; border-radius: 6px; background: #7c3aed22; color: #a78bfa; cursor: pointer; font-size: 12px; text-align: center; transition: all 0.2s; }
  .btn:hover { background: #7c3aed33; }
  .stats { display: flex; gap: 6px; justify-content: center; margin-top: 8px; font-size: 11px; }
  .stat { display: flex; align-items: center; gap: 3px; }
  .warn { font-size: 10px; color: #f59e0b; margin-top: 6px; text-align: center; line-height: 1.3; }
`;

export default function Popup() {
  const [state, setState] = useState<MonitorState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'MONITOR_STATUS' });
      if (res?.data) setState(res.data);
    } catch {}
  }, []);

  useEffect(() => { refresh(); const i = setInterval(refresh, 1000); return () => clearInterval(i); }, [refresh]);

  const toggleWs = async () => {
    if (!state) return;
    await chrome.runtime.sendMessage({ type: 'TOGGLE_WS_MONITOR', enabled: !state.wsEnabled });
    refresh();
  };

  const toggleHttp = async () => {
    if (!state) return;
    await chrome.runtime.sendMessage({ type: 'TOGGLE_HTTP_MONITOR', enabled: !state.httpEnabled });
    refresh();
  };

  const openPanel = () => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT } as any).catch(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/panel/index.html') });
    });
  };

  if (!state) return <><style>{style}</style><div className="container" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div></>;

  return (
    <>
      <style>{style}</style>
      <div className="container">
        <div className="header">
          <span className="title">🎭 CopilotCurtain</span>
          <span className="version">v1.0</span>
        </div>

        <div className="section">
          <div className="toggle-row">
            <span className="toggle-label">🤖 Copilot WebSocket</span>
            <button className={`toggle ${state.wsEnabled ? 'on-purple' : 'off'}`} onClick={toggleWs} />
          </div>
          <div className="toggle-row">
            <span className="toggle-label">📡 HTTP Traffic</span>
            <button className={`toggle ${state.httpEnabled ? 'on-blue' : 'off'}`} onClick={toggleHttp} />
          </div>
          {state.wsEnabled && (
            <div className="warn">⚠️ Chrome will show a debugger banner on captured tabs</div>
          )}
        </div>

        <div className="section">
          <button className="btn" onClick={openPanel}>📊 Open Dashboard</button>
        </div>

        <div className="stats">
          <span className="stat" style={{ color: '#a78bfa' }}>🤖 {state.conversationCount} convs</span>
          <span className="stat" style={{ color: '#60a5fa' }}>{state.messageCount} msgs</span>
          <span className="stat" style={{ color: '#34d399' }}>🔌 {state.pluginInvocationCount}</span>
        </div>
      </div>
    </>
  );
}
