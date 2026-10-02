# Connected Services and Integrations

## Supported Connectors

MeghAI provides secure, capability-scoped connectors for:
- **Google Gmail**: Email search, draft creation, verified sending.
- **Microsoft Outlook**: Mailbox retrieval, drafting, calendar scheduling.
- **Google Calendar**: Event listing, smart conflict resolution, scheduling.
- **WhatsApp Web / Desktop**: Message drafting and notification alerts.
- **Google Drive**: Document discovery and file ingestion.

## Core Security Rules

### Principle 3.2: Model Intent is not Authorization
An LLM deciding to send an email does not grant authorization. The action must independently satisfy the `PermissionBroker` and require explicit user approval.

### Principle 3.5: Draft is NOT Send
Creating an email or WhatsApp draft and dispatching that message are decoupled into distinct tools:
- `create_email_draft`: Low Risk, can be performed freely.
- `send_email`: Critical Risk, requires explicit confirmation modal in UI.

### Principle 3.9: No Fake Functionality
If a service is disconnected or missing credentials, it reports `NOT_CONNECTED` or `REQUIRES_CREDENTIALS`. It never pretends to succeed.
