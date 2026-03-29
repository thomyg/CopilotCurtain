# CLAUDE.md — CopilotCurtain

## What This Is

A Chrome/Edge Manifest V3 extension that intercepts and decodes M365 Copilot's real-time communication. It captures WebSocket frames (substrate.office.com SignalR hub) and HTTP traffic across all M365 surfaces (Teams, Word, Excel, PowerPoint, Outlook, SharePoint, M365 Chat) to make the full prompt-to-response pipeline visible: plugin selection, search queries, grounding sources, and response generation.

**Target users**: Copilot plugin developers, declarative agent builders, IT pros auditing tenant data access, M365 consultants.

## Quick Reference

```bash
npm install          # Install dependencies
npm run build        # TypeScript check + Vite build -> dist/
npm run dev          # Vite dev server (HMR, watch mode)
npm run zip          # Build + zip dist/ for distribution
```

**Load in browser**: chrome://extensions/ or edge://extensions/ -> Developer mode -> Load unpacked -> select `dist/`

## Architecture

```
src/
  background/          # MV3 service worker (runs in background)
    service-worker.ts    Central orchestrator, message routing, port management
    http-interceptor.ts  chrome.webRequest listener, URL classification, header redaction
    websocket-interceptor.ts  chrome.debugger (CDP) for WebSocket frame capture
    copilot-decoder.ts   Parses SignalR JSON frames (0x1E separator), classifies message types
    plugin-tracker.ts    Builds plugin registry from /userconfig, correlates WS+HTTP invocations
    storage.ts           IndexedDB wrapper (idb library), 6 object stores
  panel/               # Side panel UI (React app)
    App.tsx              Three-view layout: Conversations, Plugins, HTTP
    hooks/useStore.ts    Zustand store + chrome.runtime.Port live stream
    components/          ConversationList, ConversationTimeline, MessageDetail,
                         PluginDashboard, HttpTraffic
  popup/               # Toolbar popup (quick toggles + stats)
    Popup.tsx
  shared/              # Shared between background and UI
    types.ts             All TypeScript interfaces (domain types, message union)
    constants.ts         URL patterns, category config, display mappings
```

### Data Flow

1. **WebSocket path**: Tab detected as Copilot surface -> chrome.debugger attaches -> CDP Network events -> copilot-decoder parses frames -> plugin-tracker correlates -> IndexedDB + live port stream
2. **HTTP path**: chrome.webRequest listeners -> URL classified into categories -> headers redacted -> batched writes to IndexedDB + live port stream
3. **UI path**: Zustand store connects via chrome.runtime.Port -> receives batched updates (200ms interval) -> React renders with virtual scrolling

### Key Design Decisions

- **chrome.debugger for WebSocket**: MV3 has no `webRequestBlocking` for WebSocket frames. CDP `Network.webSocketFrame*` events are the only way to capture frame payloads. This causes the "debugging this tab" banner — unavoidable.
- **SignalR frame splitting**: Copilot uses SignalR over WebSocket. Frames are delimited by ASCII Record Separator (0x1E / char code 30). Each segment is independent JSON.
- **Batched storage writes**: HTTP requests buffer up to 50 items or 500ms before flushing to IndexedDB — prevents write thrashing.
- **UI buffer limits**: Messages and requests cap at 3000 items in the Zustand store to prevent memory issues.
- **Plugin correlation**: WebSocket plugin_call events are matched to HTTP requests within a 10-second window using plugin name/ID matching.

## Tech Stack

- **TypeScript 5.4** (strict mode) + **React 18** + **Tailwind CSS 3.4**
- **Vite 5.4** — multi-entry build (panel, popup, service-worker)
- **Zustand** — lightweight state management
- **idb** — IndexedDB promise wrapper
- **@tanstack/react-virtual** — virtualized list rendering
- **Chrome Extension APIs**: webRequest, debugger, storage, tabs, sidePanel

## Build System (Vite)

