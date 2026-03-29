import React, { useState, useEffect, useCallback } from 'react';
import type { MonitorState } from '../shared/types';

const style = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 280px;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    font-size: 14px;
    background: #ffffff;
    color: #242424;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #1b1b1b; color: #e0e0e0; }
    .section-bg { background: #2d2d2d; }
    .border-c { border-color: #404040; }
    .text-secondary { color: #a0a0a0; }
    .text-muted { color: #707070; }
    .btn { background: rgba(78,168,230,0.12); border-color: #4ea8e6; color: #4ea8e6; }
    .btn:hover { background: rgba(78,168,230,0.2); }
    .toggle.off { background: #404040; }
    .warn { color: #e69b00; }
  }
  @media (prefers-color-scheme: light) {
    .section-bg { background: #f5f5f5; }
    .border-c { border-color: #e0e0e0; }
    .text-secondary { color: #616161; }
    .text-muted { color: #a0a0a0; }
    .btn { background: rgba(15,108,189,0.08); border-color: #0f6cbd; color: #0f6cbd; }
    .btn:hover { background: rgba(15,108,189,0.15); }
    .toggle.off { background: #d0d0d0; }
    .warn { color: #c4710e; }
  }
  .container { padding: 12px; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .title { font-size: 14px; font-weight: 600; }
  .version { font-size: 10px; }
  .section { margin-bottom: 10px; }
  .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
  .toggle-label { font-size: 13px; }
  .toggle { position: relative; width: 40px; height: 22px; border-radius: 11px; cursor: pointer; transition: background 0.2s; border: none; }
  .toggle.on-accent { background: #0f6cbd; }
  .toggle.on-success { background: #0e7a0d; }
  .toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background: white; border-radius: 50%; transition: transform 0.2s; }
  .toggle.on-accent::after, .toggle.on-success::after { transform: translateX(18px); }
  .btn { width: 100%; padding: 8px; border: 1px solid; border-radius: 6px; cursor: pointer; font-size: 13px; text-align: center; transition: all 0.2s; }
  .stats { display: flex; gap: 6px; justify-content: center; margin-top: 8px; font-size: 12px; }
  .stat { display: flex; align-items: center; gap: 3px; }
  .warn { font-size: 11px; margin-top: 6px; text-align: center; line-height: 1.3; }
  @media (prefers-color-scheme: dark) {
    .toggle.on-accent { background: #4ea8e6; }
    .toggle.on-success { background: #54b054; }
  }
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

  if (!state) return <><style>{style}</style><div className="container text-secondary" style={{ padding: '20px', textAlign: 'center' }}>Loading...</div></>;

  return (
    <>
      <style>{style}</style>
      <div className="container">
        <div className="header">
          <span className="title">CopilotCurtain</span>
          <span className="version text-muted">v1.0</span>
        </div>

        <div className="section">
          <div className="toggle-row">
            <span className="toggle-label">Copilot WebSocket</span>
            <button className={`toggle ${state.wsEnabled ? 'on-accent' : 'off'}`} onClick={toggleWs} />
          </div>
          <div className="toggle-row">
            <span className="toggle-label">HTTP Traffic</span>
            <button className={`toggle ${state.httpEnabled ? 'on-success' : 'off'}`} onClick={toggleHttp} />
          </div>
          {state.wsEnabled && (
            <div className="warn">Chrome shows a debugger banner on captured tabs</div>
          )}
        </div>

        <div className="section">
          <button className="btn" onClick={openPanel}>Open Dashboard</button>
        </div>

        <div className="stats text-secondary">
          <span className="stat">{state.conversationCount} convs</span>
          <span className="stat">{state.messageCount} msgs</span>
          <span className="stat">{state.pluginInvocationCount} plugins</span>
        </div>
      </div>
    </>
  );
}
