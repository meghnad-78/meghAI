# ADR 004: Safety, Permissions, Risk Engine & Verification

## Status
Accepted

## Context
Sections 3.1 - 3.7 establish strict foundational rules:
- The LLM is NOT the Operating System. Model proposals are not authorization.
- Plan is not execution; Draft is not send; Tool success is not outcome success.
- External content (web, emails, PDFs, files) is untrusted data and cannot override system instructions.
- Verification must confirm real-world outcomes, not just HTTP 200 or exit code 0.

## Decision
1. **Pipeline Order:**
   `LLM Proposal -> Schema Sanitization -> Permission Broker -> Risk Engine -> User Confirmation (if required) -> Resource Lock -> Tool Execution -> Verification Engine -> Audit Log`
2. **Permission Broker:**
   Maintains capability scopes (`MICROPHONE`, `SCREEN`, `FILESYSTEM`, `SHELL`, `BROWSER`, `EMAIL`, `MESSAGING`). Modes: `DENIED`, `ASK`, `ALLOWED`, `ALLOWED_WITH_CONFIRMATION`, `LOCAL_ONLY`.
3. **Risk Engine:**
   4-tier classification:
   - `LOW`: Read-only queries, local status, UI navigation.
   - `MEDIUM`: Reversible file edits, local drafts, notes, calendar checks.
   - `HIGH`: External message sending, software installation, file deletion, system setting updates.
   - `CRITICAL`: Bulk file deletion, shell execution with admin privileges, credential access, format/disk operations.
4. **Verification Engine:**
   - Files: Re-open file, verify existence and hash.
   - Shell: Check output and target file/process state.
   - Email/Messaging: Validate API message ID or draft ID.
   - If outcome cannot be definitively proven, status is marked `UNVERIFIED`.
5. **Emergency Kill Switch:**
   - Global shortcut `Ctrl+Alt+Escape` / API endpoint `/api/v1/system/kill` / UI button "STOP MEGH".
   - Immediately aborts active AbortControllers, terminates child processes, cancels model requests, and releases resource locks.

## Consequences
- Guaranteed safety against rogue model calls or prompt-injection exploitation.
- Absolute transparency for the user.