The Vite config (`vite.config.ts`) does a multi-entry build:
- `panel` and `popup` are standard Vite entries (hashed output in `dist/assets/`)
- `service-worker` outputs to a fixed path (`dist/src/background/service-worker.js`) because the manifest references it by exact path
- A custom Vite plugin (`copyExtensionFiles`) copies `manifest.json` and `public/icons/` into `dist/` at build close

**Important**: The service worker entry must remain at `src/background/service-worker.ts` and its output path must stay fixed — the manifest depends on it.

## IndexedDB Schema

Database name: `copilot-curtain`, version 1

| Store | Key | Indices | Purpose |
|-------|-----|---------|---------|
| `requests` | id | timestamp, category, sessionId | HTTP traffic |
| `ws_messages` | id | conversationId, timestamp | WebSocket frames |
| `conversations` | id | — | Conversation metadata |
| `plugins` | id | — | Plugin registry |
| `plugin_invocations` | id | pluginId, conversationId, timestamp | Plugin call records |
| `sessions` | id | — | Named capture sessions |

## Message Protocol

All communication between background and UI uses `chrome.runtime` messages. The `Message` type in `src/shared/types.ts` is a discriminated union covering:
- `TOGGLE_WS` / `TOGGLE_HTTP` — Enable/disable capture
- `MONITOR_STATUS` — Poll current state
- `GET_CONVERSATIONS` / `GET_MESSAGES` / `GET_PLUGINS` / `GET_INVOCATIONS` / `GET_REQUESTS` — Data queries
- `START_SESSION` / `STOP_SESSION` — Session management
- `CLEAR_DATA` — Purge all stores
- `OPEN_PANEL` — Open side panel from popup

Live streaming uses `chrome.runtime.Port` (port name: `copilot-curtain-live`).

## Copilot Message Types

The decoder (`copilot-decoder.ts`) classifies WebSocket frames into:
- `user_prompt` — User input + enabled plugin list
- `search_query` / `search_results` — SubstrateSearchService queries and results
- `response_chunk` / `response_final` — Streaming and final Copilot responses
- `plugin_call` / `plugin_response` — Plugin invocations
- `diagnostics` — Content origin, safety filters (OffensiveRequestClassifier)
- `disengaged` — Copilot refusal/error
- `handshake` — SignalR protocol negotiation

## Security & Privacy

- Bearer tokens truncated to first 10 + last 4 characters
- Cookies and sensitive headers (matching: token, key, secret, password, credential) are redacted
- Request/response bodies truncated at 100KB, WebSocket payloads at 50KB
- All data stays in browser IndexedDB — nothing transmitted externally

## Conventions

- **No test framework yet** — no tests exist. When adding tests, Vitest is the natural choice given the Vite build.
- **No linter/formatter configured** — code follows consistent style but has no enforced config.
- **Dark theme only** — UI uses custom Tailwind dark palette (surface-*, copilot-* color tokens in `tailwind.config.js`).
- **Emoji in UI only** — category and message type configs use emoji for visual identification in the dashboard.
- Component files are flat in `src/panel/components/` (no nested folders).
- All Chrome API types come from `@types/chrome`.

## Known Limitations & Future Work

- SignalR MessagePack binary frames are not decoded (only JSON text frames)
- No session export (JSON/Markdown)
- No adaptive card rendering preview
- No multi-tab conversation correlation
- No Copilot Studio agent debugging support
- No prompt simulator for testing plugin selection locally

## Common Tasks

**Adding a new Copilot message type**: Update `classifySentFrame()` or `classifyReceivedFrame()` in `copilot-decoder.ts`, add the type to `CopilotMessageType` in `types.ts`, and add display config in `MESSAGE_TYPE_CONFIG` in `constants.ts`.

**Adding a new HTTP URL pattern**: Add entry to `COPILOT_HTTP_PATTERNS` in `constants.ts` and add category display config to `CATEGORY_CONFIG`.

**Adding a new UI view**: Add a view key in `App.tsx` navigation, create the component in `src/panel/components/`, add any needed store fields in `useStore.ts`.

**Adding a new IndexedDB store**: Update `initDB()` in `storage.ts` (bump DB version), add typed accessor functions, update `clearAllData()`.
