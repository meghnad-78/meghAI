# MeghAI Windows Agent Control Plane (Section 45, 46, 48)

## 1. Role & Architecture
The **Windows Agent** is a dedicated privileged local service (`apps/windows-agent`) separate from UI and general cloud logic.
It communicates with the Desktop Shell and API via cryptographically signed local IPC.

## 2. Automation Priority Hierarchy (Section 46)
1. Native application API
2. Windows UI Automation (UIA)
3. Windows Accessibility Tree
4. Browser DOM
5. Keyboard shortcuts
6. Semantic UI automation
7. Mouse automation
8. Coordinate-based fallback (Coordinate clicking is strictly a fallback, never the primary strategy)

## 3. PowerShell Security & Classification (Section 48)
- `READ_ONLY`: System telemetry, process list, uptime.
- `LOW`: Reading file metadata, directory listings.
- `MEDIUM`: Reversible file edits, application launches.
- `HIGH`: Software package installs, background services.
- `CRITICAL`: Bulk file deletion (`del /s`), disk partition operations, registry edits.
Critical operations require explicit user approval and are registered with the Emergency Kill Switch.
