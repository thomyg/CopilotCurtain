import{r as o,j as e,c as d,R as g}from"./client-LnavzBw-.js";const a=`
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
`;function p(){const[t,r]=o.useState(null),n=o.useCallback(async()=>{try{const s=await chrome.runtime.sendMessage({type:"MONITOR_STATUS"});s!=null&&s.data&&r(s.data)}catch{}},[]);o.useEffect(()=>{n();const s=setInterval(n,1e3);return()=>clearInterval(s)},[n]);const c=async()=>{t&&(await chrome.runtime.sendMessage({type:"TOGGLE_WS_MONITOR",enabled:!t.wsEnabled}),n())},i=async()=>{t&&(await chrome.runtime.sendMessage({type:"TOGGLE_HTTP_MONITOR",enabled:!t.httpEnabled}),n())},l=()=>{chrome.sidePanel.open({windowId:chrome.windows.WINDOW_ID_CURRENT}).catch(()=>{chrome.tabs.create({url:chrome.runtime.getURL("src/panel/index.html")})})};return t?e.jsxs(e.Fragment,{children:[e.jsx("style",{children:a}),e.jsxs("div",{className:"container",children:[e.jsxs("div",{className:"header",children:[e.jsx("span",{className:"title",children:"CopilotCurtain"}),e.jsx("span",{className:"version text-muted",children:"v1.0"})]}),e.jsxs("div",{className:"section",children:[e.jsxs("div",{className:"toggle-row",children:[e.jsx("span",{className:"toggle-label",children:"Copilot WebSocket"}),e.jsx("button",{className:`toggle ${t.wsEnabled?"on-accent":"off"}`,onClick:c})]}),e.jsxs("div",{className:"toggle-row",children:[e.jsx("span",{className:"toggle-label",children:"HTTP Traffic"}),e.jsx("button",{className:`toggle ${t.httpEnabled?"on-success":"off"}`,onClick:i})]}),t.wsEnabled&&e.jsx("div",{className:"warn",children:"Chrome shows a debugger banner on captured tabs"})]}),e.jsx("div",{className:"section",children:e.jsx("button",{className:"btn",onClick:l,children:"Open Dashboard"})}),e.jsxs("div",{className:"stats text-secondary",children:[e.jsxs("span",{className:"stat",children:[t.conversationCount," convs"]}),e.jsxs("span",{className:"stat",children:[t.messageCount," msgs"]}),e.jsxs("span",{className:"stat",children:[t.pluginInvocationCount," plugins"]})]})]})]}):e.jsxs(e.Fragment,{children:[e.jsx("style",{children:a}),e.jsx("div",{className:"container text-secondary",style:{padding:"20px",textAlign:"center"},children:"Loading..."})]})}d(document.getElementById("root")).render(e.jsx(g.StrictMode,{children:e.jsx(p,{})}));
