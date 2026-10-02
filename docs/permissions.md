# MeghAI Permission Center & Safety Architecture (Section 57 & 59)

## 1. Principles
- **Authority Order:** `HARD SAFETY > PERMISSIONS > RISK > AUTONOMY > TASK PREFERENCE > MODEL PREFERENCE`
- **Non-Bypassable:** No model proposal can execute a tool without passing through the Permission Broker and Risk Engine.

## 2. Permission Scopes
| Scope | Description | Default Policy |
|---|---|---|
| `MICROPHONE` | Ambient audio capture and wake phrase detection | `LOCAL_ONLY` |
| `CAMERA` | Visual optical capture | `DENIED` |
| `SCREEN` | Full desktop screenshot & accessibility tree capture | `ASK` |
| `FILESYSTEM` | Read/write/modify local files | `SELECTED_FOLDERS` |
| `BROWSER` | Chromium/Playwright browser automation | `ASK` |
| `APPLICATIONS` | Launching or terminating desktop applications | `ALLOWED_WITH_CONFIRMATION` |
| `CLIPBOARD` | Accessing system clipboard contents | `ASK` |
| `POWERSHELL` | Executing PowerShell cmdlets or scripts | `ALLOWED_WITH_CONFIRMATION` |
| `CMD` | Executing Windows Command Prompt operations | `ALLOWED_WITH_CONFIRMATION` |
| `EMAIL` | Sending/reading Gmail or Outlook messages | `ALLOWED_WITH_CONFIRMATION` |
| `CALENDAR` | Reading/modifying Google or Outlook calendar events | `ALLOWED_WITH_CONFIRMATION` |
| `MESSAGING` | Sending messages via WhatsApp or messaging connectors | `ALLOWED_WITH_CONFIRMATION` |
| `NOTIFICATIONS` | Sending desktop notifications | `ALLOWED` |
| `CLOUD_PROVIDERS` | Outbound AI model inference calls | `ALLOWED` |
| `KNOWLEDGE_SOURCES`| Indexing approved document collections | `ALLOWED` |

## 3. Modes
- `DENIED`: Never executed.
- `ASK`: Must prompt user for approval prior to every action.
- `ALLOWED`: Automatically permitted for low-risk actions.
- `ALLOWED_WITH_CONFIRMATION`: High/critical risk actions generate an Action Preview card requiring approval.
- `LOCAL_ONLY`: Strictly restricted to local offline processing; cloud data exfiltration is blocked.
- `SELECTED_FOLDERS`: Restricted to user-configured directory roots.
