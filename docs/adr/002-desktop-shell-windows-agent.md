# ADR 002: Desktop Shell & Windows Integration

## Status
Accepted

## Context
MeghAI is a Windows-first personal AI operating layer. The user interacts through a desktop interface, global shortcuts (`Ctrl+Space`), system tray, and voice, while the system performs deep Windows automation (applications, processes, files, PowerShell, screenshots, accessibility tree).

However, principle 3.1 states:
*Frontend code should not directly control privileged system capabilities.*
*The Windows agent and desktop UI must communicate through secure typed IPC.*

Rust/Cargo is not pre-installed on this machine, but Node.js 24 and Windows PowerShell 5.1 are installed.

## Decision
1. **Desktop Shell (`apps/desktop`):**
   - Built with Electron + React 18/19 + Vite.
   - Enforces `contextIsolation: true`, `nodeIntegration: false`, and strict Content Security Policy.
   - Renders the futuristic UI, living particle AI Core, Universal Command Palette, and spatial HUD.
   - Manages global shortcuts (`Ctrl+Space` for summon, `Ctrl+Alt+Escape` for instant Kill Switch).
   - Manages Windows System Tray icon with emergency controls.

2. **Windows Agent (`apps/windows-agent`):**
   - Operates as a separate, privileged local service.
   - Communicates with the Desktop/API via cryptographically signed local IPC (Named Pipe / Localhost WebSocket with ephemeral secret token).
   - Directs automation through:
     1. Windows UI Automation & Win32 APIs
     2. Windows Accessibility tree
     3. PowerShell with strict command classification (READ_ONLY, LOW, MEDIUM, HIGH, CRITICAL)
     4. Process inspection and lifecycle management
     5. Ephemeral screen capture & local OCR
   - Adheres to resource locking (keyboard, mouse, screen, clipboard).

## Consequences
- Clean separation between privileged OS operations and UI rendering.
- Even if a webview or UI component were compromised, it cannot execute arbitrary OS commands without passing through the IPC authentication token, Permission Broker, and Risk Engine.
