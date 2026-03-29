# 🎭 CopilotCurtain

A Chrome/Edge extension for **M365 Copilot developers and IT Pros** — see exactly what Copilot does behind the scenes: plugin selection, search queries, grounding sources, and the full prompt-to-response pipeline.

## What It Does

CopilotCurtain captures and decodes Microsoft 365 Copilot's real-time communication, giving you visibility into:

| Feature | Description |
|---------|-------------|
| **🤖 WebSocket Decoder** | Intercepts and decodes Copilot's WebSocket protocol (`substrate.office.com/m365chat/SecuredChathub`) in real-time |
| **🔌 Plugin Inspector** | See all loaded plugins, their configs, invocation rates, success/failure stats, and latency |
| **🔍 Search Query Viewer** | Watch the `SubstrateSearchService` queries Copilot runs against your tenant data |
| **📄 Source Attribution** | See which files, emails, chats, and meetings Copilot grounded its response on |
| **📡 HTTP Traffic** | Capture Copilot-related HTTP calls (Graph, Substrate, plugin APIs, auth) |
| **🧑 Prompt Tracking** | Full prompt → search → plugin → grounding → response pipeline |

## Who Is This For?

- **Copilot Plugin Developers** — Debug why your plugin isn't being selected or invoked
- **Declarative Agent Builders** — Understand the full conversation lifecycle
- **IT Pros** — Audit what data Copilot accesses in your tenant
- **M365 Consultants** — Demonstrate Copilot behavior to clients
- **Copilot Readiness Teams** — Validate data quality and grounding before rollout

## Installation

### From Source

```bash
# Clone the repo
git clone https://github.com/thomyg/CopilotCurtain.git
cd CopilotCurtain

# Install dependencies
npm install

# Build
npm run build
```

### Load in Chrome/Edge

1. Open `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge)
2. Enable **Developer mode**
3. Click **"Load unpacked"**
4. Select the `dist/` folder

## Usage

### Quick Start

1. Click the CopilotCurtain icon in your browser toolbar
2. Toggle **🤖 Copilot WebSocket** ON to start capturing Copilot conversations
3. Toggle **📡 HTTP Traffic** ON to capture related API calls
4. Click **📊 Open Dashboard** to open the full side panel
5. Open M365 Copilot (Teams, M365 Chat, Word, etc.) and start a conversation
6. Watch the conversation appear in real-time in the dashboard

### Dashboard Views

- **🤖 Copilot** — Conversation list + timeline showing prompts, search queries, plugin calls, and responses
- **🔌 Plugins** — Registry of all loaded plugins with health stats and invocation history
- **📡 HTTP** — Raw HTTP traffic for Copilot-related API calls

### Important Notes

- **WebSocket capture uses `chrome.debugger`** — Chrome/Edge will show a "CopilotCurtain started debugging this tab" banner. This is required to capture WebSocket frames and cannot be avoided.
- **Tokens are redacted** — Bearer tokens, cookies, and sensitive headers are automatically truncated in storage and display.
- **Privacy first** — All data stays local in your browser's IndexedDB. Nothing is sent externally.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              CopilotCurtain Extension                 │
├──────────────┬──────────────┬───────────────────────┤
│  Background  │  WebSocket   │    Side Panel UI       │
│  Service     │  Interceptor │    (React + Tailwind)  │
│  Worker      │  (debugger)  │                        │
│              │              │  🤖 Conversations      │
│  - HTTP      │  - CDP       │  🔌 Plugin Dashboard   │
│    intercept │  - Copilot   │  📡 HTTP Traffic       │
│  - Plugin    │    decoder   │  📄 Source Viewer       │
│    tracker   │  - Frame     │                        │
│              │    parser    │                        │
├──────────────┴──────────────┴───────────────────────┤
│                  IndexedDB Storage                    │
│  conversations | ws_messages | plugins |              │
│  plugin_invocations | requests | sessions             │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

- **TypeScript** + **React 18** + **Tailwind CSS**
- **Vite** for building
- **zustand** for state management
- **idb** for IndexedDB access
- **@tanstack/react-virtual** for virtualized lists
- **Chrome Manifest V3** with `webRequest` + `debugger` APIs

## Development

```bash
npm run dev      # Vite dev server
npm run build    # Production build → dist/
npm run zip      # Build + zip for distribution
```

## Contributing

Contributions welcome! Areas that need work:

- [ ] SignalR/MessagePack binary frame decoding
- [ ] Prompt simulator (test prompts against plugin descriptions locally)
- [ ] Session export (JSON/Markdown reports)
- [ ] Adaptive card rendering preview
- [ ] Multi-tab conversation correlation
- [ ] Copilot Studio agent debugging

## License

MIT

## Disclaimer

This is an independent community tool, not affiliated with or endorsed by Microsoft. CopilotCurtain observes Copilot's communication protocol for debugging and educational purposes. The WebSocket protocol may change at any time without notice.
