import{r as a,j as e,c as d,R as p}from"./client-LnavzBw-.js";const o=`
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
`;function g(){const[t,r]=a.useState(null),n=a.useCallback(async()=>{try{const s=await chrome.runtime.sendMessage({type:"MONITOR_STATUS"});s!=null&&s.data&&r(s.data)}catch{}},[]);a.useEffect(()=>{n();const s=setInterval(n,1e3);return()=>clearInterval(s)},[n]);const l=async()=>{t&&(await chrome.runtime.sendMessage({type:"TOGGLE_WS_MONITOR",enabled:!t.wsEnabled}),n())},i=async()=>{t&&(await chrome.runtime.sendMessage({type:"TOGGLE_HTTP_MONITOR",enabled:!t.httpEnabled}),n())},c=()=>{chrome.sidePanel.open({windowId:chrome.windows.WINDOW_ID_CURRENT}).catch(()=>{chrome.tabs.create({url:chrome.runtime.getURL("src/panel/index.html")})})};return t?e.jsxs(e.Fragment,{children:[e.jsx("style",{children:o}),e.jsxs("div",{className:"container",children:[e.jsxs("div",{className:"header",children:[e.jsx("span",{className:"title",children:"🎭 CopilotCurtain"}),e.jsx("span",{className:"version",children:"v1.0"})]}),e.jsxs("div",{className:"section",children:[e.jsxs("div",{className:"toggle-row",children:[e.jsx("span",{className:"toggle-label",children:"🤖 Copilot WebSocket"}),e.jsx("button",{className:`toggle ${t.wsEnabled?"on-purple":"off"}`,onClick:l})]}),e.jsxs("div",{className:"toggle-row",children:[e.jsx("span",{className:"toggle-label",children:"📡 HTTP Traffic"}),e.jsx("button",{className:`toggle ${t.httpEnabled?"on-blue":"off"}`,onClick:i})]}),t.wsEnabled&&e.jsx("div",{className:"warn",children:"⚠️ Chrome will show a debugger banner on captured tabs"})]}),e.jsx("div",{className:"section",children:e.jsx("button",{className:"btn",onClick:c,children:"📊 Open Dashboard"})}),e.jsxs("div",{className:"stats",children:[e.jsxs("span",{className:"stat",style:{color:"#a78bfa"},children:["🤖 ",t.conversationCount," convs"]}),e.jsxs("span",{className:"stat",style:{color:"#60a5fa"},children:[t.messageCount," msgs"]}),e.jsxs("span",{className:"stat",style:{color:"#34d399"},children:["🔌 ",t.pluginInvocationCount]})]})]})]}):e.jsxs(e.Fragment,{children:[e.jsx("style",{children:o}),e.jsx("div",{className:"container",style:{padding:"20px",textAlign:"center",color:"#94a3b8"},children:"Loading..."})]})}d(document.getElementById("root")).render(e.jsx(p.StrictMode,{children:e.jsx(g,{})}));
